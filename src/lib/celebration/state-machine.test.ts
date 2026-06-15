import { describe, expect, it } from "vitest";
import { manuscriptStatus, projectStatus } from "../../db/enums.ts";
import {
	ACTION_DEADLINE,
	assertProjectTransition,
	canManuscriptTransition,
	canProjectTransition,
	effectiveDeadline,
	InvalidTransitionError,
	isActionBlockedByDeadline,
	isProjectTerminal,
	MANUSCRIPT_TRANSITIONS,
	notificationForManuscriptStatus,
	notificationForProjectStatus,
	PROJECT_TRANSITIONS,
} from "./state-machine.ts";

describe("项目主线状态机", () => {
	it("合法转换", () => {
		expect(canProjectTransition("draft", "proposal_submitted")).toBe(true);
		expect(
			canProjectTransition("proposal_submitted", "proposal_approved"),
		).toBe(true);
		expect(
			canProjectTransition("proposal_approved", "manuscript_submitted"),
		).toBe(true);
		expect(canProjectTransition("manuscript_approved", "info_supplement")).toBe(
			true,
		);
		expect(canProjectTransition("info_supplement", "completed")).toBe(true);
	});

	it("拒绝后可修改重提", () => {
		expect(
			canProjectTransition("proposal_rejected", "proposal_submitted"),
		).toBe(true);
	});

	it("中途可撤回", () => {
		expect(canProjectTransition("proposal_submitted", "withdrawn")).toBe(true);
		expect(canProjectTransition("manuscript_approved", "withdrawn")).toBe(true);
	});

	it("非法转换被拒（跳级 / 倒退）", () => {
		expect(canProjectTransition("draft", "completed")).toBe(false);
		expect(
			canProjectTransition("proposal_submitted", "manuscript_submitted"),
		).toBe(false);
		expect(canProjectTransition("completed", "withdrawn")).toBe(false);
	});

	it("终态无出边", () => {
		expect(isProjectTerminal("completed")).toBe(true);
		expect(isProjectTerminal("withdrawn")).toBe(true);
		expect(isProjectTerminal("draft")).toBe(false);
		expect(PROJECT_TRANSITIONS.completed).toHaveLength(0);
		expect(PROJECT_TRANSITIONS.withdrawn).toHaveLength(0);
	});

	it("转换表穷举所有状态（与 enums SSOT 对齐）", () => {
		for (const s of projectStatus.enumValues) {
			expect(PROJECT_TRANSITIONS).toHaveProperty(s);
		}
	});

	it("assert 非法流转抛 InvalidTransitionError", () => {
		expect(() => assertProjectTransition("draft", "completed")).toThrow(
			InvalidTransitionError,
		);
		expect(() =>
			assertProjectTransition("draft", "proposal_submitted"),
		).not.toThrow();
	});
});

describe("稿件审核状态机", () => {
	it("合法转换 + 打回 / 拒绝可重提", () => {
		expect(canManuscriptTransition("pending", "approved")).toBe(true);
		expect(canManuscriptTransition("pending", "revision_requested")).toBe(true);
		expect(canManuscriptTransition("revision_requested", "pending")).toBe(true);
		expect(canManuscriptTransition("rejected", "pending")).toBe(true);
	});

	it("通过为终态", () => {
		expect(MANUSCRIPT_TRANSITIONS.approved).toHaveLength(0);
	});

	it("穷举所有稿件状态", () => {
		for (const s of manuscriptStatus.enumValues) {
			expect(MANUSCRIPT_TRANSITIONS).toHaveProperty(s);
		}
	});
});

describe("状态 → 邮件映射", () => {
	it("项目状态触发对应邮件 + 收件角色", () => {
		expect(notificationForProjectStatus("proposal_submitted")).toEqual({
			template: "proposal_submitted",
			recipient: "organizer",
		});
		expect(notificationForProjectStatus("proposal_approved")?.recipient).toBe(
			"creator",
		);
	});

	it("无邮件的状态返回 undefined", () => {
		expect(notificationForProjectStatus("draft")).toBeUndefined();
	});

	it("稿件打回通知创作者", () => {
		expect(
			notificationForManuscriptStatus("revision_requested")?.recipient,
		).toBe("creator");
	});
});

describe("DDL 守卫（读时派生）", () => {
	const t = (iso: string) => new Date(iso);

	it("effective = max(活动级, 项目级特批)", () => {
		const activity = t("2026-06-10T00:00:00Z");
		expect(effectiveDeadline(activity, t("2026-06-20T00:00:00Z"))).toEqual(
			t("2026-06-20T00:00:00Z"),
		);
		expect(effectiveDeadline(activity, null)).toEqual(activity);
		// 特批早于活动级则不缩短（取大者）
		expect(effectiveDeadline(activity, t("2026-06-01T00:00:00Z"))).toEqual(
			activity,
		);
	});

	it("逾期判断 + 动作拦截", () => {
		const ddl = t("2026-06-15T00:00:00Z");
		expect(
			isActionBlockedByDeadline(ddl, null, t("2026-06-16T00:00:00Z")),
		).toBe(true);
		expect(
			isActionBlockedByDeadline(ddl, null, t("2026-06-14T00:00:00Z")),
		).toBe(false);
		// 项目特批延长后未逾期
		expect(
			isActionBlockedByDeadline(
				ddl,
				t("2026-06-20T00:00:00Z"),
				t("2026-06-16T00:00:00Z"),
			),
		).toBe(false);
	});

	it("动作 → DDL 映射", () => {
		expect(ACTION_DEADLINE.submit_proposal).toBe("proposal");
		expect(ACTION_DEADLINE.submit_manuscript).toBe("submission");
		expect(ACTION_DEADLINE.supplement_info).toBe("info_supplement");
	});
});
