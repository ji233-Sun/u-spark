import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { activity, form, project } from "#/db/celebration-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import {
	activityParticipationState,
	toActivityListRows,
} from "#/lib/celebration/activity-list";
import {
	hasFormErrors,
	validateDynamicFormAnswers,
} from "#/lib/celebration/form-engine";
import { toStoredProposalAnswers } from "#/lib/celebration/proposal";
import { sendMail } from "#/lib/email";

export const Route = createFileRoute("/api/projects/proposals")({
	server: {
		handlers: {
			POST: submitProposal,
		},
	},
});

async function submitProposal({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}

	const body = (await request.json().catch(() => null)) as {
		activityId?: unknown;
		answers?: unknown;
	} | null;
	const activityId =
		typeof body?.activityId === "string" ? body.activityId : "";
	const answers =
		body?.answers && typeof body.answers === "object"
			? (body.answers as Record<string, unknown>)
			: {};

	if (!activityId) {
		return Response.json({ ok: false, error: "活动不存在。" }, { status: 400 });
	}

	const [activityRow] = await db
		.select()
		.from(activity)
		.where(and(eq(activity.id, activityId), eq(activity.status, "published")))
		.limit(1);

	if (!activityRow) {
		return Response.json(
			{ ok: false, error: "活动不存在或未发布。" },
			{ status: 404 },
		);
	}

	const [proposalForm] = await db
		.select()
		.from(form)
		.where(and(eq(form.activityId, activityId), eq(form.type, "proposal")))
		.limit(1);
	const schema = proposalForm?.schema ?? [];

	const timeline = toActivityListRows([activityRow], new Date())[0];
	const participation = activityParticipationState(timeline);
	if (!participation.enabled) {
		return Response.json(
			{ ok: false, error: participation.reason },
			{ status: 400 },
		);
	}

	const errors = validateDynamicFormAnswers(schema, answers);
	if (hasFormErrors(errors)) {
		return Response.json({ ok: false, errors }, { status: 400 });
	}

	const projectTitle = String(answers.projectTitle ?? "").trim();
	const [created] = await db
		.insert(project)
		.values({
			activityId,
			proposalFormId: proposalForm?.id,
			title: projectTitle,
			status: "proposal_submitted",
			proposalAnswers: toStoredProposalAnswers(answers),
			createdBy: session.user.id,
		})
		.returning({ id: project.id });

	await sendMail({
		to: session.user.email,
		template: "proposal_receipt",
		data: { activityTitle: activityRow.title, projectTitle },
	});

	return Response.json({ ok: true, projectId: created.id });
}
