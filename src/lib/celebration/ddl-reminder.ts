import type { ActivitySchedule, DeadlineKind } from "./state-machine.ts";

// DDL 临近提醒领域 SSOT（T29）：判定哪些 DDL 进入「临近窗口」。纯函数，零 DB 依赖。
// 幂等（不重复轰炸）由集成层用 ddl_reminder 表去重，本层只负责「是否到点」。

// 截止前提醒窗口：默认 72 小时内且尚未过期。
export const DDL_REMINDER_WINDOW_MS = 72 * 60 * 60 * 1000;

export const DEADLINE_KINDS = [
	"proposal",
	"submission",
	"info_supplement",
] satisfies DeadlineKind[];

export const DEADLINE_NAMES: Record<DeadlineKind, string> = {
	proposal: "立项截止",
	submission: "稿件提交截止",
	info_supplement: "信息补充截止",
};

// 返回处于临近窗口（now ≤ deadline ≤ now+window）内的 DDL 类别（三类各自独立判断）。
export function dueDeadlineKinds(
	schedule: ActivitySchedule,
	now: Date,
	windowMs: number = DDL_REMINDER_WINDOW_MS,
): DeadlineKind[] {
	const deadlines: Record<DeadlineKind, Date> = {
		proposal: schedule.proposalDeadline,
		submission: schedule.submissionDeadline,
		info_supplement: schedule.infoSupplementDeadline,
	};
	const start = now.getTime();
	const end = start + windowMs;
	return DEADLINE_KINDS.filter((kind) => {
		const t = deadlines[kind].getTime();
		return t >= start && t <= end;
	});
}
