import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, inArray } from "drizzle-orm";
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
	manuscriptReviewKind,
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
	isResubmitCopy: boolean; // T23：信息补充阶段的重提副本
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
		projectStatus: project.status,
		currentVersion: manuscript.currentVersion,
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

	// 待审 = 存在 pending 版本（涵盖首次提交、被拒重提、T23 信息补充副本），
	// 限定项目处于稿件提交 / 信息补充阶段。
	const conditions = and(
		eq(manuscriptVersion.status, "pending"),
		inArray(project.status, ["manuscript_submitted", "info_supplement"]),
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
		isResubmitCopy:
			row.projectStatus === "info_supplement" &&
			row.version > row.currentVersion,
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

	// 取当前 pending 版本（首次/重提/副本统一以版本为审核单元）。
	const [pending] = await db
		.select({ id: manuscriptVersion.id, version: manuscriptVersion.version })
		.from(manuscriptVersion)
		.where(
			and(
				eq(manuscriptVersion.manuscriptId, row.manuscriptId),
				eq(manuscriptVersion.status, "pending"),
			),
		)
		.orderBy(desc(manuscriptVersion.version))
		.limit(1);
	if (!pending) {
		return Response.json(
			{ ok: false, error: "无待审核版本。" },
			{ status: 400 },
		);
	}

	const kind = manuscriptReviewKind(
		row.projectStatus as ProjectStatus,
		pending.version,
		row.currentVersion,
	);
	if (!kind) {
		return Response.json(
			{ ok: false, error: "当前稿件状态不可审核。" },
			{ status: 400 },
		);
	}

	const target: ManuscriptStatus = MANUSCRIPT_REVIEW_TARGET[decision];

	try {
		await db.transaction(async (tx) => {
			assertManuscriptTransition("pending", target);
			// 记录被审版本结果（理由对用户可见）。
			await tx
				.update(manuscriptVersion)
				.set({
					status: target,
					reviewReason: reason || null,
					reviewedBy: actor.userId,
					reviewedAt: new Date(),
				})
				.where(eq(manuscriptVersion.id, pending.id));

			if (kind === "initial") {
				// 首次审核：联动 manuscript 主审核态 + 主轴。
				await tx
					.update(manuscript)
					.set({ status: target, updatedAt: new Date() })
					.where(eq(manuscript.id, row.manuscriptId));
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
			} else if (decision === "approve") {
				// T23 副本通过：替换提交信息（指向新版本），主审核态 / 主轴不变。
				await tx
					.update(manuscript)
					.set({ currentVersion: pending.version, updatedAt: new Date() })
					.where(eq(manuscript.id, row.manuscriptId));
			}
			// T23 副本拒绝 / 打回：仅版本记拒，保持原过审态（manuscript 不变）。
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
		if (kind === "initial") {
			await sendMail({
				to: row.creatorEmail,
				template: "info_supplement_requested",
				data: { projectTitle: row.projectTitle },
			});
		}
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

	return Response.json({ ok: true, status: target, kind });
}
