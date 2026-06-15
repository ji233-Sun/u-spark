import { describe, expect, it } from "vitest";
import {
	AUTH_MAGIC_LINK_EXPIRES_SECONDS,
	AUTH_OTP_EXPIRES_SECONDS,
	AUTH_PASSWORD_RESET_EXPIRES_SECONDS,
	AUTH_RATE_LIMIT_MAX,
	AUTH_RATE_LIMIT_WINDOW_SECONDS,
	isEmailIdentifier,
	MAGIC_LINK_SENT_MESSAGE,
	PASSWORD_LOGIN_ERROR,
	PASSWORD_RESET_SENT_MESSAGE,
} from "./auth-policy.ts";

describe("认证策略", () => {
	it("OTP 与魔法链接均为 5 分钟有效期", () => {
		expect(AUTH_OTP_EXPIRES_SECONDS).toBe(300);
		expect(AUTH_MAGIC_LINK_EXPIRES_SECONDS).toBe(300);
	});

	it("找回密码链接为 24 小时有效期", () => {
		expect(AUTH_PASSWORD_RESET_EXPIRES_SECONDS).toBe(86_400);
	});

	it("认证接口带固定窗口限频", () => {
		expect(AUTH_RATE_LIMIT_WINDOW_SECONDS).toBe(60);
		expect(AUTH_RATE_LIMIT_MAX).toBe(3);
	});

	it("密码登录支持用户名或邮箱入口", () => {
		expect(isEmailIdentifier("alice@example.com")).toBe(true);
		expect(isEmailIdentifier("alice")).toBe(false);
	});

	it("登录失败与魔法链接发送使用防枚举提示", () => {
		expect(PASSWORD_LOGIN_ERROR).not.toContain("不存在");
		expect(MAGIC_LINK_SENT_MESSAGE).toContain("如果账号存在");
		expect(PASSWORD_RESET_SENT_MESSAGE).toContain("如果账号存在");
	});
});
