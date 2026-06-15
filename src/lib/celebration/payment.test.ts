import { describe, expect, it } from "vitest";
import {
	canAssignRemuneration,
	canUploadPaymentCode,
	isPaymentStatus,
	validateRemunerationAmount,
} from "./payment.ts";

describe("稿酬金额校验", () => {
	it("正数 → 两位小数字符串", () => {
		expect(validateRemunerationAmount(100)).toEqual({
			ok: true,
			amount: "100.00",
		});
		expect(validateRemunerationAmount("88.5")).toEqual({
			ok: true,
			amount: "88.50",
		});
	});

	it("非正数 / 非法值被拒", () => {
		expect(validateRemunerationAmount(0).ok).toBe(false);
		expect(validateRemunerationAmount(-5).ok).toBe(false);
		expect(validateRemunerationAmount("abc").ok).toBe(false);
		expect(validateRemunerationAmount(1e9).ok).toBe(false);
	});
});

describe("稿酬分配资格", () => {
	it("立项通过及之后可分配", () => {
		expect(canAssignRemuneration("proposal_approved")).toBe(true);
		expect(canAssignRemuneration("info_supplement")).toBe(true);
		expect(canAssignRemuneration("completed")).toBe(true);
	});

	it("草稿 / 被拒 / 撤回不可分配", () => {
		expect(canAssignRemuneration("draft")).toBe(false);
		expect(canAssignRemuneration("proposal_rejected")).toBe(false);
		expect(canAssignRemuneration("withdrawn")).toBe(false);
	});
});

describe("发放状态", () => {
	it("识别合法发放状态", () => {
		expect(isPaymentStatus("pending")).toBe(true);
		expect(isPaymentStatus("paid")).toBe(true);
		expect(isPaymentStatus("x")).toBe(false);
	});
});

describe("收款码上传条件", () => {
	it("已核定稿酬且 DDL 未过方可上传", () => {
		expect(canUploadPaymentCode(true, false)).toBe(true);
	});
	it("未核定稿酬不可上传", () => {
		expect(canUploadPaymentCode(false, false)).toBe(false);
	});
	it("信息补充 DDL 后不可上传", () => {
		expect(canUploadPaymentCode(true, true)).toBe(false);
	});
});
