import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { ManuscriptStatusBadge, ProjectStatusBadge } from "#/components/ui";
import { authClient } from "#/lib/auth-client";
import type { ManuscriptDetail } from "./api/projects/manuscripts";

export const Route = createFileRoute("/projects_/$projectId/manuscript")({
	component: ManuscriptPage,
});

function ManuscriptPage() {
	const { projectId } = Route.useParams();
	const { data: session, isPending } = authClient.useSession();
	const [detail, setDetail] = useState<ManuscriptDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = () => {
		setLoading(true);
		void fetch(`/api/projects/manuscripts?projectId=${projectId}`)
			.then(async (res) => {
				const json = (await res.json()) as {
					ok: boolean;
					error?: string;
					detail?: ManuscriptDetail;
				};
				if (!res.ok || !json.ok) throw new Error(json.error ?? "加载失败");
				setDetail(json.detail ?? null);
				setError("");
			})
			.catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
			.finally(() => setLoading(false));
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: 仅依赖会话与路由参数
	useEffect(() => {
		if (isPending || !session?.user) return;
		load();
	}, [isPending, session?.user, projectId]);

	if (isPending || (loading && !detail)) return <ManuscriptLoading />;

	if (!session?.user) {
		return (
			<PromptPanel
				title="请先登录"
				body="登录后可提交稿件。"
				to="/auth"
				cta="去登录"
			/>
		);
	}

	if (error || !detail) {
		return (
			<PromptPanel
				title="无法加载稿件"
				body={error || "立项不存在或无权访问。"}
				to="/my/proposals"
				cta="返回我的立项"
			/>
		);
	}

	return (
		<main className="demo-page demo-page-wide">
			<Link
				to="/activities/$activityId"
				params={{ activityId: detail.activityId }}
				className="demo-muted text-sm no-underline"
			>
				返回活动详情
			</Link>

			<section className="demo-panel mt-4">
				<header className="mb-6">
					<p className="island-kicker mb-2">Manuscript</p>
					<h1 className="demo-title">{detail.projectTitle}</h1>
					<div className="mt-3 flex flex-wrap items-center gap-2">
						<ProjectStatusBadge status={detail.projectStatus} />
						{detail.manuscriptStatus && (
							<ManuscriptStatusBadge status={detail.manuscriptStatus} />
						)}
						<span className="demo-muted text-sm">
							活动：{detail.activityTitle}
						</span>
					</div>
				</header>

				{detail.latest?.reviewReason &&
					(detail.latest.status === "rejected" ||
						detail.latest.status === "revision_requested") && (
						<div className="demo-alert demo-alert-danger mb-5">
							<p className="m-0 text-sm font-semibold">审核反馈</p>
							<p className="m-0 mt-1 text-sm">{detail.latest.reviewReason}</p>
						</div>
					)}

				{detail.latest && (
					<div className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-4">
						<p className="island-kicker mb-3">
							当前提交（第 {detail.latest.version} 版）
						</p>
						{detail.latest.coverUrl && (
							<img
								src={detail.latest.coverUrl}
								alt="稿件封面"
								className="mb-3 max-h-48 rounded-lg border border-[var(--line)]"
							/>
						)}
						{detail.latest.driveLink && (
							<p className="m-0 text-sm break-all">
								网盘：
								<a
									href={detail.latest.driveLink}
									target="_blank"
									rel="noreferrer"
									className="text-[var(--lagoon-deep)]"
								>
									{detail.latest.driveLink}
								</a>
								{detail.latest.extractCode &&
									`　提取码：${detail.latest.extractCode}`}
							</p>
						)}
					</div>
				)}

				{detail.canSubmit ? (
					<ManuscriptForm
						projectId={projectId}
						resubmit={detail.submitMode === "resubmit"}
						onDone={load}
					/>
				) : (
					<div className="demo-alert">
						<p className="m-0 text-sm">
							{detail.manuscriptStatus === "pending"
								? "稿件审核中，请耐心等待结果。"
								: detail.projectStatus === "info_supplement" ||
										detail.projectStatus === "completed"
									? "稿件已通过，进入后续阶段。"
									: "当前阶段不可提交稿件。"}
						</p>
					</div>
				)}
			</section>
		</main>
	);
}

function ManuscriptForm({
	projectId,
	resubmit,
	onDone,
}: {
	projectId: string;
	resubmit: boolean;
	onDone: () => void;
}) {
	const [coverKey, setCoverKey] = useState("");
	const [coverPreview, setCoverPreview] = useState("");
	const [uploading, setUploading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [message, setMessage] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});

	const handleCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		setUploading(true);
		setErrors((e) => ({ ...e, coverImageKey: "" }));
		const fd = new FormData();
		fd.append("file", file);
		fd.append("category", "manuscript-cover");
		const res = await fetch("/api/uploads", { method: "POST", body: fd });
		const json = (await res.json()) as {
			ok: boolean;
			key?: string;
			error?: string;
		};
		setUploading(false);
		if (!json.ok || !json.key) {
			setErrors((e) => ({ ...e, coverImageKey: json.error ?? "上传失败" }));
			return;
		}
		setCoverKey(json.key);
		setCoverPreview(URL.createObjectURL(file));
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmitting(true);
		setMessage("");
		setErrors({});
		const fd = new FormData(event.currentTarget);
		const res = await fetch("/api/projects/manuscripts", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				projectId,
				coverImageKey: coverKey,
				driveLink: String(fd.get("driveLink") ?? ""),
				extractCode: String(fd.get("extractCode") ?? ""),
				note: String(fd.get("note") ?? ""),
			}),
		});
		const json = (await res.json()) as {
			ok: boolean;
			error?: string;
			errors?: Record<string, string>;
		};
		setSubmitting(false);
		if (!json.ok) {
			setErrors(json.errors ?? {});
			setMessage(json.error ?? "提交失败，请检查表单。");
			return;
		}
		setMessage("稿件已提交，进入审核队列。");
		onDone();
	};

	return (
		<form onSubmit={handleSubmit} className="grid gap-5">
			<div className="grid gap-2">
				<label htmlFor="cover" className="text-sm font-medium">
					稿件封面 <span className="text-red-600">*</span>
				</label>
				<input
					id="cover"
					type="file"
					accept="image/png,image/jpeg,image/webp,image/gif"
					onChange={handleCover}
					disabled={uploading || submitting}
					className="demo-input"
				/>
				{uploading && <p className="demo-muted m-0 text-xs">上传中...</p>}
				{coverPreview && (
					<img
						src={coverPreview}
						alt="封面预览"
						className="max-h-40 rounded-lg border border-[var(--line)]"
					/>
				)}
				{errors.coverImageKey && (
					<p className="m-0 text-xs text-red-600">{errors.coverImageKey}</p>
				)}
			</div>

			<div className="grid gap-2">
				<label htmlFor="driveLink" className="text-sm font-medium">
					网盘链接 <span className="text-red-600">*</span>
				</label>
				<input
					id="driveLink"
					name="driveLink"
					type="url"
					placeholder="https://"
					required
					disabled={submitting}
					className="demo-input"
				/>
				{errors.driveLink && (
					<p className="m-0 text-xs text-red-600">{errors.driveLink}</p>
				)}
			</div>

			<div className="grid gap-2">
				<label htmlFor="extractCode" className="text-sm font-medium">
					提取码（选填）
				</label>
				<input
					id="extractCode"
					name="extractCode"
					type="text"
					disabled={submitting}
					className="demo-input"
				/>
				{errors.extractCode && (
					<p className="m-0 text-xs text-red-600">{errors.extractCode}</p>
				)}
			</div>

			<div className="grid gap-2">
				<label htmlFor="note" className="text-sm font-medium">
					备注（选填）
				</label>
				<textarea
					id="note"
					name="note"
					disabled={submitting}
					className="demo-textarea"
				/>
			</div>

			{message && (
				<div
					className={
						Object.keys(errors).length > 0
							? "demo-alert demo-alert-danger"
							: "demo-alert"
					}
				>
					<p className="m-0 text-sm">{message}</p>
				</div>
			)}

			<button
				type="submit"
				disabled={submitting || uploading}
				className="demo-button"
			>
				{submitting ? "提交中..." : resubmit ? "重新提交稿件" : "提交稿件"}
			</button>
		</form>
	);
}

function PromptPanel({
	title,
	body,
	to,
	cta,
}: {
	title: string;
	body: string;
	to: string;
	cta: string;
}) {
	return (
		<main className="demo-page">
			<section className="demo-panel text-center">
				<h1 className="demo-title">{title}</h1>
				<p className="demo-muted mt-3 text-sm">{body}</p>
				<Link to={to} className="demo-button mt-6 no-underline">
					{cta}
				</Link>
			</section>
		</main>
	);
}

function ManuscriptLoading() {
	return (
		<main className="demo-page demo-page-wide">
			<section className="demo-panel animate-pulse">
				<div className="mb-4 h-8 w-1/3 rounded bg-[var(--chip-line)]" />
				<div className="grid gap-4">
					<div className="h-12 rounded bg-[var(--chip-line)]" />
					<div className="h-24 rounded bg-[var(--chip-line)]" />
				</div>
			</section>
		</main>
	);
}
