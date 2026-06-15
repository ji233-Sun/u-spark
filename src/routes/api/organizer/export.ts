import { createFileRoute } from "@tanstack/react-router";
import { and, asc, desc, eq } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import {
	manuscript,
	manuscriptVersion,
	payment,
	paymentCode,
	project,
	projectAuthor,
	shippingAddress,
} from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import { AccessDeniedError, type Actor } from "#/lib/celebration/access";
import {
	type CsvCell,
	type ExportType,
	isExportType,
	maskAddress,
	maskPhone,
	toCsv,
} from "#/lib/celebration/export";
import {
	MANUSCRIPT_STATUS_LABELS,
	PROJECT_STATUS_LABELS,
} from "#/lib/celebration/labels";
import { requireActivityManager } from "#/lib/celebration/server-guards";
import type {
	ManuscriptStatus,
	ProjectStatus,
} from "#/lib/celebration/state-machine";

export const Route = createFileRoute("/api/organizer/export")({
	server: {
		handlers: {
			GET: exportCsv,
		},
	},
});

function actorFromSession(u: { id: string; role?: string | null }): Actor {
	return { userId: u.id, role: u.role === "admin" ? "admin" : "user" };
}

function csvResponse(filename: string, headers: string[], rows: CsvCell[][]) {
	return new Response(toCsv(headers, rows), {
		status: 200,
		headers: {
			"content-type": "text/csv; charset=utf-8",
			"content-disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
		},
	});
}

async function exportCsv({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const actor = actorFromSession(session.user);
	const url = new URL(request.url);
	const activityId = url.searchParams.get("activityId") ?? "";
	const type = url.searchParams.get("type") ?? "";
	const full = url.searchParams.get("full") === "true";

	if (!isExportType(type)) {
		return Response.json(
			{ ok: false, error: "导出类型无效。" },
			{ status: 400 },
		);
	}

	try {
		await requireActivityManager(actor, activityId);
	} catch (err) {
		if (err instanceof AccessDeniedError) {
			return Response.json({ ok: false, error: err.message }, { status: 403 });
		}
		throw err;
	}

	const handlers: Record<ExportType, () => Promise<Response>> = {
		proposals: () => exportProposals(activityId),
		manuscripts: () => exportManuscripts(activityId),
		authors: () => exportAuthors(activityId),
		shipping: () => exportShipping(activityId, full),
		payments: () => exportPayments(activityId),
	};
	return handlers[type]();
}

async function exportProposals(activityId: string) {
	const rows = await db
		.select({
			id: project.id,
			title: project.title,
			status: project.status,
			createdAt: project.createdAt,
			answers: project.proposalAnswers,
			creatorName: user.name,
			creatorEmail: user.email,
		})
		.from(project)
		.innerJoin(user, eq(user.id, project.createdBy))
		.where(eq(project.activityId, activityId))
		.orderBy(desc(project.createdAt));

	return csvResponse(
		"proposals.csv",
		["项目ID", "标题", "状态", "创建者", "邮箱", "提交时间", "立项答案"],
		rows.map((r) => [
			r.id,
			r.title,
			PROJECT_STATUS_LABELS[r.status as ProjectStatus],
			r.creatorName,
			r.creatorEmail,
			r.createdAt.toISOString(),
			JSON.stringify(r.answers),
		]),
	);
}

async function exportManuscripts(activityId: string) {
	const rows = await db
		.select({
			title: project.title,
			msStatus: manuscript.status,
			currentVersion: manuscript.currentVersion,
			driveLink: manuscriptVersion.driveLink,
			extractCode: manuscriptVersion.extractCode,
			submittedAt: manuscriptVersion.submittedAt,
		})
		.from(manuscript)
		.innerJoin(project, eq(project.id, manuscript.projectId))
		.innerJoin(
			manuscriptVersion,
			and(
				eq(manuscriptVersion.manuscriptId, manuscript.id),
				eq(manuscriptVersion.version, manuscript.currentVersion),
			),
		)
		.where(eq(project.activityId, activityId))
		.orderBy(desc(manuscriptVersion.submittedAt));

	return csvResponse(
		"manuscripts.csv",
		["项目", "稿件状态", "当前版本", "网盘链接", "提取码", "提交时间"],
		rows.map((r) => [
			r.title,
			MANUSCRIPT_STATUS_LABELS[r.msStatus as ManuscriptStatus],
			r.currentVersion,
			r.driveLink,
			r.extractCode,
			r.submittedAt.toISOString(),
		]),
	);
}

async function exportAuthors(activityId: string) {
	const rows = await db
		.select({
			title: project.title,
			displayName: projectAuthor.displayName,
			bilibiliUid: projectAuthor.bilibiliUid,
			duty: projectAuthor.duty,
			isPayee: projectAuthor.isPayee,
		})
		.from(projectAuthor)
		.innerJoin(project, eq(project.id, projectAuthor.projectId))
		.where(eq(project.activityId, activityId))
		.orderBy(asc(project.title), asc(projectAuthor.createdAt));

	return csvResponse(
		"authors.csv",
		["项目", "作者昵称", "B站UID", "职能", "收款负责人"],
		rows.map((r) => [
			r.title,
			r.displayName,
			r.bilibiliUid,
			r.duty,
			r.isPayee ? "是" : "否",
		]),
	);
}

async function exportShipping(activityId: string, full: boolean) {
	const rows = await db
		.select({
			title: project.title,
			author: projectAuthor.displayName,
			recipientName: shippingAddress.recipientName,
			phone: shippingAddress.phone,
			address: shippingAddress.address,
			note: shippingAddress.note,
		})
		.from(shippingAddress)
		.innerJoin(project, eq(project.id, shippingAddress.projectId))
		.innerJoin(projectAuthor, eq(projectAuthor.id, shippingAddress.authorId))
		.where(eq(project.activityId, activityId))
		.orderBy(asc(project.title));

	return csvResponse(
		full ? "shipping-full.csv" : "shipping.csv",
		["项目", "作者", "收件人", "电话", "地址", "备注"],
		rows.map((r) => [
			r.title,
			r.author,
			r.recipientName,
			full ? r.phone : maskPhone(r.phone),
			full ? r.address : maskAddress(r.address),
			r.note,
		]),
	);
}

async function exportPayments(activityId: string) {
	const rows = await db
		.select({
			title: project.title,
			amount: payment.amount,
			status: payment.status,
			paidAt: payment.paidAt,
			payeeName: paymentCode.payeeName,
		})
		.from(payment)
		.innerJoin(project, eq(project.id, payment.projectId))
		.leftJoin(paymentCode, eq(paymentCode.projectId, project.id))
		.where(eq(project.activityId, activityId))
		.orderBy(asc(project.title));

	return csvResponse(
		"payments.csv",
		["项目", "稿酬总额", "发放状态", "发放时间", "收款人"],
		rows.map((r) => [
			r.title,
			r.amount,
			r.status === "paid" ? "已发放" : "待发放",
			r.paidAt ? r.paidAt.toISOString() : "",
			r.payeeName,
		]),
	);
}
