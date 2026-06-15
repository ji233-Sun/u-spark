import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import {
	activity,
	activityOrganizer,
	manuscript,
	manuscriptVersion,
	project,
} from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import { AccessDeniedError, type Actor } from "#/lib/celebration/access";
import {
	isManuscriptReviewDecision,
	MANUSCRIPT_APPROVE_PROJECT_FLOW,
	MANUSCRIPT_REVIEW_TARGET,
	type ManuscriptReviewDecision,
} from "#/lib/celebration/manuscript";
import { requireActivityManager } from "#/lib/celebration/server-guards";
import {
	assertManuscriptTransition,
	assertProjectTransition,
	InvalidTransitionError,
	type ManuscriptStatus,
	type ProjectStatus,
} from "#/lib/celebration/state-machine";
import { sendMail } from "#/lib/email";
import { signedFileUrl } from "#/lib/storage";

export type OrganizerManuscriptRecord = {
	projectId: string;
	manuscriptId: string;
	projectTitle: string;
	activityId: string;
	activityTitle: string;
	creatorName: string;
	creatorEmail: string;
	version: number;
	coverUrl: string | null;
	driveLink: string | null;
	extractCode: string | null;
	note: string | null;
	submittedAt: string;
};

export const Route = createFileRoute("/api/organizer/manuscripts")({
	server: {
		handlers: {
			GET: listManuscripts,
			POST: reviewManuscript,
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

async function listManuscripts({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const actor = actorFromSession(session.user);

	const baseSelect = {
		projectId: project.id,
		manuscriptId: manuscript.id,
		projectTitle: project.title,
		activityId: activity.id,
		activityTitle: activity.title,
		creatorName: user.name,
		creatorEmail: user.email,
		version: manuscriptVersion.version,
		coverImageUrl: manuscriptVersion.coverImageUrl,
		driveLink: manuscriptVersion.driveLink,
		extractCode: manuscriptVersion.extractCode,
		note: manuscriptVersion.note,
		submittedAt: manuscriptVersion.submittedAt,
	};

	// 待审稿件 = project 在 manuscript_submitted 且 manuscript 主审核态 pending；
	// 取当前版本（version = manuscript.currentVersion）内容。
	const conditions = and(
		eq(project.status, "manuscript_submitted"),
		eq(manuscript.status, "pending"),
		eq(manuscriptVersion.version, manuscript.currentVersion),
	);

	const rows =
		actor.role === "admin"
			? await db
					.select(baseSelect)
					.from(manuscript)
					.innerJoin(project, eq(project.id, manuscript.projectId))
					.innerJoin(activity, eq(activity.id, project.activityId))
					.innerJoin(user, eq(user.id, project.createdBy))
					.innerJoin(
						manuscriptVersion,
						eq(manuscriptVersion.manuscriptId, manuscript.id),
					)
					.where(conditions)
					.orderBy(desc(manuscriptVersion.submittedAt))
			: await db
					.select(baseSelect)
					.from(manuscript)
					.innerJoin(project, eq(project.id, manuscript.projectId))
					.innerJoin(activity, eq(activity.id, project.activityId))
					.innerJoin(user, eq(user.id, project.createdBy))
					.innerJoin(
						manuscriptVersion,
						eq(manuscriptVersion.manuscriptId, manuscript.id),
					)
					.innerJoin(
						activityOrganizer,
						eq(activityOrganizer.activityId, activity.id),
					)
					.where(and(conditions, eq(activityOrganizer.userId, actor.userId)))
					.orderBy(desc(manuscriptVersion.submittedAt));

	const manuscripts: OrganizerManuscriptRecord[] = rows.map((row) => ({
		projectId: row.projectId,
		manuscriptId: row.manuscriptId,
		projectTitle: row.projectTitle,
		activityId: row.activityId,
		activityTitle: row.activityTitle,
		creatorName: row.creatorName,
		creatorEmail: row.creatorEmail,
		version: row.version,
		coverUrl: row.coverImageUrl ? signedFileUrl(row.coverImageUrl) : null,
		driveLink: row.driveLink,
		extractCode: row.extractCode,
		note: row.note,
		submittedAt: row.submittedAt.toISOString(),
	}));

	return Response.json({ ok: true, manuscripts });
}

async function reviewManuscript({ request }: { request: Request }) {
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
	if (!isManuscriptReviewDecision(body?.decision)) {
		return Response.json(
			{ ok: false, error: "审核结果无效。" },
			{ status: 400 },
		);
	}
	const decision: ManuscriptReviewDecision = body.decision;
	const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
	if ((decision === "reject" || decision === "revise") && !reason) {
		return Response.json(
			{ ok: false, error: "请填写拒绝 / 打回理由（对用户可见）。" },
			{ status: 400 },
		);
	}

	const [row] = await db
		.select({
			projectId: project.id,
			projectStatus: project.status,
			projectTitle: project.title,
			activityId: project.activityId,
			creatorEmail: user.email,
			manuscriptId: manuscript.id,
			manuscriptStatus: manuscript.status,
			currentVersion: manuscript.currentVersion,
		})
		.from(manuscript)
		.innerJoin(project, eq(project.id, manuscript.projectId))
		.innerJoin(user, eq(user.id, project.createdBy))
		.where(eq(project.id, projectId))
		.limit(1);

	if (!row) {
		return Response.json({ ok: false, error: "稿件不存在。" }, { status: 404 });
	}

	try {
		await requireActivityManager(actor, row.activityId);
	} catch (err) {
		if (err instanceof AccessDeniedError) {
			return Response.json({ ok: false, error: err.message }, { status: 403 });
		}
		throw err;
	}

	// 仅 manuscript_submitted + pending 可审核（避免对已决态重复操作）。
	if (
		row.projectStatus !== "manuscript_submitted" ||
		row.manuscriptStatus !== "pending"
	) {
		return Response.json(
			{ ok: false, error: "当前稿件状态不可审核。" },
			{ status: 400 },
		);
	}

	const target: ManuscriptStatus = MANUSCRIPT_REVIEW_TARGET[decision];

	try {
		await db.transaction(async (tx) => {
			assertManuscriptTransition(
				row.manuscriptStatus as ManuscriptStatus,
				target,
			);
			// 记录当前版本审核结果（理由对用户可见）。
			await tx
				.update(manuscriptVersion)
				.set({
					status: target,
					reviewReason: reason || null,
					reviewedBy: actor.userId,
					reviewedAt: new Date(),
				})
				.where(
					and(
						eq(manuscriptVersion.manuscriptId, row.manuscriptId),
						eq(manuscriptVersion.version, row.currentVersion),
					),
				);
			await tx
				.update(manuscript)
				.set({ status: target, updatedAt: new Date() })
				.where(eq(manuscript.id, row.manuscriptId));

			// 通过 → 推进主轴至信息补充；拒绝 / 打回主轴不变（可打回重交）。
			if (decision === "approve") {
				let from = row.projectStatus as ProjectStatus;
				for (const next of MANUSCRIPT_APPROVE_PROJECT_FLOW) {
					assertProjectTransition(from, next);
					from = next;
				}
				await tx
					.update(project)
					.set({ status: "info_supplement", updatedAt: new Date() })
					.where(eq(project.id, row.projectId));
			}
		});
	} catch (err) {
		if (err instanceof InvalidTransitionError) {
			return Response.json(
				{ ok: false, error: "当前状态不可审核。" },
				{ status: 400 },
			);
		}
		throw err;
	}

	// 邮件通知创建者。
	if (decision === "approve") {
		await sendMail({
			to: row.creatorEmail,
			template: "manuscript_approved",
			data: { projectTitle: row.projectTitle },
		});
		await sendMail({
			to: row.creatorEmail,
			template: "info_supplement_requested",
			data: { projectTitle: row.projectTitle },
		});
	} else {
		await sendMail({
			to: row.creatorEmail,
			template:
				decision === "reject"
					? "manuscript_rejected"
					: "manuscript_revision_requested",
			data: { projectTitle: row.projectTitle, reason },
		});
	}

	return Response.json({ ok: true, status: target });
}
