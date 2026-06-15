import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "#/db/index";

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "pg" }),
	emailAndPassword: {
		enabled: true,
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
	plugins: [username(), tanstackStartCookies()],
});
