import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import {
	activity,
	payment,
	paymentCode,
	project,
} from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import { canUploadPaymentCode } from "#/lib/celebration/payment";
import { effectiveDeadline, isOverdue } from "#/lib/celebration/state-machine";
import { signedFileUrl } from "#/lib/storage";

export type PaymentCodeDetail = {
	projectId: string;
	projectTitle: string;
	remunerationAssigned: boolean;
	amount: string | null;
	paymentStatus: "pending" | "paid" | null;
	infoDeadlinePassed: boolean;
	canUpload: boolean;
	code: { url: string; payeeName: string | null } | null;
};

export const Route = createFileRoute("/api/projects/payment-code")({
	server: {
		handlers: {
			GET: getPaymentCode,
			POST: uploadPaymentCode,
		},
	},
});

async function loadContext(projectId: string, userId: string) {
	const [row] = await db
		.select({
			id: project.id,
			title: project.title,
			createdBy: project.createdBy,
			infoSupplementDeadline: activity.infoSupplementDeadline,
			specialInfoSupplementDeadline: project.specialInfoSupplementDeadline,
			amount: payment.amount,
			paymentStatus: payment.status,
			codeImage: paymentCode.imageUrl,
			codePayee: paymentCode.payeeName,
		})
		.from(project)
		.innerJoin(activity, eq(activity.id, project.activityId))
		.leftJoin(payment, eq(payment.projectId, project.id))
		.leftJoin(paymentCode, eq(paymentCode.projectId, project.id))
		.where(eq(project.id, projectId))
		.limit(1);
	if (!row) return { row: null, owned: false };
	return { row, owned: row.createdBy === userId };
}

async function getPaymentCode({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
	const { row, owned } = await loadContext(projectId, session.user.id);
	if (!row) {
		return Response.json({ ok: false, error: "立项不存在。" }, { status: 404 });
	}
	if (!owned) {
		return Response.json({ ok: false, error: "无权访问。" }, { status: 403 });
	}

	const remunerationAssigned = row.amount !== null;
	const infoDeadlinePassed = isOverdue(
		effectiveDeadline(
			row.infoSupplementDeadline,
			row.specialInfoSupplementDeadline,
		),
		new Date(),
	);

	const detail: PaymentCodeDetail = {
		projectId: row.id,
		projectTitle: row.title,
		remunerationAssigned,
		amount: row.amount,
		paymentStatus: row.paymentStatus as "pending" | "paid" | null,
		infoDeadlinePassed,
		canUpload: canUploadPaymentCode(remunerationAssigned, infoDeadlinePassed),
		code: row.codeImage
			? { url: signedFileUrl(row.codeImage), payeeName: row.codePayee }
			: null,
	};
	return Response.json({ ok: true, detail });
}

async function uploadPaymentCode({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const body = (await request.json().catch(() => null)) as {
		projectId?: unknown;
		imageKey?: unknown;
		payeeName?: unknown;
	} | null;
	const projectId = typeof body?.projectId === "string" ? body.projectId : "";
	const imageKey =
		typeof body?.imageKey === "string" ? body.imageKey.trim() : "";

	const { row, owned } = await loadContext(projectId, session.user.id);
	if (!row) {
		return Response.json({ ok: false, error: "立项不存在。" }, { status: 404 });
	}
	if (!owned) {
		return Response.json(
			{ ok: false, error: "仅立项创建者可上传收款码。" },
			{ status: 403 },
		);
	}

	const remunerationAssigned = row.amount !== null;
	const infoDeadlinePassed = isOverdue(
		effectiveDeadline(
			row.infoSupplementDeadline,
			row.specialInfoSupplementDeadline,
		),
		new Date(),
	);
	if (!remunerationAssigned) {
		return Response.json(
			{ ok: false, error: "尚未核定稿酬，暂不可上传收款码。" },
			{ status: 400 },
		);
	}
	if (!canUploadPaymentCode(remunerationAssigned, infoDeadlinePassed)) {
		return Response.json(
			{ ok: false, error: "信息补充已截止，收款码入口已关闭。" },
			{ status: 400 },
		);
	}
	// 仅接受收款码分类的存储 key（与 /api/uploads 一致）。
	if (!imageKey.startsWith("payment-code/")) {
		return Response.json(
			{ ok: false, error: "请先上传收款码图片。" },
			{ status: 400 },
		);
	}
	const payeeName =
		typeof body?.payeeName === "string" && body.payeeName.trim()
			? body.payeeName.trim()
			: null;

	// 项目级单一收款码：upsert（projectId 唯一）。
	await db
		.insert(paymentCode)
		.values({
			projectId,
			imageUrl: imageKey,
			payeeName,
			uploadedBy: session.user.id,
		})
		.onConflictDoUpdate({
			target: paymentCode.projectId,
			set: { imageUrl: imageKey, payeeName, updatedAt: new Date() },
		});

	return Response.json({ ok: true });
}
