import { describe, expect, it } from "vitest";
import {
	hasConfigErrors,
	validateActivityBasics,
	validateActivitySchedule,
} from "./activity-config.ts";

const ORDERED = {
	startAt: "2026-07-01T00:00:00Z",
	proposalDeadline: "2026-07-10T00:00:00Z",
	submissionDeadline: "2026-07-20T00:00:00Z",
	infoSupplementDeadline: "2026-07-30T00:00:00Z",
};

describe("活动 DDL 时序校验", () => {
	it("单调递增通过", () => {
		expect(hasConfigErrors(validateActivitySchedule(ORDERED))).toBe(false);
	});

	it("立项晚于稿件 → 拦截", () => {
		const errors = validateActivitySchedule({
			...ORDERED,
			proposalDeadline: "2026-07-25T00:00:00Z",
		});
		expect(errors.submissionDeadline).toBeDefined();
	});

	it("缺失 / 非法时间 → 报错", () => {
		const errors = validateActivitySchedule({ ...ORDERED, startAt: "" });
		expect(errors.startAt).toBeDefined();
	});

	it("信息补充早于稿件 → 拦截", () => {
		const errors = validateActivitySchedule({
			...ORDERED,
			infoSupplementDeadline: "2026-07-15T00:00:00Z",
		});
		expect(errors.infoSupplementDeadline).toBeDefined();
	});
});

describe("活动基础信息校验", () => {
	it("名称必填", () => {
		expect(validateActivityBasics({}).title).toBeDefined();
		expect(hasConfigErrors(validateActivityBasics({ title: "夏日庆典" }))).toBe(
			false,
		);
	});
});
