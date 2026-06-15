import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import { activityOrganizer } from "#/db/celebration-schema";
import { db } from "#/db/index";
import { adminActor } from "#/lib/celebration/admin-guard";

export const Route = createFileRoute("/api/admin/organizers")({
	server: {
		handlers: {
			POST: manageOrganizer,
		},
	},
});

async function manageOrganizer({ request }: { request: Request }) {
	const actor = await adminActor(request);
	if (!actor) {
		return Response.json(
			{ ok: false, error: "需要管理员权限。" },
			{ status: 403 },
		);
	}
	const body = (await request.json().catch(() => null)) as {
		activityId?: unknown;
		email?: unknown;
		action?: unknown;
	} | null;
	const activityId =
		typeof body?.activityId === "string" ? body.activityId : "";
	const email = typeof body?.email === "string" ? body.email.trim() : "";
	const action = body?.action === "remove" ? "remove" : "add";
	if (!activityId || !email) {
		return Response.json(
			{ ok: false, error: "活动与组织者邮箱均为必填。" },
			{ status: 400 },
		);
	}

	const [target] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, email))
		.limit(1);
	if (!target) {
		return Response.json(
			{ ok: false, error: "该邮箱对应的用户不存在。" },
			{ status: 404 },
		);
	}

	if (action === "remove") {
		await db
			.delete(activityOrganizer)
			.where(
				and(
					eq(activityOrganizer.activityId, activityId),
					eq(activityOrganizer.userId, target.id),
				),
			);
		return Response.json({ ok: true });
	}

	await db
		.insert(activityOrganizer)
		.values({ activityId, userId: target.id, assignedBy: actor.userId })
		.onConflictDoNothing();
	return Response.json({ ok: true });
}
