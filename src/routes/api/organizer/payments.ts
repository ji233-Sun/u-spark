import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, inArray } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import {
	activity,
	activityOrganizer,
	payment,
	paymentCode,
	project,
} from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import { AccessDeniedError, type Actor } from "#/lib/celebration/access";
import {
	canAssignRemuneration,
	isPaymentStatus,
	REMUNERATION_ELIGIBLE_STATUSES,
	validateRemunerationAmount,
} from "#/lib/celebration/payment";
import { requireActivityManager } from "#/lib/celebration/server-guards";
import type { ProjectStatus } from "#/lib/celebration/state-machine";
import { sendMail } from "#/lib/email";
import { signedFileUrl } from "#/lib/storage";

export type RemunerationRecord = {
	projectId: string;
	projectTitle: string;
	activityId: string;
	activityTitle: string;
	creatorName: string;
	creatorEmail: string;
	projectStatus: ProjectStatus;
	amount: string | null;
	status: "pending" | "paid" | null;
	paidAt: string | null;
	paymentCode: { url: string; payeeName: string | null } | null;
};

export const Route = createFileRoute("/api/organizer/payments")({
	server: {
		handlers: {
			GET: listRemunerations,
			POST: assignRemuneration,
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

async function listRemunerations({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const actor = actorFromSession(session.user);

	const baseSelect = {
		projectId: project.id,
		projectTitle: project.title,
		activityId: activity.id,
		activityTitle: activity.title,
		creatorName: user.name,
		creatorEmail: user.email,
		projectStatus: project.status,
		amount: payment.amount,
		status: payment.status,
		paidAt: payment.paidAt,
		codeImage: paymentCode.imageUrl,
		codePayee: paymentCode.payeeName,
	};

	const eligible = inArray(project.status, [...REMUNERATION_ELIGIBLE_STATUSES]);

	const rows =
		actor.role === "admin"
			? await db
					.select(baseSelect)
					.from(project)
					.innerJoin(activity, eq(activity.id, project.activityId))
					.innerJoin(user, eq(user.id, project.createdBy))
					.leftJoin(payment, eq(payment.projectId, project.id))
					.leftJoin(paymentCode, eq(paymentCode.projectId, project.id))
					.where(eligible)
					.orderBy(desc(project.createdAt))
			: await db
					.select(baseSelect)
					.from(project)
					.innerJoin(activity, eq(activity.id, project.activityId))
					.innerJoin(user, eq(user.id, project.createdBy))
					.leftJoin(payment, eq(payment.projectId, project.id))
					.leftJoin(paymentCode, eq(paymentCode.projectId, project.id))
					.innerJoin(
						activityOrganizer,
						eq(activityOrganizer.activityId, activity.id),
					)
					.where(and(eligible, eq(activityOrganizer.userId, actor.userId)))
					.orderBy(desc(project.createdAt));

	const records: RemunerationRecord[] = rows.map((row) => ({
		projectId: row.projectId,
		projectTitle: row.projectTitle,
		activityId: row.activityId,
		activityTitle: row.activityTitle,
		creatorName: row.creatorName,
		creatorEmail: row.creatorEmail,
		projectStatus: row.projectStatus as ProjectStatus,
		amount: row.amount,
		status: row.status as "pending" | "paid" | null,
		paidAt: row.paidAt ? row.paidAt.toISOString() : null,
		paymentCode: row.codeImage
			? { url: signedFileUrl(row.codeImage), payeeName: row.codePayee }
			: null,
	}));

	return Response.json({ ok: true, records });
}

async function assignRemuneration({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const actor = actorFromSession(session.user);

	const body = (await request.json().catch(() => null)) as {
		projectId?: unknown;
		amount?: unknown;
		status?: unknown;
		note?: unknown;
	} | null;
	const projectId = typeof body?.projectId === "string" ? body.projectId : "";

	const [row] = await db
		.select({
			id: project.id,
			title: project.title,
			status: project.status,
			activityId: project.activityId,
			creatorEmail: user.email,
			amount: payment.amount,
			codeImage: paymentCode.imageUrl,
		})
		.from(project)
		.innerJoin(user, eq(user.id, project.createdBy))
		.leftJoin(payment, eq(payment.projectId, project.id))
		.leftJoin(paymentCode, eq(paymentCode.projectId, project.id))
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

	if (!canAssignRemuneration(row.status as ProjectStatus)) {
		return Response.json(
			{ ok: false, error: "该立项当前阶段不可核定稿酬。" },
			{ status: 400 },
		);
	}

	const amountResult = validateRemunerationAmount(body?.amount);
	if (!amountResult.ok) {
		return Response.json(
			{ ok: false, error: amountResult.error },
			{ status: 400 },
		);
	}
	const status = isPaymentStatus(body?.status) ? body.status : "pending";
	if (status === "paid" && !row.codeImage) {
		return Response.json(
			{ ok: false, error: "创作者上传收款码后才可发放稿酬。" },
			{ status: 400 },
		);
	}
	const note =
		typeof body?.note === "string" && body.note.trim()
			? body.note.trim()
			: null;
	const shouldNotifyAssigned = row.amount === null;

	await db
		.insert(payment)
		.values({
			projectId,
			amount: amountResult.amount,
			status,
			paidAt: status === "paid" ? new Date() : null,
			operatedBy: actor.userId,
			note,
		})
		.onConflictDoUpdate({
			target: payment.projectId,
			set: {
				amount: amountResult.amount,
				status,
				paidAt: status === "paid" ? new Date() : null,
				operatedBy: actor.userId,
				note,
				updatedAt: new Date(),
			},
		});

	if (shouldNotifyAssigned) {
		// 通知创作者稿酬已核定，提示在信息补充阶段上传收款码（驱动 T22）。
		await sendMail({
			to: row.creatorEmail,
			template: "remuneration_assigned",
			data: { projectTitle: row.title, amount: amountResult.amount },
		});
	}

	return Response.json({ ok: true });
}
