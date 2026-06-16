import { describe, expect, it } from "vitest";
import { smtpConfigFromEnv } from "./smtp-provider.ts";

describe("SMTP 邮件 Provider 配置", () => {
	it("缺少必要配置时不启用 SMTP", () => {
		expect(smtpConfigFromEnv({})).toBeNull();
		expect(
			smtpConfigFromEnv({
				SMTP_HOST: "smtp.example.com",
				SMTP_USER: "sender@example.com",
			}),
		).toBeNull();
	});

	it("从环境变量解析 SMTP 配置", () => {
		expect(
			smtpConfigFromEnv({
				SMTP_HOST: "smtp.example.com",
				SMTP_PORT: "587",
				SMTP_SECURE: "false",
				SMTP_USER: "sender@example.com",
				SMTP_PASS: "secret",
				SMTP_FROM: "U-Spark <sender@example.com>",
				SMTP_REPLY_TO: "reply@example.com",
			}),
		).toEqual({
			host: "smtp.example.com",
			port: 587,
			secure: false,
			user: "sender@example.com",
			pass: "secret",
			from: "U-Spark <sender@example.com>",
			replyTo: "reply@example.com",
		});
	});

	it("默认按 465 端口启用 secure，并用 SMTP_USER 作为发件人", () => {
		expect(
			smtpConfigFromEnv({
				SMTP_HOST: "smtp.example.com",
				SMTP_USER: "sender@example.com",
				SMTP_PASS: "secret",
			}),
		).toMatchObject({
			port: 465,
			secure: true,
			from: "sender@example.com",
		});
	});
});
