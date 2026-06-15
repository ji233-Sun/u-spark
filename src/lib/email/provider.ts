// 邮件 Provider 抽象（T05 #5）：依赖倒置——dev 用 console，生产注入 SMTP / Resend。
export type EmailMessage = {
	to: string;
	subject: string;
	body: string;
};

export type SendResult = { ok: true } | { ok: false; error: string };

export interface EmailProvider {
	readonly name: string;
	send(message: EmailMessage): Promise<SendResult>;
}

// 开发环境 provider：打印到控制台，不真正外发。
export const consoleProvider: EmailProvider = {
	name: "console",
	async send(message) {
		console.info(
			`[email:console] → ${message.to} | ${message.subject}\n${message.body}`,
		);
		return { ok: true };
	},
};
