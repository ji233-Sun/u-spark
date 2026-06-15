import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq } from "drizzle-orm";
import {
	type FormAnswers,
	type FormQuestion,
	form,
	formResponse,
} from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import {
	hasFormErrors,
	validateSchemaAnswers,
} from "#/lib/celebration/form-engine";
import { isSurveyOpen } from "#/lib/celebration/survey";

export type SurveyFillDetail = {
	id: string;
	title: string;
	description: string | null;
	schema: FormQuestion[];
	isOpen: boolean;
	myAnswers: FormAnswers | null;
};

export const Route = createFileRoute("/api/surveys")({
	server: {
		handlers: {
			GET: getSurvey,
			POST: submitResponse,
		},
	},
});

async function loadSurvey(surveyId: string) {
	const [row] = await db
		.select()
		.from(form)
		.where(and(eq(form.id, surveyId), eq(form.type, "survey")))
		.limit(1);
	return row ?? null;
}

async function getSurvey({ request }: { request: Request }) {
	const surveyId = new URL(request.url).searchParams.get("surveyId") ?? "";
	const survey = await loadSurvey(surveyId);
	if (!survey) {
		return Response.json({ ok: false, error: "问卷不存在。" }, { status: 404 });
	}

	const session = await auth.api.getSession({ headers: request.headers });
	let myAnswers: FormAnswers | null = null;
	if (session?.user) {
		const [mine] = await db
			.select({ answers: formResponse.answers })
			.from(formResponse)
			.where(
				and(
					eq(formResponse.formId, surveyId),
					eq(formResponse.respondentId, session.user.id),
				),
			)
			.orderBy(desc(formResponse.submittedAt))
			.limit(1);
		myAnswers = mine?.answers ?? null;
	}

	const detail: SurveyFillDetail = {
		id: survey.id,
		title: survey.title,
		description: survey.description,
		schema: survey.schema,
		isOpen: isSurveyOpen(survey.opensAt, survey.closesAt, new Date()),
		myAnswers,
	};
	return Response.json({ ok: true, detail });
}

async function submitResponse({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json(
			{ ok: false, error: "请先登录后填写。" },
			{ status: 401 },
		);
	}
	const body = (await request.json().catch(() => null)) as {
		surveyId?: unknown;
		answers?: unknown;
	} | null;
	const surveyId = typeof body?.surveyId === "string" ? body.surveyId : "";
	const answers =
		body?.answers && typeof body.answers === "object"
			? (body.answers as Record<string, unknown>)
			: {};

	const survey = await loadSurvey(surveyId);
	if (!survey) {
		return Response.json({ ok: false, error: "问卷不存在。" }, { status: 404 });
	}
	if (!isSurveyOpen(survey.opensAt, survey.closesAt, new Date())) {
		return Response.json(
			{ ok: false, error: "问卷未在开放期内。" },
			{ status: 400 },
		);
	}

	const errors = validateSchemaAnswers(survey.schema, answers);
	if (hasFormErrors(errors)) {
		return Response.json({ ok: false, errors }, { status: 400 });
	}

	// 重复提交视为修改：追加新作答行，读取时取最新（审计日志）。
	await db.insert(formResponse).values({
		formId: surveyId,
		respondentId: session.user.id,
		answers: answers as FormAnswers,
	});
	return Response.json({ ok: true });
}
