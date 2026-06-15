import { describe, expect, it } from "vitest";
import type { FormQuestion } from "#/db/celebration-schema";
import {
	answersToRow,
	isSurveyOpen,
	latestResponsesByRespondent,
} from "./survey.ts";

const t = (s: string) => new Date(s);

describe("问卷开放窗口", () => {
	const now = t("2026-07-15T00:00:00Z");
	it("窗口内开放", () => {
		expect(
			isSurveyOpen(t("2026-07-01T00:00:00Z"), t("2026-07-30T00:00:00Z"), now),
		).toBe(true);
	});
	it("未到开放时间 / 已过关闭时间不可填", () => {
		expect(isSurveyOpen(t("2026-08-01T00:00:00Z"), null, now)).toBe(false);
		expect(isSurveyOpen(null, t("2026-07-01T00:00:00Z"), now)).toBe(false);
	});
	it("两侧为空表示长期开放", () => {
		expect(isSurveyOpen(null, null, now)).toBe(true);
	});
});

describe("重复填写去重", () => {
	it("同一填写者取最新一条", () => {
		const latest = latestResponsesByRespondent([
			{
				respondentId: "u1",
				submittedAt: t("2026-07-01T00:00:00Z"),
				answer: "old",
			},
			{
				respondentId: "u1",
				submittedAt: t("2026-07-05T00:00:00Z"),
				answer: "new",
			},
			{
				respondentId: "u2",
				submittedAt: t("2026-07-02T00:00:00Z"),
				answer: "x",
			},
		]);
		expect(latest).toHaveLength(2);
		expect(latest.find((r) => r.respondentId === "u1")?.answer).toBe("new");
	});

	it("匿名条目不去重", () => {
		const latest = latestResponsesByRespondent([
			{ respondentId: null, submittedAt: t("2026-07-01T00:00:00Z") },
			{ respondentId: null, submittedAt: t("2026-07-02T00:00:00Z") },
		]);
		expect(latest).toHaveLength(2);
	});
});

describe("答案行展开", () => {
	it("按 schema 顺序，多选用顿号连接", () => {
		const schema: FormQuestion[] = [
			{ id: "a", type: "text", label: "A", required: true },
			{
				id: "b",
				type: "multi",
				label: "B",
				required: false,
				options: ["x", "y"],
			},
			{ id: "c", type: "rating", label: "C", required: false, ratingMax: 5 },
		];
		expect(answersToRow(schema, { a: "hi", b: ["x", "y"], c: 4 })).toEqual([
			"hi",
			"x、y",
			"4",
		]);
		expect(answersToRow(schema, {})).toEqual(["", "", ""]);
	});
});
