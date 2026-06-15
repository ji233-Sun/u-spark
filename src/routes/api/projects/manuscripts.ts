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
	isActionBlockedByDeadline,
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
	submissionDeadline: string;
	submitMode: ReturnType<typeof manuscriptSubmitMode>;
	canSubmit: boolean;
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

async function getManuscriptDetail({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const projectId = new URL(request.url).searchParams.get("projectId") ?? "";

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
		})
		.from(project)
		.innerJoin(activity, eq(activity.id, project.activityId))
		.where(eq(project.id, projectId))
		.limit(1);

	if (!row) {
		return Response.json({ ok: false, error: "立项不存在。" }, { status: 404 });
	}
	if (row.createdBy !== session.user.id) {
		return Response.json({ ok: false, error: "无权访问。" }, { status: 403 });
	}

	const [ms] = await db
		.select({
			id: manuscript.id,
			status: manuscript.status,
			currentVersion: manuscript.currentVersion,
		})
		.from(manuscript)
		.where(eq(manuscript.projectId, projectId))
		.limit(1);

	const [latest] = ms
		? await db
				.select()
				.from(manuscriptVersion)
				.where(eq(manuscriptVersion.manuscriptId, ms.id))
				.orderBy(desc(manuscriptVersion.version))
				.limit(1)
		: [];

	const mode = manuscriptSubmitMode(
		row.status as ProjectStatus,
		(ms?.status as ManuscriptStatus | null) ?? null,
	);
	const deadline = effectiveDeadline(
		row.submissionDeadline,
		row.specialSubmissionDeadline,
	);
	const overdue = isOverdue(deadline, new Date());

	const detail: ManuscriptDetail = {
		projectId: row.id,
		projectTitle: row.title,
		activityId: row.activityId,
		activityTitle: row.activityTitle,
		projectStatus: row.status as ProjectStatus,
		manuscriptStatus: (ms?.status as ManuscriptStatus | null) ?? null,
		currentVersion: ms?.currentVersion ?? 0,
		submissionDeadline: deadline.toISOString(),
		submitMode: mode,
		// supplement_copy 由 T23 子流程接管，此处不在本页开放普通提交。
		canSubmit: (mode === "initial" || mode === "resubmit") && !overdue,
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

	const [row] = await db
		.select({
			id: project.id,
			title: project.title,
			status: project.status,
			createdBy: project.createdBy,
			activityId: project.activityId,
			submissionDeadline: activity.submissionDeadline,
			specialSubmissionDeadline: project.specialSubmissionDeadline,
		})
		.from(project)
		.innerJoin(activity, eq(activity.id, project.activityId))
		.where(eq(project.id, projectId))
		.limit(1);

	if (!row) {
		return Response.json({ ok: false, error: "立项不存在。" }, { status: 404 });
	}
	// 数据级越权防护：仅立项创建者（队长）可提交稿件。
	if (row.createdBy !== session.user.id) {
		return Response.json(
			{ ok: false, error: "仅立项创建者可提交稿件。" },
			{ status: 403 },
		);
	}

	const existing = await db
		.select({
			id: manuscript.id,
			status: manuscript.status,
			currentVersion: manuscript.currentVersion,
		})
		.from(manuscript)
		.where(eq(manuscript.projectId, projectId))
		.limit(1);
	const current = existing[0] ?? null;

	const mode = manuscriptSubmitMode(
		row.status as ProjectStatus,
		(current?.status as ManuscriptStatus | null) ?? null,
	);
	if (mode === "blocked") {
		return Response.json(
			{ ok: false, error: "当前状态不可提交稿件。" },
			{ status: 400 },
		);
	}
	// 信息补充阶段的重交副本走 T23 子流程，本接口暂只处理首次提交 / 被拒重提。
	if (mode === "supplement_copy") {
		return Response.json(
			{ ok: false, error: "信息补充阶段请使用重交稿件入口。" },
			{ status: 400 },
		);
	}

	// DDL 守卫（effective = max(活动级, 项目级特批)）。
	if (
		isActionBlockedByDeadline(
			row.submissionDeadline,
			row.specialSubmissionDeadline,
			new Date(),
		)
	) {
		return Response.json(
			{ ok: false, error: "稿件提交已截止。" },
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
				assertProjectTransition(
					row.status as ProjectStatus,
					"manuscript_submitted",
				);
				await tx
					.update(project)
					.set({ status: "manuscript_submitted", updatedAt: new Date() })
					.where(eq(project.id, projectId));
			} else {
				// resubmit：被拒 / 打回后重提，重置审核为 pending，主轴维持 manuscript_submitted。
				if (!current) {
					throw new Error("manuscript missing for resubmit");
				}
				assertManuscriptTransition(
					current.status as ManuscriptStatus,
					"pending",
				);
				const version = nextManuscriptVersion(current.currentVersion);
				await tx.insert(manuscriptVersion).values({
					manuscriptId: current.id,
					version,
					coverImageUrl,
					driveLink,
					extractCode,
					note,
					status: "pending",
					submittedBy: session.user.id,
				});
				await tx
					.update(manuscript)
					.set({
						status: "pending",
						currentVersion: version,
						updatedAt: new Date(),
					})
					.where(eq(manuscript.id, current.id));
			}
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

	// 通知组织者有新稿件待审（事务外，best-effort）。
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
