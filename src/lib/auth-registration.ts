import { and, eq, like, lt } from "drizzle-orm";
import { user, verification } from "#/db/auth-schema.ts";
import { db } from "#/db/index.ts";
import { auth } from "./auth.ts";
import {
	AUTH_OTP_EXPIRES_SECONDS,
	AUTH_RATE_LIMIT_MAX,
	AUTH_RATE_LIMIT_WINDOW_SECONDS,
} from "./auth-policy.ts";
import { sendMail } from "./email/index.ts";
import { RateLimiter } from "./email/rate-limit.ts";

type PendingRegistration = {
	email: string;
	username: string;
};

const PENDING_PREFIX = "pending-registration";
const OTP_PREFIX = "pending-registration-otp";
const registrationLimiter = new RateLimiter({
	windowMs: AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000,
	max: AUTH_RATE_LIMIT_MAX,
});

export type RegistrationResult =
	| { ok: true }
	| { ok: false; status: number; error: string };

export type RegistrationVerifyResult =
	| { ok: true; headers: Headers }
	| { ok: false; status: number; error: string };

export async function beginPendingRegistration(input: {
	email: string;
	username: string;
	password: string;
}): Promise<RegistrationResult> {
	const email = normalizeEmail(input.email);
	const username = input.username.trim();

	if (!isValidEmail(email)) {
		return { ok: false, status: 400, error: "邮箱格式不正确。" };
	}
	if (username.length < 3 || username.length > 30) {
		return { ok: false, status: 400, error: "用户名长度需为 3-30 个字符。" };
	}
	if (input.password.length < 8) {
		return { ok: false, status: 400, error: "密码至少需要 8 位。" };
	}
	if (!registrationLimiter.check(email, Date.now())) {
		return { ok: false, status: 429, error: "操作过于频繁，请稍后再试。" };
	}

	await cleanupExpiredRegistrations();

	const [existingEmail] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, email))
		.limit(1);
	if (existingEmail) {
		return {
			ok: false,
			status: 409,
			error: "邮箱已注册，请直接登录或换一个邮箱。",
		};
	}

	const [existingUsername] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.username, username))
		.limit(1);
	if (existingUsername) {
		return { ok: false, status: 409, error: "用户名已被占用，请换一个。" };
	}

	await db.transaction(async (tx) => {
		await tx
			.delete(verification)
			.where(eq(verification.identifier, pendingIdentifier(email)));
		await tx
			.delete(verification)
			.where(eq(verification.identifier, otpIdentifier(email)));
		await tx.insert(verification).values({
			id: crypto.randomUUID(),
			identifier: pendingIdentifier(email),
			value: JSON.stringify({ email, username }),
			expiresAt: expiresAt(),
		});
	});

	const otp = generateOtp();
	await db.insert(verification).values({
		id: crypto.randomUUID(),
		identifier: otpIdentifier(email),
		value: otp,
		expiresAt: expiresAt(),
	});
	await sendMail({
		to: email,
		template: "verify_otp",
		data: { code: otp },
	});

	return { ok: true };
}

export async function verifyPendingRegistration(input: {
	email: string;
	otp: string;
	password: string;
	request: Request;
}): Promise<RegistrationVerifyResult> {
	const email = normalizeEmail(input.email);
	const otp = input.otp.trim();
	const pending = await pendingRegistration(email);
	if (!pending) {
		return {
			ok: false,
			status: 400,
			error: "验证码无效或已过期，请重新注册。",
		};
	}

	const otpRow = await currentVerification(otpIdentifier(email));
	if (!otpRow || otpRow.value !== otp) {
		return {
			ok: false,
			status: 400,
			error: "验证码无效或已过期，请重新获取。",
		};
	}

	const origin = authOrigin(input.request);
	const signUpResponse = await auth.handler(
		new Request(new URL("/api/auth/sign-up/email", input.request.url), {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin,
				"x-u-spark-verified-registration": process.env.BETTER_AUTH_SECRET ?? "",
			},
			body: JSON.stringify({
				email,
				password: input.password,
				name: pending.username,
				username: pending.username,
				displayUsername: pending.username,
				callbackURL: "/dashboard",
			}),
		}),
	);

	if (!signUpResponse.ok) {
		return await signUpError(signUpResponse);
	}

	await db.transaction(async (tx) => {
		const [created] = await tx
			.update(user)
			.set({ emailVerified: true })
			.where(eq(user.email, email))
			.returning({ id: user.id });
		if (!created) {
			throw new Error("FAILED_TO_CREATE_USER");
		}
		await tx
			.delete(verification)
			.where(eq(verification.identifier, pendingIdentifier(email)));
		await tx
			.delete(verification)
			.where(eq(verification.identifier, otpIdentifier(email)));
	});

	const signInResponse = await auth.handler(
		new Request(new URL("/api/auth/sign-in/email", input.request.url), {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin,
			},
			body: JSON.stringify({
				email,
				password: input.password,
				callbackURL: "/dashboard",
			}),
		}),
	);

	if (!signInResponse.ok) {
		return {
			ok: false,
			status: 500,
			error: "账号已创建，请返回登录页手动登录。",
		};
	}

	return { ok: true, headers: authCookieHeaders(signInResponse.headers) };
}

export function isVerifiedRegistrationRequest(request: Request): boolean {
	const secret = process.env.BETTER_AUTH_SECRET;
	return (
		!!secret &&
		request.headers.get("x-u-spark-verified-registration") === secret
	);
}

async function cleanupExpiredRegistrations() {
	await db
		.delete(verification)
		.where(
			and(
				lt(verification.expiresAt, new Date()),
				like(verification.identifier, `${PENDING_PREFIX}:%`),
			),
		);
}

async function currentVerification(identifier: string) {
	const [row] = await db
		.select()
		.from(verification)
		.where(eq(verification.identifier, identifier))
		.limit(1);
	if (!row || row.expiresAt < new Date()) {
		await db
			.delete(verification)
			.where(eq(verification.identifier, identifier));
		return null;
	}
	return row;
}

async function pendingRegistration(
	email: string,
): Promise<PendingRegistration | null> {
	const row = await currentVerification(pendingIdentifier(email));
	if (!row) return null;
	try {
		const parsed = JSON.parse(row.value) as PendingRegistration;
		if (parsed.email !== email) return null;
		return parsed;
	} catch {
		return null;
	}
}

async function signUpError(
	response: Response,
): Promise<RegistrationVerifyResult> {
	const text = await response.text().catch(() => "");
	if (text.includes("USERNAME_IS_ALREADY_TAKEN")) {
		return { ok: false, status: 409, error: "用户名已被占用，请换一个。" };
	}
	if (text.includes("USER_ALREADY_EXISTS") || text.includes("already exists")) {
		return {
			ok: false,
			status: 409,
			error: "邮箱已注册，请直接登录或换一个邮箱。",
		};
	}
	return { ok: false, status: 500, error: "注册失败，请稍后重试。" };
}

function pendingIdentifier(email: string) {
	return `${PENDING_PREFIX}:${email}`;
}

function otpIdentifier(email: string) {
	return `${OTP_PREFIX}:${email}`;
}

function expiresAt() {
	return new Date(Date.now() + AUTH_OTP_EXPIRES_SECONDS * 1000);
}

function generateOtp() {
	return crypto
		.getRandomValues(new Uint32Array(1))[0]
		.toString()
		.padStart(6, "0")
		.slice(-6);
}

function authCookieHeaders(source: Headers) {
	const headers = new Headers();
	const getSetCookie = (
		source as Headers & { getSetCookie?: () => string[] }
	).getSetCookie?.();
	if (getSetCookie) {
		for (const cookie of getSetCookie) headers.append("set-cookie", cookie);
		return headers;
	}
	const cookie = source.get("set-cookie");
	if (cookie) headers.append("set-cookie", cookie);
	return headers;
}

function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function authOrigin(request: Request) {
	return new URL(process.env.BETTER_AUTH_URL ?? request.url).origin;
}
