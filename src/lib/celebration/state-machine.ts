import { manuscriptStatus, projectStatus } from "../../db/enums.ts";

// 状态机 SSOT（T03 #3）：状态值定义在 src/db/enums.ts 的 pgEnum，本模块定义其
// 合法转换、邮件触发映射与 DDL 守卫。所有审核 / 流转逻辑统一走此模块。
// 纯函数、零 DB 依赖。

// 全部状态值（SSOT 源自 enums，供遍历 / 校验）
export const PROJECT_STATUSES = projectStatus.enumValues;
export const MANUSCRIPT_STATUSES = manuscriptStatus.enumValues;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ManuscriptStatus = (typeof MANUSCRIPT_STATUSES)[number];

// ── 项目主线合法转换（单主轴 + 中途撤回）──
// satisfies 确保穷举所有 ProjectStatus：enums 新增状态而此处未更新会编译报错。
export const PROJECT_TRANSITIONS = {
	draft: ["proposal_submitted"],
	proposal_submitted: ["proposal_approved", "proposal_rejected", "withdrawn"],
	proposal_rejected: ["proposal_submitted", "withdrawn"], // 可修改重提
	proposal_approved: ["manuscript_submitted", "withdrawn"],
	manuscript_submitted: ["manuscript_approved", "withdrawn"], // 打回不退主轴，见 manuscript 轴
	manuscript_approved: ["info_supplement", "withdrawn"],
	info_supplement: ["completed", "withdrawn"],
	completed: [],
	withdrawn: [],
} satisfies Record<ProjectStatus, readonly ProjectStatus[]>;

// ── 稿件审核合法转换（与主轴联动；打回 / 拒绝可重提）──
export const MANUSCRIPT_TRANSITIONS = {
	pending: ["approved", "rejected", "revision_requested"],
	revision_requested: ["pending"], // 修改后重新待审
	rejected: ["pending"], // 允许提交新版本重审
	approved: [],
} satisfies Record<ManuscriptStatus, readonly ManuscriptStatus[]>;

const PROJECT_TERMINAL = ["completed", "withdrawn"] satisfies ProjectStatus[];

export function canProjectTransition(
	from: ProjectStatus,
	to: ProjectStatus,
): boolean {
	return (PROJECT_TRANSITIONS[from] as readonly ProjectStatus[]).includes(to);
}

export function canManuscriptTransition(
	from: ManuscriptStatus,
	to: ManuscriptStatus,
): boolean {
	return (MANUSCRIPT_TRANSITIONS[from] as readonly ManuscriptStatus[]).includes(
		to,
	);
}

export function isProjectTerminal(status: ProjectStatus): boolean {
	return (PROJECT_TERMINAL as ProjectStatus[]).includes(status);
}

export class InvalidTransitionError extends Error {
	constructor(
		readonly kind: "project" | "manuscript",
		readonly from: string,
		readonly to: string,
	) {
		super(`非法状态流转（${kind}）：${from} → ${to}`);
		this.name = "InvalidTransitionError";
	}
}

export function assertProjectTransition(
	from: ProjectStatus,
	to: ProjectStatus,
): void {
	if (!canProjectTransition(from, to)) {
		throw new InvalidTransitionError("project", from, to);
	}
}

export function assertManuscriptTransition(
	from: ManuscriptStatus,
	to: ManuscriptStatus,
): void {
	if (!canManuscriptTransition(from, to)) {
		throw new InvalidTransitionError("manuscript", from, to);
	}
}

// ── 状态 → 邮件触发映射（template 待 T05 邮件基础设施对接）──
export type NotificationRecipient = "creator" | "organizer";
export type StatusNotification = {
	template: string;
	recipient: NotificationRecipient;
};

// 进入某 project 状态时触发
export const PROJECT_STATUS_NOTIFICATIONS: Partial<
	Record<ProjectStatus, StatusNotification>
> = {
	proposal_submitted: {
		template: "proposal_submitted",
		recipient: "organizer",
	},
	proposal_approved: { template: "proposal_approved", recipient: "creator" },
	proposal_rejected: { template: "proposal_rejected", recipient: "creator" },
	manuscript_approved: {
		template: "manuscript_approved",
		recipient: "creator",
	},
	info_supplement: {
		template: "info_supplement_requested",
		recipient: "creator",
	},
	completed: { template: "project_completed", recipient: "creator" },
};

// 进入某 manuscript 审核状态时触发
export const MANUSCRIPT_STATUS_NOTIFICATIONS: Partial<
	Record<ManuscriptStatus, StatusNotification>
> = {
	pending: { template: "manuscript_submitted", recipient: "organizer" },
	rejected: { template: "manuscript_rejected", recipient: "creator" },
	revision_requested: {
		template: "manuscript_revision_requested",
		recipient: "creator",
	},
};

export function notificationForProjectStatus(
	status: ProjectStatus,
): StatusNotification | undefined {
	return PROJECT_STATUS_NOTIFICATIONS[status];
}

export function notificationForManuscriptStatus(
	status: ManuscriptStatus,
): StatusNotification | undefined {
	return MANUSCRIPT_STATUS_NOTIFICATIONS[status];
}

// ── DDL 守卫（读时派生，不物理改状态；T01 ①）──
export type DeadlineKind = "proposal" | "submission" | "info_supplement";

// 推进动作受哪个 DDL 约束
export const ACTION_DEADLINE = {
	submit_proposal: "proposal",
	submit_manuscript: "submission",
	supplement_info: "info_supplement",
} satisfies Record<string, DeadlineKind>;

// effective 截止 = max(活动级, 项目级特批延长)
export function effectiveDeadline(
	activityLevel: Date,
	projectSpecial: Date | null,
): Date {
	return projectSpecial && projectSpecial.getTime() > activityLevel.getTime()
		? projectSpecial
		: activityLevel;
}

export function isOverdue(deadline: Date, now: Date): boolean {
	return now.getTime() > deadline.getTime();
}

// 动作是否被 DDL 阻挡（true = 已逾期，动作处应拒绝）
export function isActionBlockedByDeadline(
	activityLevel: Date,
	projectSpecial: Date | null,
	now: Date,
): boolean {
	return isOverdue(effectiveDeadline(activityLevel, projectSpecial), now);
}
