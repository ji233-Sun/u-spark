import { describe, expect, it } from "vitest";
import {
	EMAIL_TEMPLATE_KEYS,
	interpolate,
	isKnownTemplate,
	renderTemplate,
} from "./templates.ts";

describe("邮件模板", () => {
	it("渲染验证码模板", () => {
		const r = renderTemplate("verify_otp", { code: "123456" });
		expect(r.subject).toContain("验证码");
		expect(r.body).toContain("123456");
	});

	it("渲染 24 小时找回密码链接模板", () => {
		const r = renderTemplate("reset_password", { url: "https://example.com" });
		expect(r.subject).toContain("重置密码");
		expect(r.body).toContain("24 小时");
		expect(r.body).toContain("https://example.com");
	});

	it("状态流转模板插入项目名", () => {
		const r = renderTemplate("proposal_approved", { projectTitle: "猫娘企划" });
		expect(r.body).toContain("猫娘企划");
	});

	it("立项回执模板插入活动名与项目名", () => {
		const r = renderTemplate("proposal_receipt", {
			activityTitle: "夏日活动",
			projectTitle: "猫娘企划",
		});
		expect(r.subject).toContain("立项提交回执");
		expect(r.body).toContain("夏日活动");
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

	it("interpolate 按 {key} 占位插值（T28 DB 覆盖模板）", () => {
		expect(
			interpolate("你好 {name}，金额 {amount}", { name: "阿狸", amount: 100 }),
		).toBe("你好 阿狸，金额 100");
		expect(interpolate("缺失 {missing}", {})).toBe("缺失 ");
	});

	it("EMAIL_TEMPLATE_KEYS 含全部内置模板", () => {
		expect(EMAIL_TEMPLATE_KEYS).toContain("proposal_approved");
		expect(EMAIL_TEMPLATE_KEYS).toContain("remuneration_assigned");
	});
});
