import { describe, expect, it } from "vitest";
import {
	canManageAuthors,
	hasAuthorErrors,
	validateAuthorInput,
	validateShippingAddress,
} from "./authors.ts";

describe("作者信息校验", () => {
	it("昵称必填", () => {
		expect(validateAuthorInput({}).displayName).toBeDefined();
		expect(
			hasAuthorErrors(
				validateAuthorInput({
					displayName: "阿狸",
					bilibiliUid: "12345",
					duty: "剪辑",
				}),
			),
		).toBe(false);
	});

	it("B站 UID 必填且须为纯数字", () => {
		expect(
			validateAuthorInput({ displayName: "阿狸" }).bilibiliUid,
		).toBeDefined();
		expect(
			validateAuthorInput({ displayName: "阿狸", bilibiliUid: "abc" })
				.bilibiliUid,
		).toBeDefined();
		expect(
			hasAuthorErrors(
				validateAuthorInput({
					displayName: "阿狸",
					bilibiliUid: "12345",
					duty: "剪辑",
				}),
			),
		).toBe(false);
	});

	it("职能必填且限长", () => {
		expect(validateAuthorInput({ displayName: "阿狸" }).duty).toBeDefined();
		expect(
			validateAuthorInput({ displayName: "阿狸", duty: "x".repeat(51) }).duty,
		).toBeDefined();
	});
});

describe("收货地址校验", () => {
	it("收件人 / 电话 / 地址必填", () => {
		const errors = validateShippingAddress({});
		expect(errors.recipientName).toBeDefined();
		expect(errors.phone).toBeDefined();
		expect(errors.address).toBeDefined();
	});

	it("电话格式校验", () => {
		expect(
			validateShippingAddress({
				recipientName: "张三",
				phone: "abc",
				address: "某地",
			}).phone,
		).toBeDefined();
		expect(
			hasAuthorErrors(
				validateShippingAddress({
					recipientName: "张三",
					phone: "13800138000",
					address: "某地某街 1 号",
				}),
			),
		).toBe(false);
	});
});

describe("作者管理窗口", () => {
	it("仅信息补充 DDL 前可管理", () => {
		expect(canManageAuthors("info_supplement", false)).toBe(true);
		expect(canManageAuthors("proposal_approved", false)).toBe(false);
		expect(canManageAuthors("manuscript_approved", false)).toBe(false);
		expect(canManageAuthors("completed", false)).toBe(false);
	});

	it("DDL 后关闭", () => {
		expect(canManageAuthors("info_supplement", true)).toBe(false);
	});

	it("已撤回不可管理", () => {
		expect(canManageAuthors("withdrawn", false)).toBe(false);
	});
});
