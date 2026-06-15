import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import { form, formResponse } from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import { AccessDeniedError, type Actor } from "#/lib/celebration/access";
import { type CsvCell, toCsv } from "#/lib/celebration/export";
import { requireActivityManager } from "#/lib/celebration/server-guards";
import {
	answersToRow,
	latestResponsesByRespondent,
} from "#/lib/celebration/survey";

export const Route = createFileRoute("/api/organizer/survey-export")({
	server: {
		handlers: {
			GET: exportSurvey,
		},
	},
});

async function exportSurvey({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}
	const actor: Actor = {
		userId: session.user.id,
		role: session.user.role === "admin" ? "admin" : "user",
	};
	const surveyId = new URL(request.url).searchParams.get("surveyId") ?? "";

	const [survey] = await db
		.select()
		.from(form)
		.where(eq(form.id, surveyId))
		.limit(1);
	if (!survey || survey.type !== "survey") {
		return Response.json({ ok: false, error: "问卷不存在。" }, { status: 404 });
	}

	try {
		await requireActivityManager(actor, survey.activityId);
	} catch (err) {
		if (err instanceof AccessDeniedError) {
			return Response.json({ ok: false, error: err.message }, { status: 403 });
		}
		throw err;
	}

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
	const headers = ["填写者", "提交时间", ...survey.schema.map((q) => q.label)];
	const csvRows: CsvCell[][] = latest.map((r) => [
		r.name || r.email || "匿名",
		r.submittedAt.toISOString(),
		...answersToRow(survey.schema, r.answers),
	]);

	return new Response(toCsv(headers, csvRows), {
		status: 200,
		headers: {
			"content-type": "text/csv; charset=utf-8",
			"content-disposition": `attachment; filename="survey-${surveyId}.csv"`,
		},
	});
}
