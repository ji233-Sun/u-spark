import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FormSchemaBuilder } from "#/components/forms/FormSchemaBuilder";
import type { FormQuestion } from "#/db/celebration-schema";
import { authClient } from "#/lib/auth-client";
import type { OrganizerActivityRecord } from "./api/organizer/activities";
import type { SurveyResult, SurveySummary } from "./api/organizer/surveys";

export const Route = createFileRoute("/organizer/surveys")({
	component: SurveysPage,
});

type Editor = {
	surveyId: string | null;
	title: string;
	description: string;
	opensAt: string;
	closesAt: string;
	schema: FormQuestion[];
};

const emptyEditor: Editor = {
	surveyId: null,
	title: "",
	description: "",
	opensAt: "",
	closesAt: "",
	schema: [],
};

function SurveysPage() {
	const { data: session, isPending } = authClient.useSession();
	const [activities, setActivities] = useState<OrganizerActivityRecord[]>([]);
	const [activityId, setActivityId] = useState("");
	const [surveys, setSurveys] = useState<SurveySummary[]>([]);
	const [editor, setEditor] = useState<Editor | null>(null);
	const [result, setResult] = useState<SurveyResult | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (isPending || !session?.user) return;
		void fetch("/api/organizer/activities")
			.then(async (res) => {
				const json = (await res.json()) as {
					ok: boolean;
					activities?: OrganizerActivityRecord[];
				};
				setActivities(json.activities ?? []);
				setActivityId((id) => id || (json.activities?.[0]?.id ?? ""));
			})
			.finally(() => setLoading(false));
	}, [isPending, session?.user]);

	const loadSurveys = (aid: string) => {
		if (!aid) return;
		void fetch(`/api/organizer/surveys?activityId=${aid}`)
			.then(async (res) => {
				const json = (await res.json()) as {
					ok: boolean;
					error?: string;
					surveys?: SurveySummary[];
				};
				if (!json.ok) throw new Error(json.error ?? "加载失败");
				setSurveys(json.surveys ?? []);
				setError("");
			})
			.catch((err) =>
				setError(err instanceof Error ? err.message : "加载失败"),
			);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: 活动切换时重载问卷
	useEffect(() => {
		loadSurveys(activityId);
	}, [activityId]);

	const save = async () => {
		if (!editor) return;
		const res = await fetch("/api/organizer/surveys", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				action: editor.surveyId ? "update" : "create",
				activityId,
				surveyId: editor.surveyId,
				title: editor.title,
				description: editor.description,
				opensAt: editor.opensAt || null,
				closesAt: editor.closesAt || null,
				schema: editor.schema,
			}),
		});
		const json = (await res.json()) as {
			ok: boolean;
			error?: string;
			formErrors?: Record<string, string>;
		};
		if (!json.ok) {
			setError(
				json.formErrors
					? `题目有误：${Object.values(json.formErrors).join("；")}`
					: (json.error ?? "保存失败"),
			);
			return;
		}
		setEditor(null);
		loadSurveys(activityId);
	};

	const remove = async (surveyId: string) => {
		if (!confirm("确认删除该问卷及其所有作答？")) return;
		await fetch("/api/organizer/surveys", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ action: "delete", surveyId }),
		});
		loadSurveys(activityId);
	};

	const viewResult = async (surveyId: string) => {
		const res = await fetch(`/api/organizer/surveys?surveyId=${surveyId}`);
		const json = (await res.json()) as { ok: boolean; result?: SurveyResult };
		if (json.ok && json.result) setResult(json.result);
	};

	if (isPending || loading) {
		return (
			<main className="demo-page demo-page-wide">
				<div className="demo-panel animate-pulse h-40" />
			</main>
		);
	}
	if (!session?.user) {
		return (
			<main className="demo-page">
				<section className="demo-panel text-center">
					<h1 className="demo-title">请先登录</h1>
					<Link to="/auth" className="demo-button mt-6 no-underline">
						去登录
					</Link>
				</section>
			</main>
		);
	}

	return (
		<main className="demo-page demo-page-wide">
			<header className="mb-6">
				<p className="island-kicker mb-2">Organizer</p>
				<h1 className="demo-title">问卷系统</h1>
				<p className="demo-muted mt-3 text-sm">
					复用统一表单引擎建/配问卷，用户在活动页或问卷链接填写，结果可查看与导出。
				</p>
			</header>

			{error && (
				<section className="demo-alert demo-alert-danger mb-4">
					<p className="m-0 text-sm text-red-600">{error}</p>
				</section>
			)}

			{activities.length === 0 ? (
				<section className="demo-panel text-center">
					<p className="demo-muted m-0 text-sm">你还没有负责的活动。</p>
				</section>
			) : (
				<>
					<div className="demo-panel mb-4 grid gap-1.5">
						<span className="text-sm font-medium">选择活动</span>
						<select
							value={activityId}
							onChange={(e) => {
								setActivityId(e.target.value);
								setEditor(null);
								setResult(null);
							}}
							className="demo-select"
						>
							{activities.map((a) => (
								<option key={a.id} value={a.id}>
									{a.title}
								</option>
							))}
						</select>
					</div>

					<section className="mb-4 grid gap-3">
						{surveys.map((s) => (
							<article key={s.id} className="demo-list-item">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<h2 className="m-0 text-base font-bold text-[var(--sea-ink)]">
											{s.title}
										</h2>
										<p className="demo-muted mt-1 text-xs">
											{s.schema.length} 题 · {s.responseCount} 份作答
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<a
											href={`/surveys/${s.id}`}
											target="_blank"
											rel="noreferrer"
											className="demo-button demo-button-secondary text-sm no-underline"
										>
											填写链接
										</a>
										<button
											type="button"
											className="demo-button demo-button-secondary text-sm"
											onClick={() => viewResult(s.id)}
										>
											结果（{s.responseCount}）
										</button>
										<a
											href={`/api/organizer/survey-export?surveyId=${s.id}`}
											className="demo-button demo-button-secondary text-sm no-underline"
										>
											导出
										</a>
										<button
											type="button"
											className="demo-button demo-button-secondary text-sm"
											onClick={() =>
												setEditor({
													surveyId: s.id,
													title: s.title,
													description: s.description ?? "",
													opensAt: s.opensAt ? s.opensAt.slice(0, 16) : "",
													closesAt: s.closesAt ? s.closesAt.slice(0, 16) : "",
													schema: s.schema,
												})
											}
										>
											编辑
										</button>
										<button
											type="button"
											className="demo-button demo-button-danger text-sm"
											onClick={() => remove(s.id)}
										>
											删除
										</button>
									</div>
								</div>
							</article>
						))}
						{surveys.length === 0 && (
							<p className="demo-muted text-sm">该活动暂无问卷。</p>
						)}
					</section>

					{result && (
						<ResultPanel result={result} onClose={() => setResult(null)} />
					)}

					{editor ? (
						<SurveyEditor
							editor={editor}
							setEditor={setEditor}
							onSave={save}
							onCancel={() => setEditor(null)}
						/>
					) : (
						<button
							type="button"
							className="demo-button"
							onClick={() => setEditor({ ...emptyEditor })}
						>
							+ 新建问卷
						</button>
					)}
				</>
			)}
		</main>
	);
}

function SurveyEditor({
	editor,
	setEditor,
	onSave,
	onCancel,
}: {
	editor: Editor;
	setEditor: (e: Editor) => void;
	onSave: () => void;
	onCancel: () => void;
}) {
	return (
		<section className="demo-panel grid gap-4">
			<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
				{editor.surveyId ? "编辑问卷" : "新建问卷"}
			</h2>
			<input
				value={editor.title}
				onChange={(e) => setEditor({ ...editor, title: e.target.value })}
				placeholder="问卷标题"
				className="demo-input"
			/>
			<textarea
				value={editor.description}
				onChange={(e) => setEditor({ ...editor, description: e.target.value })}
				placeholder="问卷说明（选填）"
				className="demo-textarea"
			/>
			<div className="grid gap-3 sm:grid-cols-2">
				<label className="grid gap-1.5 text-sm">
					开放时间（选填）
					<input
						type="datetime-local"
						value={editor.opensAt}
						onChange={(e) => setEditor({ ...editor, opensAt: e.target.value })}
						className="demo-input"
					/>
				</label>
				<label className="grid gap-1.5 text-sm">
					关闭时间（选填）
					<input
						type="datetime-local"
						value={editor.closesAt}
						onChange={(e) => setEditor({ ...editor, closesAt: e.target.value })}
						className="demo-input"
					/>
				</label>
			</div>
			<FormSchemaBuilder
				schema={editor.schema}
				onChange={(schema) => setEditor({ ...editor, schema })}
			/>
			<div className="flex gap-2">
				<button type="button" className="demo-button" onClick={onSave}>
					保存问卷
				</button>
				<button
					type="button"
					className="demo-button demo-button-secondary"
					onClick={onCancel}
				>
					取消
				</button>
			</div>
		</section>
	);
}

function ResultPanel({
	result,
	onClose,
}: {
	result: SurveyResult;
	onClose: () => void;
}) {
	return (
		<section className="demo-panel mb-4">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
					「{result.survey.title}」结果（{result.responses.length} 份）
				</h2>
				<button
					type="button"
					className="demo-button demo-button-secondary text-sm"
					onClick={onClose}
				>
					关闭
				</button>
			</div>
			{result.responses.length === 0 ? (
				<p className="demo-muted text-sm">暂无作答。</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="text-left">
								<th className="p-2">填写者</th>
								{result.survey.schema.map((q) => (
									<th key={q.id} className="p-2">
										{q.label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{result.responses.map((r) => (
								<tr
									key={`${r.respondent}-${r.submittedAt}`}
									className="border-t border-[var(--line)]"
								>
									<td className="p-2">{r.respondent}</td>
									{result.survey.schema.map((q) => {
										const v = r.answers[q.id];
										return (
											<td key={q.id} className="p-2">
												{Array.isArray(v) ? v.join("、") : (v ?? "")}
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}
