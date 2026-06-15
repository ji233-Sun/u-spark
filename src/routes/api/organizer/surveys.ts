import { createFileRoute } from "@tanstack/react-router";
import { count, desc, eq } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import {
	type FormAnswers,
	type FormQuestion,
	form,
	formResponse,
} from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import { AccessDeniedError, type Actor } from "#/lib/celebration/access";
import {
	hasFormErrors,
	validateFormSchema,
} from "#/lib/celebration/form-engine";
import { requireActivityManager } from "#/lib/celebration/server-guards";
import { latestResponsesByRespondent } from "#/lib/celebration/survey";

export type SurveySummary = {
	id: string;
	title: string;
	description: string | null;
	schema: FormQuestion[];
	opensAt: string | null;
	closesAt: string | null;
	responseCount: number;
};

export type SurveyResult = {
	survey: SurveySummary;
	responses: {
		respondent: string;
		answers: FormAnswers;
		submittedAt: string;
	}[];
};

export const Route = createFileRoute("/api/organizer/surveys")({
	server: {
		handlers: {
			GET: getSurveys,
			POST: mutateSurvey,
		},
	},
});

function actorFromSession(u: { id: string; role?: string | null }): Actor {
	return { userId: u.id, role: u.role === "admin" ? "admin" : "user" };
}

async function activityOfSurvey(surveyId: string): Promise<string | null> {
	const [row] = await db
		.select({ activityId: form.activityId })
		.from(form)
		.where(eq(form.id, surveyId))
		.limit(1);
	return row?.activityId ?? null;
}

async function getSurveys({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const actor = actorFromSession(session.user);
	const url = new URL(request.url);
	const surveyId = url.searchParams.get("surveyId");

	if (surveyId) {
		return getSurveyResults(actor, surveyId);
	}

	const activityId = url.searchParams.get("activityId") ?? "";
	const guard = await guardActivity(actor, activityId);
	if (guard) return guard;

	const surveys = await db
		.select()
		.from(form)
		.where(eq(form.activityId, activityId))
		.orderBy(desc(form.createdAt));
	const surveyList = surveys.filter((s) => s.type === "survey");

	const counts = await db
		.select({ formId: formResponse.formId, n: count() })
		.from(formResponse)
		.groupBy(formResponse.formId);
	const countMap = new Map(counts.map((c) => [c.formId, Number(c.n)]));

	const items: SurveySummary[] = surveyList.map((s) => ({
		id: s.id,
		title: s.title,
		description: s.description,
		schema: s.schema,
		opensAt: s.opensAt ? s.opensAt.toISOString() : null,
		closesAt: s.closesAt ? s.closesAt.toISOString() : null,
		responseCount: countMap.get(s.id) ?? 0,
	}));
	return Response.json({ ok: true, surveys: items });
}

async function getSurveyResults(actor: Actor, surveyId: string) {
	const activityId = await activityOfSurvey(surveyId);
	if (!activityId) {
		return Response.json({ ok: false, error: "问卷不存在。" }, { status: 404 });
	}
	const guard = await guardActivity(actor, activityId);
	if (guard) return guard;

	const [survey] = await db
		.select()
		.from(form)
		.where(eq(form.id, surveyId))
		.limit(1);

	const rows = await db
		.select({
			respondentId: formResponse.respondentId,
			answers: formResponse.answers,
			submittedAt: formResponse.submittedAt,
			name: user.name,
			email: user.email,
		})
		.from(formResponse)
		.leftJoin(user, eq(user.id, formResponse.respondentId))
		.where(eq(formResponse.formId, surveyId))
		.orderBy(desc(formResponse.submittedAt));

	const latest = latestResponsesByRespondent(rows);
	const result: SurveyResult = {
		survey: {
			id: survey.id,
			title: survey.title,
			description: survey.description,
			schema: survey.schema,
			opensAt: survey.opensAt ? survey.opensAt.toISOString() : null,
			closesAt: survey.closesAt ? survey.closesAt.toISOString() : null,
			responseCount: latest.length,
		},
		responses: latest.map((r) => ({
			respondent: r.name || r.email || "匿名",
			answers: r.answers,
			submittedAt: r.submittedAt.toISOString(),
		})),
	};
	return Response.json({ ok: true, result });
}

async function mutateSurvey({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const actor = actorFromSession(session.user);
	const body = (await request.json().catch(() => null)) as {
		action?: unknown;
		activityId?: unknown;
		surveyId?: unknown;
		title?: unknown;
		description?: unknown;
		schema?: unknown;
		opensAt?: unknown;
		closesAt?: unknown;
	} | null;
	const action = typeof body?.action === "string" ? body.action : "";

	if (action === "delete") {
		const surveyId = typeof body?.surveyId === "string" ? body.surveyId : "";
		const activityId = await activityOfSurvey(surveyId);
		if (!activityId) {
			return Response.json(
				{ ok: false, error: "问卷不存在。" },
				{ status: 404 },
			);
		}
		const guard = await guardActivity(actor, activityId);
		if (guard) return guard;
		await db.delete(form).where(eq(form.id, surveyId));
		return Response.json({ ok: true });
	}

	// create / update：校验 schema + 时间
	const title = typeof body?.title === "string" ? body.title.trim() : "";
	if (!title) {
		return Response.json(
			{ ok: false, error: "问卷标题为必填项。" },
			{ status: 400 },
		);
	}
	const schema = Array.isArray(body?.schema)
		? (body.schema as FormQuestion[])
		: [];
	const errors = validateFormSchema(schema);
	if (hasFormErrors(errors)) {
		return Response.json({ ok: false, formErrors: errors }, { status: 400 });
	}
	const description =
		typeof body?.description === "string" && body.description.trim()
			? body.description.trim()
			: null;
	const opensAt =
		typeof body?.opensAt === "string" && body.opensAt
			? new Date(body.opensAt)
			: null;
	const closesAt =
		typeof body?.closesAt === "string" && body.closesAt
			? new Date(body.closesAt)
			: null;

	if (action === "create") {
		const activityId =
			typeof body?.activityId === "string" ? body.activityId : "";
		const guard = await guardActivity(actor, activityId);
		if (guard) return guard;
		await db.insert(form).values({
			activityId,
			type: "survey",
			title,
			description,
			schema,
			opensAt,
			closesAt,
		});
		return Response.json({ ok: true });
	}

	if (action === "update") {
		const surveyId = typeof body?.surveyId === "string" ? body.surveyId : "";
		const activityId = await activityOfSurvey(surveyId);
		if (!activityId) {
			return Response.json(
				{ ok: false, error: "问卷不存在。" },
				{ status: 404 },
			);
		}
		const guard = await guardActivity(actor, activityId);
		if (guard) return guard;
		await db
			.update(form)
			.set({
				title,
				description,
				schema,
				opensAt,
				closesAt,
				updatedAt: new Date(),
			})
			.where(eq(form.id, surveyId));
		return Response.json({ ok: true });
	}

	return Response.json({ ok: false, error: "未知操作。" }, { status: 400 });
}

// 数据级越权防护：要求 actor 管理该活动；返回 Response 表示拒绝，null 表示放行。
async function guardActivity(
	actor: Actor,
	activityId: string,
): Promise<Response | null> {
	try {
		await requireActivityManager(actor, activityId);
		return null;
	} catch (err) {
		if (err instanceof AccessDeniedError) {
			return Response.json({ ok: false, error: err.message }, { status: 403 });
		}
		throw err;
	}
}
