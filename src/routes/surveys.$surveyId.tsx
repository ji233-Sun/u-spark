import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { DynamicFormFields } from "#/components/forms/DynamicFormFields";
import { authClient } from "#/lib/auth-client";
import {
	type FormValidationErrors,
	formDataToDynamicAnswers,
} from "#/lib/celebration/form-engine";
import type { SurveyFillDetail } from "./api/surveys";

export const Route = createFileRoute("/surveys/$surveyId")({
	component: SurveyFillPage,
});

function SurveyFillPage() {
	const { surveyId } = Route.useParams();
	const { data: session, isPending } = authClient.useSession();
	const [detail, setDetail] = useState<SurveyFillDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [errors, setErrors] = useState<FormValidationErrors>({});
	const [message, setMessage] = useState("");
	const [isError, setIsError] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		void fetch(`/api/surveys?surveyId=${surveyId}`)
			.then(async (res) => {
				const json = (await res.json()) as {
					ok: boolean;
					error?: string;
					detail?: SurveyFillDetail;
				};
				if (!res.ok || !json.ok) throw new Error(json.error ?? "加载失败");
				setDetail(json.detail ?? null);
			})
			.catch(() => setDetail(null))
			.finally(() => setLoading(false));
	}, [surveyId]);

	if (loading || isPending) return <Loading />;
	if (!detail) {
		return <Prompt title="问卷不存在" body="链接可能已失效。" />;
	}

	if (!session?.user) {
		return (
			<main className="demo-page">
				<section className="demo-panel text-center">
					<h1 className="demo-title">{detail.title}</h1>
					<p className="demo-muted mt-3 text-sm">登录后即可填写问卷。</p>
					<Link to="/auth" className="demo-button mt-6 no-underline">
						去登录
					</Link>
				</section>
			</main>
		);
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmitting(true);
		setErrors({});
		setMessage("");
		const answers = formDataToDynamicAnswers(
			detail.schema,
			new FormData(event.currentTarget),
		);
		// 问卷无系统强制字段，剥离立项专用键。
		const cleaned: Record<string, unknown> = { ...answers };
		cleaned.email = undefined;
		cleaned.username = undefined;
		cleaned.projectTitle = undefined;

		const res = await fetch("/api/surveys", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ surveyId, answers: cleaned }),
		});
		const json = (await res.json()) as {
			ok: boolean;
			error?: string;
			errors?: FormValidationErrors;
		};
		setSubmitting(false);
		if (!json.ok) {
			setIsError(true);
			setErrors(json.errors ?? {});
			setMessage(json.error ?? "提交失败，请检查表单。");
			return;
		}
		setIsError(false);
		setMessage("已提交，感谢填写！可再次修改后重新提交。");
	};

	return (
		<main className="demo-page demo-page-wide">
			<section className="demo-panel">
				<header className="mb-6">
					<p className="island-kicker mb-2">Survey</p>
					<h1 className="demo-title">{detail.title}</h1>
					{detail.description && (
						<p className="demo-muted mt-3 text-sm whitespace-pre-wrap">
							{detail.description}
						</p>
					)}
				</header>

				{!detail.isOpen ? (
					<div className="demo-alert demo-alert-danger">
						<p className="m-0 text-sm">问卷当前未开放填写。</p>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="grid gap-5">
						<DynamicFormFields
							schema={detail.schema}
							includeSystemFields={false}
							values={(detail.myAnswers ?? {}) as Record<string, string>}
							errors={errors}
							disabled={submitting}
						/>
						{message && (
							<div
								className={
									isError ? "demo-alert demo-alert-danger" : "demo-alert"
								}
							>
								<p className="m-0 text-sm">{message}</p>
							</div>
						)}
						<button type="submit" disabled={submitting} className="demo-button">
							{submitting
								? "提交中..."
								: detail.myAnswers
									? "更新作答"
									: "提交问卷"}
						</button>
					</form>
				)}
			</section>
		</main>
	);
}

function Prompt({ title, body }: { title: string; body: string }) {
	return (
		<main className="demo-page">
			<section className="demo-panel text-center">
				<h1 className="demo-title">{title}</h1>
				<p className="demo-muted mt-3 text-sm">{body}</p>
				<Link to="/activities" className="demo-button mt-6 no-underline">
					浏览活动
				</Link>
			</section>
		</main>
	);
}

function Loading() {
	return (
		<main className="demo-page demo-page-wide">
			<section className="demo-panel animate-pulse">
				<div className="mb-4 h-8 w-1/3 rounded bg-[var(--chip-line)]" />
				<div className="h-24 rounded bg-[var(--chip-line)]" />
			</section>
		</main>
	);
}
