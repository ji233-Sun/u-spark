import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import {
	activity,
	project,
	projectAuthor,
	shippingAddress,
} from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import {
	canManageAuthors,
	hasAuthorErrors,
	validateAuthorInput,
	validateShippingAddress,
} from "#/lib/celebration/authors";
import {
	effectiveDeadline,
	isOverdue,
	type ProjectStatus,
} from "#/lib/celebration/state-machine";

export type ProjectAuthorRecord = {
	id: string;
	displayName: string;
	bilibiliUid: string | null;
	duty: string | null;
	isPayee: boolean;
	shipping: {
		recipientName: string;
		phone: string;
		address: string;
		note: string | null;
	} | null;
};

export type AuthorsPayload = {
	projectId: string;
	projectTitle: string;
	canManage: boolean;
	authors: ProjectAuthorRecord[];
};

export const Route = createFileRoute("/api/projects/authors")({
	server: {
		handlers: {
			GET: listAuthors,
			POST: mutateAuthors,
		},
	},
});

// 取 owner 限定的项目 + 信息补充 DDL 是否已过。
async function loadOwnedProject(projectId: string, userId: string) {
	const [row] = await db
		.select({
			id: project.id,
			title: project.title,
			status: project.status,
			createdBy: project.createdBy,
			infoSupplementDeadline: activity.infoSupplementDeadline,
			specialInfoSupplementDeadline: project.specialInfoSupplementDeadline,
		})
		.from(project)
		.innerJoin(activity, eq(activity.id, project.activityId))
		.where(eq(project.id, projectId))
		.limit(1);
	if (!row) return null;
	if (row.createdBy !== userId) return "denied" as const;
	const ddlPassed = isOverdue(
		effectiveDeadline(
			row.infoSupplementDeadline,
			row.specialInfoSupplementDeadline,
		),
		new Date(),
	);
	return {
		id: row.id,
		title: row.title,
		canManage: canManageAuthors(row.status as ProjectStatus, ddlPassed),
	};
}

async function readAuthors(projectId: string): Promise<ProjectAuthorRecord[]> {
	const rows = await db
		.select({
			id: projectAuthor.id,
			displayName: projectAuthor.displayName,
			bilibiliUid: projectAuthor.bilibiliUid,
			duty: projectAuthor.duty,
			isPayee: projectAuthor.isPayee,
			shipRecipient: shippingAddress.recipientName,
			shipPhone: shippingAddress.phone,
			shipAddress: shippingAddress.address,
			shipNote: shippingAddress.note,
		})
		.from(projectAuthor)
		.leftJoin(shippingAddress, eq(shippingAddress.authorId, projectAuthor.id))
		.where(eq(projectAuthor.projectId, projectId))
		.orderBy(projectAuthor.createdAt);
	return rows.map((r) => ({
		id: r.id,
		displayName: r.displayName,
		bilibiliUid: r.bilibiliUid,
		duty: r.duty,
		isPayee: r.isPayee,
		shipping: r.shipRecipient
			? {
					recipientName: r.shipRecipient,
					phone: r.shipPhone ?? "",
					address: r.shipAddress ?? "",
					note: r.shipNote,
				}
			: null,
	}));
}

async function listAuthors({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
	const owned = await loadOwnedProject(projectId, session.user.id);
	if (!owned) {
		return Response.json({ ok: false, error: "立项不存在。" }, { status: 404 });
	}
	if (owned === "denied") {
		return Response.json({ ok: false, error: "无权访问。" }, { status: 403 });
	}
	const payload: AuthorsPayload = {
		projectId: owned.id,
		projectTitle: owned.title,
		canManage: owned.canManage,
		authors: await readAuthors(owned.id),
	};
	return Response.json({ ok: true, payload });
}

async function mutateAuthors({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const body = (await request.json().catch(() => null)) as {
		action?: unknown;
		projectId?: unknown;
		authorId?: unknown;
		displayName?: unknown;
		bilibiliUid?: unknown;
		duty?: unknown;
		shipping?: {
			recipientName?: unknown;
			phone?: unknown;
			address?: unknown;
			note?: unknown;
		} | null;
	} | null;

	const action = typeof body?.action === "string" ? body.action : "";
	const projectId = typeof body?.projectId === "string" ? body.projectId : "";
	const owned = await loadOwnedProject(projectId, session.user.id);
	if (!owned) {
		return Response.json({ ok: false, error: "立项不存在。" }, { status: 404 });
	}
	if (owned === "denied") {
		return Response.json({ ok: false, error: "无权操作。" }, { status: 403 });
	}
	if (!owned.canManage) {
		return Response.json(
			{ ok: false, error: "仅信息补充阶段可填报作者与收货信息。" },
			{ status: 400 },
		);
	}

	// 校验目标作者属于本项目（越权防护）。
	async function assertAuthorBelongs(authorId: string): Promise<boolean> {
		const [a] = await db
			.select({ id: projectAuthor.id })
			.from(projectAuthor)
			.where(
				and(
					eq(projectAuthor.id, authorId),
					eq(projectAuthor.projectId, projectId),
				),
			)
			.limit(1);
		return Boolean(a);
	}

	if (action === "create" || action === "update") {
		const errors = validateAuthorInput(body ?? {});
		if (hasAuthorErrors(errors)) {
			return Response.json({ ok: false, errors }, { status: 400 });
		}
		const authorId = typeof body?.authorId === "string" ? body.authorId : "";
		if (action === "update" && !(await assertAuthorBelongs(authorId))) {
			return Response.json(
				{ ok: false, error: "作者不存在。" },
				{ status: 404 },
			);
		}
		const values = {
			displayName: String(body?.displayName).trim(),
			bilibiliUid: String(body?.bilibiliUid).trim(),
			duty: String(body?.duty).trim(),
		};

		if (action === "create") {
			await db.insert(projectAuthor).values({ projectId, ...values });
		} else {
			await db
				.update(projectAuthor)
				.set(values)
				.where(eq(projectAuthor.id, authorId));
		}
		return Response.json({ ok: true, authors: await readAuthors(projectId) });
	}

	if (action === "delete") {
		const authorId = typeof body?.authorId === "string" ? body.authorId : "";
		if (!(await assertAuthorBelongs(authorId))) {
			return Response.json(
				{ ok: false, error: "作者不存在。" },
				{ status: 404 },
			);
		}
		await db.delete(projectAuthor).where(eq(projectAuthor.id, authorId));
		return Response.json({ ok: true, authors: await readAuthors(projectId) });
	}

	if (action === "setShipping") {
		const authorId = typeof body?.authorId === "string" ? body.authorId : "";
		if (!(await assertAuthorBelongs(authorId))) {
			return Response.json(
				{ ok: false, error: "作者不存在。" },
				{ status: 404 },
			);
		}
		const ship = body?.shipping ?? {};
		const errors = validateShippingAddress(ship);
		if (hasAuthorErrors(errors)) {
			return Response.json({ ok: false, errors }, { status: 400 });
		}
		const values = {
			recipientName: String(ship.recipientName).trim(),
			phone: String(ship.phone).trim(),
			address: String(ship.address).trim(),
			note:
				typeof ship.note === "string" && ship.note.trim()
					? ship.note.trim()
					: null,
		};
		await db
			.insert(shippingAddress)
			.values({ projectId, authorId, ...values })
			.onConflictDoUpdate({
				target: shippingAddress.authorId,
				set: { ...values, updatedAt: new Date() },
			});
		return Response.json({ ok: true, authors: await readAuthors(projectId) });
	}

	if (action === "deleteShipping") {
		const authorId = typeof body?.authorId === "string" ? body.authorId : "";
		if (!(await assertAuthorBelongs(authorId))) {
			return Response.json(
				{ ok: false, error: "作者不存在。" },
				{ status: 404 },
			);
		}
		await db
			.delete(shippingAddress)
			.where(eq(shippingAddress.authorId, authorId));
		return Response.json({ ok: true, authors: await readAuthors(projectId) });
	}

	return Response.json({ ok: false, error: "未知操作。" }, { status: 400 });
}
