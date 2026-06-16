import { createFileRoute } from "@tanstack/react-router";
import { desc, eq, inArray } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import {
	activity,
	manuscript,
	manuscriptVersion,
	project,
} from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import { AccessDeniedError, type Actor } from "#/lib/celebration/access";
import { requireActivityManager } from "#/lib/celebration/server-guards";
import type {
	ManuscriptStatus,
	ProjectStatus,
} from "#/lib/celebration/state-machine";

export type OrganizerActivityProjectRecord = {
	projectId: string;
	projectTitle: string;
	projectStatus: ProjectStatus;
	creatorName: string;
	creatorEmail: string;
	createdAt: string;
	updatedAt: string;
	manuscriptStatus: ManuscriptStatus | null;
	currentVersion: number | null;
	latestVersion: number | null;
	latestVersionStatus: ManuscriptStatus | null;
	latestSubmittedAt: string | null;
};

export const Route = createFileRoute("/api/organizer/activity-projects")({
	server: {
		handlers: {
			GET: listActivityProjects,
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

async function listActivityProjects({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}

	const activityId = new URL(request.url).searchParams.get("activityId") ?? "";
	const actor = actorFromSession(session.user);
	try {
		await requireActivityManager(actor, activityId);
	} catch (err) {
		if (err instanceof AccessDeniedError) {
			return Response.json({ ok: false, error: err.message }, { status: 403 });
		}
		throw err;
	}

	const [activityRow] = await db
		.select({ id: activity.id })
		.from(activity)
		.where(eq(activity.id, activityId))
		.limit(1);
	if (!activityRow) {
		return Response.json({ ok: false, error: "活动不存在。" }, { status: 404 });
	}

	const rows = await db
		.select({
			projectId: project.id,
			projectTitle: project.title,
			projectStatus: project.status,
			creatorName: user.name,
			creatorEmail: user.email,
			createdAt: project.createdAt,
			updatedAt: project.updatedAt,
			manuscriptId: manuscript.id,
			manuscriptStatus: manuscript.status,
			currentVersion: manuscript.currentVersion,
		})
		.from(project)
		.innerJoin(user, eq(user.id, project.createdBy))
		.leftJoin(manuscript, eq(manuscript.projectId, project.id))
		.where(eq(project.activityId, activityId))
		.orderBy(desc(project.updatedAt));

	const manuscriptIds = rows
		.map((row) => row.manuscriptId)
		.filter((id): id is string => Boolean(id));
	const versionRows =
		manuscriptIds.length > 0
			? await db
					.select({
						manuscriptId: manuscriptVersion.manuscriptId,
						version: manuscriptVersion.version,
						status: manuscriptVersion.status,
						submittedAt: manuscriptVersion.submittedAt,
					})
					.from(manuscriptVersion)
					.where(inArray(manuscriptVersion.manuscriptId, manuscriptIds))
					.orderBy(desc(manuscriptVersion.version))
			: [];

	const latestByManuscriptId = new Map<string, (typeof versionRows)[number]>();
	for (const version of versionRows) {
		if (!latestByManuscriptId.has(version.manuscriptId)) {
			latestByManuscriptId.set(version.manuscriptId, version);
		}
	}

	const projects: OrganizerActivityProjectRecord[] = rows.map((row) => {
		const latest = row.manuscriptId
			? latestByManuscriptId.get(row.manuscriptId)
			: undefined;
		return {
			projectId: row.projectId,
			projectTitle: row.projectTitle,
			projectStatus: row.projectStatus as ProjectStatus,
			creatorName: row.creatorName,
			creatorEmail: row.creatorEmail,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			manuscriptStatus:
				(row.manuscriptStatus as ManuscriptStatus | null) ?? null,
			currentVersion: row.currentVersion,
			latestVersion: latest?.version ?? null,
			latestVersionStatus:
				(latest?.status as ManuscriptStatus | undefined) ?? null,
			latestSubmittedAt: latest?.submittedAt.toISOString() ?? null,
		};
	});

	return Response.json({ ok: true, projects });
}
