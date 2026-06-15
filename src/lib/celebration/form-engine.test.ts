import { describe, expect, it } from "vitest";
import type { FormQuestion } from "#/db/celebration-schema";
import {
	formDataToDynamicAnswers,
	hasFormErrors,
	isReservedFormFieldId,
	presetQuestionToFormQuestion,
	validateDynamicFormAnswers,
	validateFormSchema,
} from "./form-engine.ts";

describe("动态表单引擎", () => {
	const schema: FormQuestion[] = [
		{ id: "intro", type: "textarea", label: "简介", required: true },
		{
			id: "track",
			type: "single",
			label: "赛道",
			required: true,
			options: ["A", "B"],
		},
		{
			id: "tags",
			type: "multi",
			label: "标签",
			required: false,
			options: ["萌新", "进阶"],
		},
		{
			id: "score",
			type: "rating",
			label: "自评分",
			required: true,
			ratingMax: 5,
		},
		{ id: "publishDate", type: "date", label: "计划日期", required: true },
	];

	it("强制字段 ID 被保留，配置题不可覆盖", () => {
		expect(isReservedFormFieldId("email")).toBe(true);
		expect(isReservedFormFieldId("projectTitle")).toBe(true);
		expect(
			validateFormSchema([
				{ id: "email", type: "text", label: "邮箱", required: false },
			]),
		).toMatchObject({ email: "系统强制字段不可删改或覆盖。" });
	});

	it("预设题可转换为 schema 题目", () => {
		expect(
			presetQuestionToFormQuestion(
				{ type: "single", label: "预设赛道", config: { options: ["A"] } },
				"preset_track",
				true,
			),
		).toEqual({
			id: "preset_track",
			type: "single",
			label: "预设赛道",
			required: true,
			options: ["A"],
		});
	});

	it("校验强制字段、必填题和题型范围", () => {
		const errors = validateDynamicFormAnswers(schema, {
			email: "creator@example.com",
			username: "creator",
			projectTitle: "企划",
			intro: "介绍",
			track: "C",
			tags: ["萌新"],
			score: 6,
			publishDate: "not-a-date",
		});

		expect(errors.track).toBe("赛道必须选择有效选项。");
		expect(errors.score).toBe("自评分必须在 1-5 之间。");
		expect(errors.publishDate).toBe("计划日期必须是有效日期。");
		expect(hasFormErrors(errors)).toBe(true);
	});

	it("合法答案通过校验，选填题可为空", () => {
		expect(
			validateDynamicFormAnswers(schema, {
				email: "creator@example.com",
				username: "creator",
				projectTitle: "企划",
				intro: "介绍",
				track: "A",
				tags: [],
				score: 4,
				publishDate: "2026-07-01",
			}),
		).toEqual({});
	});

	it("从 FormData 解析所有题型答案", () => {
		const formData = new FormData();
		formData.set("email", "creator@example.com");
		formData.set("username", "creator");
		formData.set("projectTitle", "企划");
		formData.set("answers.intro", "介绍");
		formData.set("answers.track", "A");
		formData.append("answers.tags", "萌新");
		formData.append("answers.tags", "进阶");
		formData.set("answers.score", "3");
		formData.set("answers.publishDate", "2026-07-01");

		expect(formDataToDynamicAnswers(schema, formData)).toEqual({
			email: "creator@example.com",
			username: "creator",
			projectTitle: "企划",
			intro: "介绍",
			track: "A",
			tags: ["萌新", "进阶"],
			score: 3,
			publishDate: "2026-07-01",
		});
	});
});
