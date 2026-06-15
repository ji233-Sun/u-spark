import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import {
	activity,
	activityOrganizer,
	type FormQuestion,
	form,
	presetQuestion,
} from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import { AccessDeniedError, type Actor } from "#/lib/celebration/access";
import {
	hasConfigErrors,
	validateActivityBasics,
	validateActivitySchedule,
} from "#/lib/celebration/activity-config";
import {
	hasFormErrors,
	validateFormSchema,
} from "#/lib/celebration/form-engine";
import { requireActivityManager } from "#/lib/celebration/server-guards";

export type ActivityConfig = {
	id: string;
	title: string;
	description: string | null;
	status: "draft" | "published" | "canceled";
	startAt: string;
	proposalDeadline: string;
	submissionDeadline: string;
	infoSupplementDeadline: string;
	organizers: string[];
	formSchema: FormQuestion[];
	presets: { id: string; type: FormQuestion["type"]; label: string }[];
};

export const Route = createFileRoute("/api/organizer/activity-config")({
	server: {
		handlers: {
			GET: getConfig,
			POST: saveConfig,
		},
	},
});

function actorFromSession(u: { id: string; role?: string | null }): Actor {
	return { userId: u.id, role: u.role === "admin" ? "admin" : "user" };
}

async function authorize(
	request: Request,
	activityId: string,
): Promise<{ actor: Actor } | Response> {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const actor = actorFromSession(session.user);
	try {
		await requireActivityManager(actor, activityId);
	} catch (err) {
		if (err instanceof AccessDeniedError) {
			return Response.json({ ok: false, error: err.message }, { status: 403 });
		}
		throw err;
	}
	return { actor };
}

async function getConfig({ request }: { request: Request }) {
	const activityId = new URL(request.url).searchParams.get("activityId") ?? "";
	const gate = await authorize(request, activityId);
	if (gate instanceof Response) return gate;

	const [row] = await db
		.select()
		.from(activity)
		.where(eq(activity.id, activityId))
		.limit(1);
	if (!row) {
		return Response.json({ ok: false, error: "活动不存在。" }, { status: 404 });
	}

	const organizerRows = await db
		.select({ name: user.name, email: user.email })
		.from(activityOrganizer)
		.innerJoin(user, eq(user.id, activityOrganizer.userId))
		.where(eq(activityOrganizer.activityId, activityId));

	const [proposalForm] = await db
		.select({ schema: form.schema })
		.from(form)
		.where(and(eq(form.activityId, activityId), eq(form.type, "proposal")))
		.limit(1);

	const presets = await db
		.select({
			id: presetQuestion.id,
			type: presetQuestion.type,
			label: presetQuestion.label,
		})
		.from(presetQuestion);

	const config: ActivityConfig = {
		id: row.id,
		title: row.title,
		description: row.description,
		status: row.status as "draft" | "published" | "canceled",
		startAt: row.startAt.toISOString(),
		proposalDeadline: row.proposalDeadline.toISOString(),
		submissionDeadline: row.submissionDeadline.toISOString(),
		infoSupplementDeadline: row.infoSupplementDeadline.toISOString(),
		organizers: organizerRows.map((o) => o.name || o.email),
		formSchema: proposalForm?.schema ?? [],
		presets: presets.map((p) => ({
			id: p.id,
			type: p.type as FormQuestion["type"],
			label: p.label,
		})),
	};
	return Response.json({ ok: true, config });
}

async function saveConfig({ request }: { request: Request }) {
	const body = (await request.json().catch(() => null)) as {
		action?: unknown;
		activityId?: unknown;
		title?: unknown;
		description?: unknown;
		startAt?: unknown;
		proposalDeadline?: unknown;
		submissionDeadline?: unknown;
		infoSupplementDeadline?: unknown;
		publish?: unknown;
		schema?: unknown;
	} | null;
	const activityId =
		typeof body?.activityId === "string" ? body.activityId : "";
	const gate = await authorize(request, activityId);
	if (gate instanceof Response) return gate;
	const action = typeof body?.action === "string" ? body.action : "";

	if (action === "saveBasics") {
		const errors = {
			...validateActivityBasics(body ?? {}),
			...validateActivitySchedule(body ?? {}),
		};
		if (hasConfigErrors(errors)) {
			return Response.json({ ok: false, errors }, { status: 400 });
		}
		const status = body?.publish === true ? "published" : "draft";
		await db
			.update(activity)
			.set({
				title: String(body?.title).trim(),
				description:
					typeof body?.description === "string" && body.description.trim()
						? body.description.trim()
						: null,
				status,
				startAt: new Date(String(body?.startAt)),
				proposalDeadline: new Date(String(body?.proposalDeadline)),
				submissionDeadline: new Date(String(body?.submissionDeadline)),
				infoSupplementDeadline: new Date(String(body?.infoSupplementDeadline)),
				updatedAt: new Date(),
			})
			.where(eq(activity.id, activityId));
		return Response.json({ ok: true });
	}

	if (action === "saveForm") {
		const schema = Array.isArray(body?.schema)
			? (body.schema as FormQuestion[])
			: [];
		const errors = validateFormSchema(schema);
		if (hasFormErrors(errors)) {
			return Response.json({ ok: false, formErrors: errors }, { status: 400 });
		}
		const [existing] = await db
			.select({ id: form.id })
			.from(form)
			.where(and(eq(form.activityId, activityId), eq(form.type, "proposal")))
			.limit(1);
		if (existing) {
			await db
				.update(form)
				.set({ schema, updatedAt: new Date() })
				.where(eq(form.id, existing.id));
		} else {
			await db.insert(form).values({
				activityId,
				type: "proposal",
				title: "立项表单",
				schema,
			});
		}
		return Response.json({ ok: true });
	}

	return Response.json({ ok: false, error: "未知操作。" }, { status: 400 });
}
