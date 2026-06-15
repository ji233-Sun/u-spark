import type { ManuscriptStatus, ProjectStatus } from "./state-machine.ts";

// 稿件提交 / 审核领域 SSOT（T19/T20/T23）：纯函数，零 DB 依赖，集中编码
// 「本次提交语义」「审核结果流转」「网盘/提取码校验」，供 API 集成层调用。

// 依据 project 主轴 + 当前稿件审核状态判定本次提交语义。
export type ManuscriptSubmitMode =
	| "initial" // 立项通过后首次提交（proposal_approved → manuscript_submitted）
	| "resubmit" // 被拒 / 打回后重提（项目仍在 manuscript_submitted，重置审核为 pending）
	| "supplement_copy" // 信息补充阶段重交副本（T23，不回退主状态）
	| "blocked"; // 当前状态不可提交

export function manuscriptSubmitMode(
	projectStatus: ProjectStatus,
	manuscriptStatus: ManuscriptStatus | null,
): ManuscriptSubmitMode {
	if (projectStatus === "proposal_approved") {
		return "initial";
	}
	if (projectStatus === "manuscript_submitted") {
		// 审核中（pending）不可重复提交；被拒 / 打回方可重提。
		return manuscriptStatus === "rejected" ||
			manuscriptStatus === "revision_requested"
			? "resubmit"
			: "blocked";
	}
	if (projectStatus === "info_supplement") {
		return "supplement_copy"; // T23 重提子流程
	}
	return "blocked";
}

export function canSubmitManuscript(
	projectStatus: ProjectStatus,
	manuscriptStatus: ManuscriptStatus | null,
): boolean {
	return manuscriptSubmitMode(projectStatus, manuscriptStatus) !== "blocked";
}

export function nextManuscriptVersion(currentVersion: number): number {
	return currentVersion + 1;
}

// ── 提交内容校验（T19：封面必传、网盘链接必填、提取码选填）──
export type ManuscriptSubmissionFields = {
	coverImageKey?: unknown;
	driveLink?: unknown;
	extractCode?: unknown;
	note?: unknown;
};

export type ManuscriptValidationErrors = Record<string, string>;

export function validateManuscriptSubmission(
	input: ManuscriptSubmissionFields,
): ManuscriptValidationErrors {
	const errors: ManuscriptValidationErrors = {};

	const cover =
		typeof input.coverImageKey === "string" ? input.coverImageKey.trim() : "";
	if (!cover) {
		errors.coverImageKey = "请先上传稿件封面图。";
	}

	const driveLink =
		typeof input.driveLink === "string" ? input.driveLink.trim() : "";
	if (!driveLink) {
		errors.driveLink = "网盘链接为必填项。";
	} else if (!/^https?:\/\/\S+$/i.test(driveLink)) {
		errors.driveLink = "网盘链接需以 http(s):// 开头。";
	}

	const extractCode =
		typeof input.extractCode === "string" ? input.extractCode.trim() : "";
	if (extractCode.length > 32) {
		errors.extractCode = "提取码过长（最多 32 字符）。";
	}

	return errors;
}

export function hasManuscriptErrors(
	errors: ManuscriptValidationErrors,
): boolean {
	return Object.keys(errors).length > 0;
}

// ── 审核结果（T20）：组织者决定 → 稿件审核轴目标状态 + 邮件模板 ──
export type ManuscriptReviewDecision = "approve" | "reject" | "revise";

export const MANUSCRIPT_REVIEW_TARGET = {
	approve: "approved",
	reject: "rejected",
	revise: "revision_requested",
} satisfies Record<ManuscriptReviewDecision, ManuscriptStatus>;

export function isManuscriptReviewDecision(
	value: unknown,
): value is ManuscriptReviewDecision {
	return value === "approve" || value === "reject" || value === "revise";
}

// 审核通过时 project 主轴推进序列：manuscript_submitted → manuscript_approved → info_supplement。
// （T20 验收：通过 → 信息补充）
export const MANUSCRIPT_APPROVE_PROJECT_FLOW = [
	"manuscript_approved",
	"info_supplement",
] satisfies ProjectStatus[];

// ── T23 稿件重提子流程 ──
// 信息补充阶段重交稿件 → 生成「待审核」副本（version > 当前过审版本，独立审核，不回退主状态）。
// 审核中（已有 pending 副本）不可再次重交，避免副本堆叠。
export function canSubmitSupplementCopy(
	projectStatus: ProjectStatus,
	hasPendingCopy: boolean,
): boolean {
	return projectStatus === "info_supplement" && !hasPendingCopy;
}

// 区分本次审核针对「首次提交」还是「重提副本」：
//   initial —— manuscript_submitted 且被审版本即当前版本（主轴推进）
//   copy    —— info_supplement 且被审版本高于当前过审版本（过审则替换、拒绝保持原态）
export type ManuscriptReviewKind = "initial" | "copy";

export function manuscriptReviewKind(
	projectStatus: ProjectStatus,
	reviewedVersion: number,
	currentVersion: number,
): ManuscriptReviewKind | null {
	if (
		projectStatus === "manuscript_submitted" &&
		reviewedVersion === currentVersion
	) {
		return "initial";
	}
	if (projectStatus === "info_supplement" && reviewedVersion > currentVersion) {
		return "copy";
	}
	return null;
}
