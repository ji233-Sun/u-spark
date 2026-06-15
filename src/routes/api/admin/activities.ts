import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import { activity, activityOrganizer } from "#/db/celebration-schema";
import { db } from "#/db/index";
import {
	hasConfigErrors,
	validateActivityBasics,
	validateActivitySchedule,
} from "#/lib/celebration/activity-config";
import { adminActor } from "#/lib/celebration/admin-guard";

export type AdminActivityRecord = {
	id: string;
	title: string;
	status: "draft" | "published" | "canceled";
	organizers: string[];
};

export const Route = createFileRoute("/api/admin/activities")({
	server: {
		handlers: {
			GET: listActivities,
			POST: createActivity,
		},
	},
});

async function listActivities({ request }: { request: Request }) {
	const actor = await adminActor(request);
	if (!actor) {
		return Response.json(
			{ ok: false, error: "需要管理员权限。" },
			{ status: 403 },
		);
	}

	const rows = await db
		.select({
			id: activity.id,
			title: activity.title,
			status: activity.status,
			createdAt: activity.createdAt,
			organizerName: user.name,
			organizerEmail: user.email,
		})
		.from(activity)
		.leftJoin(activityOrganizer, eq(activityOrganizer.activityId, activity.id))
		.leftJoin(user, eq(user.id, activityOrganizer.userId))
		.orderBy(desc(activity.createdAt));

	const byId = new Map<string, AdminActivityRecord>();
	for (const row of rows) {
		const rec = byId.get(row.id) ?? {
			id: row.id,
			title: row.title,
			status: row.status as "draft" | "published" | "canceled",
			organizers: [],
		};
		const name = row.organizerName || row.organizerEmail;
		if (name) rec.organizers.push(name);
		byId.set(row.id, rec);
	}
	return Response.json({ ok: true, activities: [...byId.values()] });
}

async function createActivity({ request }: { request: Request }) {
	const actor = await adminActor(request);
	if (!actor) {
		return Response.json(
			{ ok: false, error: "需要管理员权限。" },
			{ status: 403 },
		);
	}
	const body = (await request.json().catch(() => null)) as {
		title?: unknown;
		description?: unknown;
		startAt?: unknown;
		proposalDeadline?: unknown;
		submissionDeadline?: unknown;
		infoSupplementDeadline?: unknown;
	} | null;

	const errors = {
		...validateActivityBasics(body ?? {}),
		...validateActivitySchedule(body ?? {}),
	};
	if (hasConfigErrors(errors)) {
		return Response.json({ ok: false, errors }, { status: 400 });
	}

	const [created] = await db
		.insert(activity)
		.values({
			title: String(body?.title).trim(),
			description:
				typeof body?.description === "string" && body.description.trim()
					? body.description.trim()
					: null,
			status: "draft",
			startAt: new Date(String(body?.startAt)),
			proposalDeadline: new Date(String(body?.proposalDeadline)),
			submissionDeadline: new Date(String(body?.submissionDeadline)),
			infoSupplementDeadline: new Date(String(body?.infoSupplementDeadline)),
			createdBy: actor.userId,
		})
		.returning({ id: activity.id });

	return Response.json({ ok: true, activityId: created.id });
}
