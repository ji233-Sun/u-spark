import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import { db } from "#/db/index";
import { adminActor } from "#/lib/celebration/admin-guard";

export type AdminUserRecord = {
	id: string;
	name: string;
	email: string;
	role: "user" | "admin";
};

export const Route = createFileRoute("/api/admin/users")({
	server: {
		handlers: {
			GET: listUsers,
			POST: setRole,
		},
	},
});

async function listUsers({ request }: { request: Request }) {
	const actor = await adminActor(request);
	if (!actor) {
		return Response.json(
			{ ok: false, error: "需要管理员权限。" },
			{ status: 403 },
		);
	}
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
		})
		.from(user)
		.orderBy(desc(user.createdAt))
		.limit(200);
	const users: AdminUserRecord[] = rows.map((r) => ({
		id: r.id,
		name: r.name,
		email: r.email,
		role: r.role === "admin" ? "admin" : "user",
	}));
	return Response.json({ ok: true, users });
}

async function setRole({ request }: { request: Request }) {
	const actor = await adminActor(request);
	if (!actor) {
		return Response.json(
			{ ok: false, error: "需要管理员权限。" },
			{ status: 403 },
		);
	}
	const body = (await request.json().catch(() => null)) as {
		userId?: unknown;
		role?: unknown;
	} | null;
	const userId = typeof body?.userId === "string" ? body.userId : "";
	const role = body?.role === "admin" ? "admin" : "user";

	if (userId === actor.userId && role !== "admin") {
		return Response.json(
			{ ok: false, error: "不可撤销自己的管理员权限（防锁定）。" },
			{ status: 400 },
		);
	}
	if (!userId) {
		return Response.json({ ok: false, error: "用户不存在。" }, { status: 400 });
	}
	await db.update(user).set({ role }).where(eq(user.id, userId));
	return Response.json({ ok: true });
}
