import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { activity, manuscript, project } from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";

export type MyProposalRecord = {
	id: string;
	title: string;
	status: string;
	activityId: string;
	activityTitle: string;
	createdAt: string;
	manuscriptStatus: string | null;
};

export const Route = createFileRoute("/api/my/proposals")({
	server: {
		handlers: {
			GET: listMyProposals,
		},
	},
});

async function listMyProposals({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}

	const rows = await db
		.select({
			id: project.id,
			title: project.title,
			status: project.status,
			activityId: activity.id,
			activityTitle: activity.title,
			createdAt: project.createdAt,
			manuscriptStatus: manuscript.status,
		})
		.from(project)
		.innerJoin(activity, eq(activity.id, project.activityId))
		.leftJoin(manuscript, eq(manuscript.projectId, project.id))
		.where(eq(project.createdBy, session.user.id))
		.orderBy(desc(project.createdAt));

	return Response.json({
		ok: true,
		proposals: rows.map((row) => ({
			...row,
			createdAt: row.createdAt.toISOString(),
		})),
	});
}
