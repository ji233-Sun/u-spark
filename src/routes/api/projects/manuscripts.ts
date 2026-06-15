import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
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
import {
	canSubmitSupplementCopy,
	hasManuscriptErrors,
	manuscriptSubmitMode,
	nextManuscriptVersion,
	validateManuscriptSubmission,
} from "#/lib/celebration/manuscript";
import {
	assertManuscriptTransition,
	assertProjectTransition,
	effectiveDeadline,
	InvalidTransitionError,
	isOverdue,
	type ManuscriptStatus,
	type ProjectStatus,
} from "#/lib/celebration/state-machine";
import { sendMail } from "#/lib/email";
import { signedFileUrl } from "#/lib/storage";

export type ManuscriptDetail = {
	projectId: string;
	projectTitle: string;
	activityId: string;
	activityTitle: string;
	projectStatus: ProjectStatus;
	manuscriptStatus: ManuscriptStatus | null;
	currentVersion: number;
	deadline: string;
	submitMode: ReturnType<typeof manuscriptSubmitMode>;
	canSubmit: boolean;
	copyUnderReview: boolean;
	latest: {
		version: number;
		coverUrl: string | null;
		driveLink: string | null;
		extractCode: string | null;
		note: string | null;
		status: ManuscriptStatus;
		reviewReason: string | null;
		submittedAt: string;
	} | null;
};

export const Route = createFileRoute("/api/projects/manuscripts")({
	server: {
		handlers: {
			GET: getManuscriptDetail,
			POST: submitManuscript,
		},
	},
});

// 取项目 + 活动（含两类相关 DDL），owner 限定。
async function loadProjectForOwner(projectId: string, userId: string) {
	const [row] = await db
		.select({
			id: project.id,
			title: project.title,
			status: project.status,
			createdBy: project.createdBy,
			activityId: activity.id,
			activityTitle: activity.title,
			submissionDeadline: activity.submissionDeadline,
			specialSubmissionDeadline: project.specialSubmissionDeadline,
			infoSupplementDeadline: activity.infoSupplementDeadline,
			specialInfoSupplementDeadline: project.specialInfoSupplementDeadline,
		})
		.from(project)
		.innerJoin(activity, eq(activity.id, project.activityId))
		.where(eq(project.id, projectId))
		.limit(1);
	if (!row) return { row: null, owned: false };
	return { row, owned: row.createdBy === userId };
}

async function loadManuscriptState(projectId: string) {
	const [ms] = await db
		.select({
			id: manuscript.id,
			status: manuscript.status,
			currentVersion: manuscript.currentVersion,
		})
		.from(manuscript)
		.where(eq(manuscript.projectId, projectId))
		.limit(1);
	if (!ms) return { ms: null, latest: null };
	const [latest] = await db
		.select()
		.from(manuscriptVersion)
		.where(eq(manuscriptVersion.manuscriptId, ms.id))
		.orderBy(desc(manuscriptVersion.version))
		.limit(1);
	return { ms, latest: latest ?? null };
}

async function getManuscriptDetail({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
	const { row, owned } = await loadProjectForOwner(projectId, session.user.id);
	if (!row) {
		return Response.json({ ok: false, error: "立项不存在。" }, { status: 404 });
	}
	if (!owned) {
		return Response.json({ ok: false, error: "无权访问。" }, { status: 403 });
	}

	const { ms, latest } = await loadManuscriptState(projectId);
	const projectStatus = row.status as ProjectStatus;
	const manuscriptStatus = (ms?.status as ManuscriptStatus | null) ?? null;
	const currentVersion = ms?.currentVersion ?? 0;
	const mode = manuscriptSubmitMode(projectStatus, manuscriptStatus);

	// 审核中的重提副本：info_supplement 阶段、最新版本高于过审版本且仍 pending。
	const copyUnderReview =
		projectStatus === "info_supplement" &&
		latest !== null &&
		latest.status === "pending" &&
		latest.version > currentVersion;

	// 不同阶段受不同 DDL 约束。
	const deadline =
		mode === "supplement_copy"
			? effectiveDeadline(
					row.infoSupplementDeadline,
					row.specialInfoSupplementDeadline,
				)
			: effectiveDeadline(
					row.submissionDeadline,
					row.specialSubmissionDeadline,
				);
	const overdue = isOverdue(deadline, new Date());

	const canSubmit =
		mode === "supplement_copy"
			? canSubmitSupplementCopy(projectStatus, copyUnderReview) && !overdue
			: (mode === "initial" || mode === "resubmit") && !overdue;

	const detail: ManuscriptDetail = {
		projectId: row.id,
		projectTitle: row.title,
		activityId: row.activityId,
		activityTitle: row.activityTitle,
		projectStatus,
		manuscriptStatus,
		currentVersion,
		deadline: deadline.toISOString(),
		submitMode: mode,
		canSubmit,
		copyUnderReview,
		latest: latest
			? {
					version: latest.version,
					coverUrl: latest.coverImageUrl
						? signedFileUrl(latest.coverImageUrl)
						: null,
					driveLink: latest.driveLink,
					extractCode: latest.extractCode,
					note: latest.note,
					status: latest.status as ManuscriptStatus,
					reviewReason: latest.reviewReason,
					submittedAt: latest.submittedAt.toISOString(),
				}
			: null,
	};
	return Response.json({ ok: true, detail });
}

async function submitManuscript({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}

	const body = (await request.json().catch(() => null)) as {
		projectId?: unknown;
		coverImageKey?: unknown;
		driveLink?: unknown;
		extractCode?: unknown;
		note?: unknown;
	} | null;
	const projectId = typeof body?.projectId === "string" ? body.projectId : "";
	if (!projectId) {
		return Response.json({ ok: false, error: "立项不存在。" }, { status: 400 });
	}

	const { row, owned } = await loadProjectForOwner(projectId, session.user.id);
	if (!row) {
		return Response.json({ ok: false, error: "立项不存在。" }, { status: 404 });
	}
	if (!owned) {
		return Response.json(
			{ ok: false, error: "仅立项创建者可提交稿件。" },
			{ status: 403 },
		);
	}

	const { ms, latest } = await loadManuscriptState(projectId);
	const projectStatus = row.status as ProjectStatus;
	const mode = manuscriptSubmitMode(
		projectStatus,
		(ms?.status as ManuscriptStatus | null) ?? null,
	);
	if (mode === "blocked") {
		return Response.json(
			{ ok: false, error: "当前状态不可提交稿件。" },
			{ status: 400 },
		);
	}

	// T23：信息补充阶段已有 pending 副本在审核时，不可再次重交（避免堆叠）。
	const copyUnderReview =
		mode === "supplement_copy" &&
		latest !== null &&
		latest.status === "pending" &&
		latest.version > (ms?.currentVersion ?? 0);
	if (copyUnderReview) {
		return Response.json(
			{ ok: false, error: "已有重交副本在审核中，请等待结果。" },
			{ status: 409 },
		);
	}

	// DDL 守卫：首次/重提受稿件提交 DDL，重提副本受信息补充 DDL（均取 effective = max）。
	const deadline =
		mode === "supplement_copy"
			? effectiveDeadline(
					row.infoSupplementDeadline,
					row.specialInfoSupplementDeadline,
				)
			: effectiveDeadline(
					row.submissionDeadline,
					row.specialSubmissionDeadline,
				);
	if (isOverdue(deadline, new Date())) {
		return Response.json(
			{
				ok: false,
				error:
					mode === "supplement_copy" ? "信息补充已截止。" : "稿件提交已截止。",
			},
			{ status: 400 },
		);
	}

	const errors = validateManuscriptSubmission({
		coverImageKey: body?.coverImageKey,
		driveLink: body?.driveLink,
		extractCode: body?.extractCode,
	});
	if (hasManuscriptErrors(errors)) {
		return Response.json({ ok: false, errors }, { status: 400 });
	}

	const coverImageUrl = String(body?.coverImageKey).trim();
	const driveLink = String(body?.driveLink).trim();
	const extractCode =
		typeof body?.extractCode === "string" && body.extractCode.trim()
			? body.extractCode.trim()
			: null;
	const note =
		typeof body?.note === "string" && body.note.trim()
			? body.note.trim()
			: null;

	try {
		await db.transaction(async (tx) => {
			if (mode === "initial") {
				const [created] = await tx
					.insert(manuscript)
					.values({ projectId, status: "pending", currentVersion: 1 })
					.returning({ id: manuscript.id });
				await tx.insert(manuscriptVersion).values({
					manuscriptId: created.id,
					version: 1,
					coverImageUrl,
					driveLink,
					extractCode,
					note,
					status: "pending",
					submittedBy: session.user.id,
				});
				assertProjectTransition(projectStatus, "manuscript_submitted");
				await tx
					.update(project)
					.set({ status: "manuscript_submitted", updatedAt: new Date() })
					.where(eq(project.id, projectId));
				return;
			}
			// resubmit / supplement_copy 均追加新版本（version = 最高版本 + 1）。
			if (!ms || !latest) {
				throw new Error("manuscript missing for resubmit/copy");
			}
			const version = nextManuscriptVersion(latest.version);
			await tx.insert(manuscriptVersion).values({
				manuscriptId: ms.id,
				version,
				coverImageUrl,
				driveLink,
				extractCode,
				note,
				status: "pending",
				submittedBy: session.user.id,
			});
			if (mode === "resubmit") {
				// 被拒 / 打回后重提：重置主审核态为 pending，主轴维持 manuscript_submitted。
				assertManuscriptTransition(ms.status as ManuscriptStatus, "pending");
				await tx
					.update(manuscript)
					.set({
						status: "pending",
						currentVersion: version,
						updatedAt: new Date(),
					})
					.where(eq(manuscript.id, ms.id));
			}
			// supplement_copy：仅追加 pending 副本，不动 manuscript.status / currentVersion / project.status。
		});
	} catch (err) {
		if (err instanceof InvalidTransitionError) {
			return Response.json(
				{ ok: false, error: "当前状态不可提交稿件。" },
				{ status: 400 },
			);
		}
		throw err;
	}

	// 通知组织者有新稿件 / 重提副本待审（事务外，best-effort）。
	const organizers = await db
		.select({ email: user.email })
		.from(activityOrganizer)
		.innerJoin(user, eq(user.id, activityOrganizer.userId))
		.where(eq(activityOrganizer.activityId, row.activityId));
	for (const org of organizers) {
		await sendMail({
			to: org.email,
			template: "manuscript_submitted",
			data: { projectTitle: row.title },
		});
	}

	return Response.json({ ok: true });
}
