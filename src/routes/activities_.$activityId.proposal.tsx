import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import type { FormEvent } from "react";
import { useState } from "react";
import { DynamicFormFields } from "#/components/forms/DynamicFormFields";
import { activity, type FormQuestion, form } from "#/db/celebration-schema";
import { db } from "#/db/index";
import { authClient } from "#/lib/auth-client";
import {
	type FormValidationErrors,
	formDataToDynamicAnswers,
} from "#/lib/celebration/form-engine";

type ProposalPageData = {
	activityId: string;
	activityTitle: string;
	schema: FormQuestion[];
} | null;

const getProposalPageData = createServerFn({
	method: "GET",
})
	.validator((data: { activityId: string }) => data)
	.handler(async ({ data }): Promise<ProposalPageData> => {
		const [activityRow] = await db
			.select({
				id: activity.id,
				title: activity.title,
			})
			.from(activity)
			.where(
				and(eq(activity.id, data.activityId), eq(activity.status, "published")),
			)
			.limit(1);

		if (!activityRow) return null;

		const [proposalForm] = await db
			.select({ schema: form.schema })
			.from(form)
			.where(
				and(eq(form.activityId, data.activityId), eq(form.type, "proposal")),
			)
			.limit(1);

		return {
			activityId: activityRow.id,
			activityTitle: activityRow.title,
			schema: proposalForm?.schema ?? [],
		};
	});

export const Route = createFileRoute("/activities_/$activityId/proposal")({
	loader: async ({ params }) =>
		await getProposalPageData({ data: { activityId: params.activityId } }),
	component: ProposalPage,
	pendingComponent: ProposalLoading,
});

function ProposalPage() {
	const data = Route.useLoaderData();
	const { data: session, isPending } = authClient.useSession();
	const [errors, setErrors] = useState<FormValidationErrors>({});
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);

	if (!data) {
		return (
			<main className="demo-page">
				<section className="demo-panel text-center">
					<h1 className="demo-title">活动不存在</h1>
					<p className="demo-muted mt-3 text-sm">
						它可能尚未发布，或已经下线。
					</p>
					<Link to="/activities" className="demo-button mt-6 no-underline">
						返回活动列表
					</Link>
				</section>
			</main>
		);
	}

	if (isPending) {
		return <ProposalLoading />;
	}

	if (!session?.user) {
		return (
			<main className="demo-page">
				<section className="demo-panel text-center">
					<h1 className="demo-title">请先登录</h1>
					<p className="demo-muted mt-3 text-sm">登录后即可填写立项表单。</p>
					<Link to="/auth" className="demo-button mt-6 no-underline">
						去登录
					</Link>
				</section>
			</main>
		);
	}

	const username =
		"username" in session.user && typeof session.user.username === "string"
			? session.user.username
			: (session.user.name ?? "");

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = event.currentTarget;
		setSubmitting(true);
		setErrors({});
		setMessage("");

		const formData = new FormData(form);
		const answers = formDataToDynamicAnswers(data.schema, formData);

		const response = await fetch("/api/projects/proposals", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ activityId: data.activityId, answers }),
		});
		const result = (await response.json()) as {
			ok: boolean;
			error?: string;
			errors?: FormValidationErrors;
			projectId?: string;
		};

		setSubmitting(false);
		if (!result.ok) {
			setErrors(result.errors ?? {});
			setMessage(result.error ?? "提交失败，请检查表单。");
			return;
		}
		setMessage("立项已提交，回执邮件已发送。");
		form.reset();
	};

	const hasErrors = Object.keys(errors).length > 0;

	return (
		<main className="demo-page demo-page-wide">
			<Link
				to="/activities/$activityId"
				params={{ activityId: data.activityId }}
				className="demo-muted text-sm no-underline"
			>
				返回活动详情
			</Link>

			<section className="demo-panel mt-4">
				<header className="mb-6">
					<p className="island-kicker mb-2">Proposal</p>
					<h1 className="demo-title">参与活动</h1>
					<p className="demo-muted mt-3 text-sm">
						{data.activityTitle} · 提交后进入组织者审核。
					</p>
				</header>

				<form onSubmit={handleSubmit} className="grid gap-5">
					<DynamicFormFields
						schema={data.schema}
						errors={errors}
						disabled={submitting}
						values={{
							email: session.user.email,
							username,
						}}
					/>
					{message && (
						<div
							className={
								hasErrors ? "demo-alert demo-alert-danger" : "demo-alert"
							}
						>
							<p className="m-0 text-sm">{message}</p>
						</div>
					)}
					<button type="submit" disabled={submitting} className="demo-button">
						{submitting ? "提交中..." : "提交立项"}
					</button>
				</form>
			</section>
		</main>
	);
}

function ProposalLoading() {
	return (
		<main className="demo-page demo-page-wide">
			<section className="demo-panel animate-pulse">
				<div className="mb-4 h-8 w-1/3 rounded bg-[var(--chip-line)]" />
				<div className="grid gap-4">
					<div className="h-12 rounded bg-[var(--chip-line)]" />
					<div className="h-12 rounded bg-[var(--chip-line)]" />
					<div className="h-24 rounded bg-[var(--chip-line)]" />
				</div>
			</section>
		</main>
	);
}
