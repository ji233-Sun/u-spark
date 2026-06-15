import type { ManuscriptStatus, ProjectStatus } from "./state-machine.ts";

// 状态展示词表（T07 #7）：状态 → 中文标签 + 语义色调（tone）。纯映射，可单测。
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const PROJECT_STATUS_LABELS = {
	draft: "草稿",
	proposal_submitted: "立项待审",
	proposal_approved: "立项通过",
	proposal_rejected: "立项被拒",
	manuscript_submitted: "稿件待审",
	manuscript_approved: "稿件通过",
	info_supplement: "信息补充",
	completed: "已完成",
	withdrawn: "已撤回",
} satisfies Record<ProjectStatus, string>;

export const PROJECT_STATUS_TONES = {
	draft: "neutral",
	proposal_submitted: "info",
	proposal_approved: "success",
	proposal_rejected: "danger",
	manuscript_submitted: "info",
	manuscript_approved: "success",
	info_supplement: "warning",
	completed: "success",
	withdrawn: "neutral",
} satisfies Record<ProjectStatus, Tone>;

export const MANUSCRIPT_STATUS_LABELS = {
	pending: "待审核",
	approved: "已通过",
	rejected: "已拒绝",
	revision_requested: "需修改",
} satisfies Record<ManuscriptStatus, string>;

export const MANUSCRIPT_STATUS_TONES = {
	pending: "info",
	approved: "success",
	rejected: "danger",
	revision_requested: "warning",
} satisfies Record<ManuscriptStatus, Tone>;
