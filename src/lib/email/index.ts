import { eq } from "drizzle-orm";
import { emailLog, emailTemplate } from "#/db/celebration-schema";
import { db } from "#/db/index";
import { consoleProvider, type EmailProvider } from "./provider.ts";
import { RateLimiter } from "./rate-limit.ts";
import { createSmtpProvider, smtpConfigFromEnv } from "./smtp-provider.ts";
import {
	type EmailTemplate,
	type EmailTemplateData,
	interpolate,
	type RenderedEmail,
	renderTemplate,
} from "./templates.ts";

// 解析模板：优先用管理员维护的 DB 覆盖（{占位}插值），否则回退内置注册表（T28）。
async function resolveTemplate(
	template: EmailTemplate,
	data: EmailTemplateData,
): Promise<RenderedEmail> {
	const [override] = await db
		.select({ subject: emailTemplate.subject, body: emailTemplate.body })
		.from(emailTemplate)
		.where(eq(emailTemplate.templateKey, template))
		.limit(1);
	if (override) {
		return {
			subject: interpolate(override.subject, data),
			body: interpolate(override.body, data),
		};
	}
	return renderTemplate(template, data);
}

// 邮件统一入口（T05 #5）：渲染模板 → 限频 → 发送（带重试）→ 写 email_log。

// 默认 provider = console（dev）；配置 SMTP_* 后自动外发。测试/生产也可用 setMailProvider 注入。
const smtpConfig = smtpConfigFromEnv();
let provider: EmailProvider = smtpConfig
	? createSmtpProvider(smtpConfig)
	: consoleProvider;
export function setMailProvider(p: EmailProvider): void {
	provider = p;
}

// 默认限频：同一收件人 5 分钟最多 5 封（防爆破）。
const limiter = new RateLimiter({ windowMs: 5 * 60_000, max: 5 });
const MAX_RETRY = 2;

export type SendMailOptions = {
	to: string;
	template: EmailTemplate;
	data?: EmailTemplateData;
	now?: number; // 便于测试注入时间
};

export async function sendMail(
	opts: SendMailOptions,
): Promise<{ ok: boolean }> {
	const now = opts.now ?? Date.now();
	const { to, template, data = {} } = opts;

	// 限频（防枚举 / 爆破）：超限直接记日志并拒绝。
	if (!limiter.check(to, now)) {
		await db.insert(emailLog).values({
			toEmail: to,
			template,
			status: "failed",
			error: "rate_limited",
		});
		return { ok: false };
	}

	const { subject, body } = await resolveTemplate(template, data);

	// 入队日志（queued）。
	const [log] = await db
		.insert(emailLog)
		.values({ toEmail: to, template, subject, status: "queued" })
		.returning({ id: emailLog.id });

	// 发送 + 失败重试。
	let lastError = "unknown";
	for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
		const result = await provider.send({ to, subject, body });
		if (result.ok) {
			await db
				.update(emailLog)
				.set({ status: "sent", sentAt: new Date() })
				.where(eq(emailLog.id, log.id));
			return { ok: true };
		}
		lastError = result.error;
	}

	// 全部重试失败 → 降级标记 failed（不抛错，避免阻断主流程）。
	await db
		.update(emailLog)
		.set({ status: "failed", error: lastError })
		.where(eq(emailLog.id, log.id));
	return { ok: false };
}

export type { EmailMessage, EmailProvider, SendResult } from "./provider.ts";
export { consoleProvider } from "./provider.ts";
export type { EmailTemplate } from "./templates.ts";
export { isKnownTemplate, renderTemplate } from "./templates.ts";
