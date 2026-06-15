import { describe, expect, it } from "vitest";
import {
	canSubmitManuscript,
	hasManuscriptErrors,
	isManuscriptReviewDecision,
	MANUSCRIPT_APPROVE_PROJECT_FLOW,
	MANUSCRIPT_REVIEW_TARGET,
	manuscriptSubmitMode,
	nextManuscriptVersion,
	validateManuscriptSubmission,
} from "./manuscript.ts";

describe("稿件提交模式判定", () => {
	it("立项通过且无稿件 → initial", () => {
		expect(manuscriptSubmitMode("proposal_approved", null)).toBe("initial");
	});

	it("已提交审核中（pending）不可重复提交", () => {
		expect(manuscriptSubmitMode("manuscript_submitted", "pending")).toBe(
			"blocked",
		);
	});

	it("被拒 / 打回后可重提", () => {
		expect(manuscriptSubmitMode("manuscript_submitted", "rejected")).toBe(
			"resubmit",
		);
		expect(
			manuscriptSubmitMode("manuscript_submitted", "revision_requested"),
		).toBe("resubmit");
	});

	it("信息补充阶段 → 重提副本（T23）", () => {
		expect(manuscriptSubmitMode("info_supplement", "approved")).toBe(
			"supplement_copy",
		);
	});

	it("草稿 / 已完成 / 已撤回不可提交", () => {
		expect(canSubmitManuscript("draft", null)).toBe(false);
		expect(canSubmitManuscript("completed", "approved")).toBe(false);
		expect(canSubmitManuscript("withdrawn", null)).toBe(false);
	});
});

describe("版本号递增", () => {
	it("自当前版本 +1", () => {
		expect(nextManuscriptVersion(0)).toBe(1);
		expect(nextManuscriptVersion(2)).toBe(3);
	});
});

describe("稿件提交校验", () => {
	it("封面必传、网盘链接必填", () => {
		const errors = validateManuscriptSubmission({});
		expect(errors.coverImageKey).toBeDefined();
		expect(errors.driveLink).toBeDefined();
		expect(hasManuscriptErrors(errors)).toBe(true);
	});

	it("网盘链接需为 http(s) URL", () => {
		const errors = validateManuscriptSubmission({
			coverImageKey: "manuscript-cover/a.png",
			driveLink: "ftp://x",
		});
		expect(errors.driveLink).toBeDefined();
	});

	it("合法输入无错误，提取码选填", () => {
		expect(
			hasManuscriptErrors(
				validateManuscriptSubmission({
					coverImageKey: "manuscript-cover/a.png",
					driveLink: "https://pan.example.com/s/abc",
				}),
			),
		).toBe(false);
	});

	it("提取码过长被拒", () => {
		const errors = validateManuscriptSubmission({
			coverImageKey: "manuscript-cover/a.png",
			driveLink: "https://pan.example.com/s/abc",
			extractCode: "x".repeat(33),
		});
		expect(errors.extractCode).toBeDefined();
	});
});

describe("审核决定映射", () => {
	it("识别合法审核决定", () => {
		expect(isManuscriptReviewDecision("approve")).toBe(true);
		expect(isManuscriptReviewDecision("reject")).toBe(true);
		expect(isManuscriptReviewDecision("revise")).toBe(true);
		expect(isManuscriptReviewDecision("nope")).toBe(false);
	});

	it("决定 → 稿件审核轴目标", () => {
		expect(MANUSCRIPT_REVIEW_TARGET.approve).toBe("approved");
		expect(MANUSCRIPT_REVIEW_TARGET.reject).toBe("rejected");
		expect(MANUSCRIPT_REVIEW_TARGET.revise).toBe("revision_requested");
	});

	it("通过后 project 推进至信息补充", () => {
		expect(MANUSCRIPT_APPROVE_PROJECT_FLOW).toEqual([
			"manuscript_approved",
			"info_supplement",
		]);
	});
});
