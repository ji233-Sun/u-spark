import { describe, expect, it } from "vitest";
import { isKnownTemplate, renderTemplate } from "./templates.ts";

describe("邮件模板", () => {
	it("渲染验证码模板", () => {
		const r = renderTemplate("verify_otp", { code: "123456" });
		expect(r.subject).toContain("验证码");
		expect(r.body).toContain("123456");
	});

	it("状态流转模板插入项目名", () => {
		const r = renderTemplate("proposal_approved", { projectTitle: "猫娘企划" });
		expect(r.body).toContain("猫娘企划");
	});

	it("缺省 reason 不渲染 undefined", () => {
		const r = renderTemplate("proposal_rejected", { projectTitle: "X" });
		expect(r.body).not.toContain("undefined");
	});

	it("isKnownTemplate 校验 key", () => {
		expect(isKnownTemplate("proposal_approved")).toBe(true);
		expect(isKnownTemplate("not_a_template")).toBe(false);
	});
});
