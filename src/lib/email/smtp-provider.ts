import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { EmailMessage, EmailProvider, SendResult } from "./provider.ts";

export type SmtpProviderConfig = {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	pass: string;
	from: string;
	replyTo?: string;
};

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
	if (value === undefined || value.trim() === "") return fallback;
	return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function portFromEnv(value: string | undefined): number {
	if (!value) return 465;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return 465;
	return parsed;
}

export function smtpConfigFromEnv(
	env: NodeJS.ProcessEnv = process.env,
): SmtpProviderConfig | null {
	const host = env.SMTP_HOST?.trim();
	const user = env.SMTP_USER?.trim();
	const pass = env.SMTP_PASS?.trim();
	if (!host || !user || !pass) return null;

	const port = portFromEnv(env.SMTP_PORT);
	const secure = boolFromEnv(env.SMTP_SECURE, port === 465);
	const from = env.SMTP_FROM?.trim() || user;
	const replyTo = env.SMTP_REPLY_TO?.trim() || undefined;

	return { host, port, secure, user, pass, from, replyTo };
}

export function createSmtpProvider(config: SmtpProviderConfig): EmailProvider {
	const transportOptions: SMTPTransport.Options = {
		host: config.host,
		port: config.port,
		secure: config.secure,
		auth: {
			user: config.user,
			pass: config.pass,
		},
	};
	const transporter = nodemailer.createTransport(transportOptions);

	return {
		name: "smtp",
		async send(message: EmailMessage): Promise<SendResult> {
			try {
				await transporter.sendMail({
					from: config.from,
					to: message.to,
					replyTo: config.replyTo,
					subject: message.subject,
					text: message.body,
				});
				return { ok: true };
			} catch (error) {
				const detail =
					error instanceof Error ? error.message : "unknown smtp error";
				return { ok: false, error: detail };
			}
		},
	};
}
