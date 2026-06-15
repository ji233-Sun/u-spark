import { createMiddleware } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { activityOrganizer } from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import {
	type Actor,
	assertCanManageActivity,
	requireAdmin,
	requireUser,
	type Role,
} from "./access.ts";

// RBAC 集成层（T04 #4）：把 better-auth 会话翻成 Actor，封装为可复用的
// server function 守卫 middleware + 数据级活动管理校验。

function toActor(
	user: { id: string; role?: string | null } | undefined | null,
): Actor | null {
	if (!user) {
		return null;
	}
	const role: Role = user.role === "admin" ? "admin" : "user";
	return { userId: user.id, role };
}

// 注入 actor（可选登录）到 context；不强制登录，供公开 / 半公开接口读取身份。
export const actorMiddleware = createMiddleware().server(
	async ({ next, request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		return next({ context: { actor: toActor(session?.user) } });
	},
);

// 必须登录：未登录抛 UnauthenticatedError。
export const authedMiddleware = createMiddleware()
	.middleware([actorMiddleware])
	.server(async ({ next, context }) => {
		return next({ context: { actor: requireUser(context.actor) } });
	});

// 必须管理员：普通用户 / 未登录被拒。
export const adminMiddleware = createMiddleware()
	.middleware([actorMiddleware])
	.server(async ({ next, context }) => {
		return next({ context: { actor: requireAdmin(context.actor) } });
	});

// 数据级：该 user 是否为 activityId 的组织者。
export async function isActivityOrganizer(
	userId: string,
	activityId: string,
): Promise<boolean> {
	const row = await db.query.activityOrganizer.findFirst({
		columns: { id: true },
		where: and(
			eq(activityOrganizer.userId, userId),
			eq(activityOrganizer.activityId, activityId),
		),
	});
	return row !== undefined;
}

// 数据级越权防护：要求是该活动组织者或 admin（含数据导出等敏感操作前置）。
export async function requireActivityManager(
	actor: Actor,
	activityId: string,
): Promise<void> {
	if (actor.role === "admin") {
		return;
	}
	assertCanManageActivity(
		actor,
		await isActivityOrganizer(actor.userId, activityId),
	);
}
