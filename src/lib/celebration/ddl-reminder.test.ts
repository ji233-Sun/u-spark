import { describe, expect, it } from "vitest";
import { DEADLINE_NAMES, dueDeadlineKinds } from "./ddl-reminder.ts";

const hours = (h: number) => h * 60 * 60 * 1000;

function schedule(now: Date, offsets: { p: number; s: number; i: number }) {
	return {
		startAt: new Date(now.getTime() - hours(24)),
		proposalDeadline: new Date(now.getTime() + hours(offsets.p)),
		submissionDeadline: new Date(now.getTime() + hours(offsets.s)),
		infoSupplementDeadline: new Date(now.getTime() + hours(offsets.i)),
	};
}

describe("DDL 临近提醒判定", () => {
	const now = new Date("2026-07-15T00:00:00Z");

	it("窗口内的 DDL 被选中（默认 72h）", () => {
		// 立项 24h 后（窗口内），稿件 100h 后（窗口外），信息补充 48h 后（窗口内）
		const due = dueDeadlineKinds(schedule(now, { p: 24, s: 100, i: 48 }), now);
		expect(due).toContain("proposal");
		expect(due).toContain("info_supplement");
		expect(due).not.toContain("submission");
	});

	it("已过期的 DDL 不提醒", () => {
		const due = dueDeadlineKinds(schedule(now, { p: -1, s: 200, i: 300 }), now);
		expect(due).not.toContain("proposal");
	});

	it("窗口可调", () => {
		const due = dueDeadlineKinds(
			schedule(now, { p: 100, s: 200, i: 300 }),
			now,
			hours(120),
		);
		expect(due).toEqual(["proposal"]);
	});

	it("三类 DDL 各有中文名", () => {
		expect(DEADLINE_NAMES.proposal).toBe("立项截止");
		expect(DEADLINE_NAMES.submission).toBe("稿件提交截止");
		expect(DEADLINE_NAMES.info_supplement).toBe("信息补充截止");
	});
});
