import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import { activity, activityOrganizer, project } from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import { AccessDeniedError, type Actor } from "#/lib/celebration/access";
import { requireActivityManager } from "#/lib/celebration/server-guards";
import {
	assertProjectTransition,
	InvalidTransitionError,
	type ProjectStatus,
} from "#/lib/celebration/state-machine";
import { sendMail } from "#/lib/email";

export type OrganizerProposalRecord = {
	id: string;
	title: string;
	status: ProjectStatus;
	activityId: string;
	activityTitle: string;
	creatorName: string;
	creatorEmail: string;
	createdAt: string;
};

export const Route = createFileRoute("/api/organizer/proposals")({
	server: {
		handlers: {
			GET: listOrganizerProposals,
			POST: reviewProposal,
		},
	},
});

function actorFromSession(sessionUser: {
	id: string;
	role?: string | null;
}): Actor {
	return {
		userId: sessionUser.id,
		role: sessionUser.role === "admin" ? "admin" : "user",
	};
}

async function listOrganizerProposals({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}

	const actor = actorFromSession(session.user);
	const baseSelect = {
		id: project.id,
		title: project.title,
		status: project.status,
		activityId: activity.id,
		activityTitle: activity.title,
		creatorName: user.name,
		creatorEmail: user.email,
		createdAt: project.createdAt,
	};

	const rows =
		actor.role === "admin"
			? await db
					.select(baseSelect)
					.from(project)
					.innerJoin(activity, eq(activity.id, project.activityId))
					.innerJoin(user, eq(user.id, project.createdBy))
					.where(eq(project.status, "proposal_submitted"))
					.orderBy(desc(project.createdAt))
			: await db
					.select(baseSelect)
					.from(project)
					.innerJoin(activity, eq(activity.id, project.activityId))
					.innerJoin(user, eq(user.id, project.createdBy))
					.innerJoin(
						activityOrganizer,
						eq(activityOrganizer.activityId, activity.id),
					)
					.where(
						and(
							eq(project.status, "proposal_submitted"),
							eq(activityOrganizer.userId, actor.userId),
						),
					)
					.orderBy(desc(project.createdAt));

	return Response.json({
		ok: true,
		proposals: rows.map((row) => ({
			...row,
			createdAt: row.createdAt.toISOString(),
		})),
	});
}

async function reviewProposal({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const actor = actorFromSession(session.user);

	const body = (await request.json().catch(() => null)) as {
		projectId?: unknown;
		decision?: unknown;
		reason?: unknown;
	} | null;
	const projectId = typeof body?.projectId === "string" ? body.projectId : "";
	if (body?.decision !== "approve" && body?.decision !== "reject") {
		return Response.json(
			{ ok: false, error: "审核结果无效。" },
			{ status: 400 },
		);
	}
	const decision = body.decision;
	const reason = typeof body?.reason === "string" ? body.reason : "";

	const [row] = await db
		.select({
			id: project.id,
			title: project.title,
			status: project.status,
			activityId: project.activityId,
			creatorEmail: user.email,
		})
		.from(project)
		.innerJoin(user, eq(user.id, project.createdBy))
		.where(eq(project.id, projectId))
		.limit(1);

	if (!row) {
		return Response.json({ ok: false, error: "立项不存在。" }, { status: 404 });
	}

	try {
		await requireActivityManager(actor, row.activityId);
	} catch (err) {
		if (err instanceof AccessDeniedError) {
			return Response.json({ ok: false, error: err.message }, { status: 403 });
		}
		throw err;
	}

	const nextStatus: ProjectStatus =
		decision === "approve" ? "proposal_approved" : "proposal_rejected";
	try {
		assertProjectTransition(row.status as ProjectStatus, nextStatus);
	} catch (err) {
		if (err instanceof InvalidTransitionError) {
			return Response.json(
				{ ok: false, error: "当前状态不可审核。" },
				{ status: 400 },
			);
		}
		throw err;
	}

	await db
		.update(project)
		.set({ status: nextStatus })
		.where(eq(project.id, row.id));

	await sendMail({
		to: row.creatorEmail,
		template:
			decision === "approve" ? "proposal_approved" : "proposal_rejected",
		data: { projectTitle: row.title, reason },
	});

	return Response.json({ ok: true, status: nextStatus });
}
