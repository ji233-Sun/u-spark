import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { activity, activityOrganizer } from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";

export type OrganizerActivityRecord = {
	id: string;
	title: string;
	status: "draft" | "published" | "canceled";
	proposalDeadline: string;
	submissionDeadline: string;
	infoSupplementDeadline: string;
};

export const Route = createFileRoute("/api/organizer/activities")({
	server: {
		handlers: {
			GET: listManagedActivities,
		},
	},
});

async function listManagedActivities({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const isAdmin = session.user.role === "admin";

	const baseSelect = {
		id: activity.id,
		title: activity.title,
		status: activity.status,
		proposalDeadline: activity.proposalDeadline,
		submissionDeadline: activity.submissionDeadline,
		infoSupplementDeadline: activity.infoSupplementDeadline,
	};

	const rows = isAdmin
		? await db
				.select(baseSelect)
				.from(activity)
				.orderBy(desc(activity.createdAt))
		: await db
				.select(baseSelect)
				.from(activity)
				.innerJoin(
					activityOrganizer,
					eq(activityOrganizer.activityId, activity.id),
				)
				.where(eq(activityOrganizer.userId, session.user.id))
				.orderBy(desc(activity.createdAt));

	const activities: OrganizerActivityRecord[] = rows.map((row) => ({
		id: row.id,
		title: row.title,
		status: row.status as "draft" | "published" | "canceled",
		proposalDeadline: row.proposalDeadline.toISOString(),
		submissionDeadline: row.submissionDeadline.toISOString(),
		infoSupplementDeadline: row.infoSupplementDeadline.toISOString(),
	}));

	return Response.json({ ok: true, activities });
}
