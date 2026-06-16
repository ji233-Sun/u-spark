import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, magicLink, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "#/db/index";
import {
	AUTH_MAGIC_LINK_EXPIRES_SECONDS,
	AUTH_OTP_EXPIRES_SECONDS,
	AUTH_PASSWORD_RESET_EXPIRES_SECONDS,
	AUTH_RATE_LIMIT_MAX,
	AUTH_RATE_LIMIT_WINDOW_SECONDS,
} from "./auth-policy.ts";
import { sendMail } from "./email/index.ts";

export const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, { provider: "pg" }),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		autoSignIn: false,
		resetPasswordTokenExpiresIn: AUTH_PASSWORD_RESET_EXPIRES_SECONDS,
		revokeSessionsOnPasswordReset: true,
		async sendResetPassword({ user, url }) {
			await sendMail({
				to: user.email,
				template: "reset_password",
				data: { url },
			});
		},
	},
	emailVerification: {
		sendOnSignUp: false,
		autoSignInAfterVerification: true,
	},
	user: {
		additionalFields: {
			// 角色（RBAC，供 T04 鉴权中间件）；注册时不可自设
			role: {
				type: "string",
				required: false,
				defaultValue: "user",
				input: false,
			},
		},
	},
	// username：双路登录所需（#2 验收 username 唯一约束）
	plugins: [
		username({
			minUsernameLength: 3,
			maxUsernameLength: 30,
		}),
		emailOTP({
			expiresIn: AUTH_OTP_EXPIRES_SECONDS,
			allowedAttempts: AUTH_RATE_LIMIT_MAX,
			storeOTP: "hashed",
			sendVerificationOnSignUp: false,
			overrideDefaultEmailVerification: true,
			rateLimit: {
				window: AUTH_RATE_LIMIT_WINDOW_SECONDS,
				max: AUTH_RATE_LIMIT_MAX,
			},
			async sendVerificationOTP({ email, otp }) {
				await sendMail({
					to: email,
					template: "verify_otp",
					data: { code: otp },
				});
			},
		}),
		magicLink({
			expiresIn: AUTH_MAGIC_LINK_EXPIRES_SECONDS,
			disableSignUp: true,
			storeToken: "hashed",
			rateLimit: {
				window: AUTH_RATE_LIMIT_WINDOW_SECONDS,
				max: AUTH_RATE_LIMIT_MAX,
			},
			async sendMagicLink({ email, url }) {
				await sendMail({
					to: email,
					template: "magic_link",
					data: { url },
				});
			},
		}),
		tanstackStartCookies(),
	],
});
