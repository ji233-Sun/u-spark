import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { FormSchemaBuilder } from "#/components/forms/FormSchemaBuilder";
import { ManuscriptStatusBadge, ProjectStatusBadge } from "#/components/ui";
import type { FormQuestion } from "#/db/celebration-schema";
import { authClient } from "#/lib/auth-client";
import {
	MANUSCRIPT_STATUS_LABELS,
	PROJECT_STATUS_LABELS,
} from "#/lib/celebration/labels";
import type {
	ManuscriptStatus,
	ProjectStatus,
} from "#/lib/celebration/state-machine";
import type { ActivityConfig } from "./api/organizer/activity-config";
import type { OrganizerActivityProjectRecord } from "./api/organizer/activity-projects";

export const Route = createFileRoute("/organizer/activities_/$activityId")({
	component: ActivityConfigPage,
});

function toLocalInput(iso: string): string {
	const d = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ActivityConfigPage() {
	const { activityId } = Route.useParams();
	const { data: session, isPending } = authClient.useSession();
	const [config, setConfig] = useState<ActivityConfig | null>(null);
	const [projects, setProjects] = useState<OrganizerActivityProjectRecord[]>(
		[],
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = () => {
		setLoading(true);
		void Promise.all([
			fetch(`/api/organizer/activity-config?activityId=${activityId}`).then(
				async (res) => {
					const json = (await res.json()) as {
						ok: boolean;
						error?: string;
						config?: ActivityConfig;
					};
					if (!res.ok || !json.ok) throw new Error(json.error ?? "加载失败");
					return json.config ?? null;
				},
			),
			fetch(`/api/organizer/activity-projects?activityId=${activityId}`).then(
				async (res) => {
					const json = (await res.json()) as {
						ok: boolean;
						error?: string;
						projects?: OrganizerActivityProjectRecord[];
					};
					if (!res.ok || !json.ok) throw new Error(json.error ?? "加载失败");
					return json.projects ?? [];
				},
			),
		])
			.then(([nextConfig, nextProjects]) => {
				setConfig(nextConfig);
				setProjects(nextProjects);
				setError("");
			})
			.catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
			.finally(() => setLoading(false));
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: 仅依赖会话与路由参数
	useEffect(() => {
		if (isPending || !session?.user) return;
		load();
	}, [isPending, session?.user, activityId]);

	if (isPending || (loading && !config)) {
		return (
			<main className="demo-page demo-page-wide">
				<div className="demo-panel animate-pulse h-60" />
			</main>
		);
	}
	if (!session?.user || error || !config) {
		return (
			<main className="demo-page">
				<section className="demo-panel text-center">
					<h1 className="demo-title">无法配置</h1>
					<p className="demo-muted mt-3 text-sm">
						{!session?.user ? "请先登录。" : error || "无权配置该活动。"}
					</p>
					<Link
						to="/organizer/activities"
						className="demo-button mt-6 no-underline"
					>
						返回活动管理
					</Link>
				</section>
			</main>
		);
	}

	return (
		<main className="demo-page demo-page-wide">
			<Link
				to="/organizer/activities"
				className="demo-muted text-sm no-underline"
			>
				返回活动管理
			</Link>
			<header className="mt-4 mb-6">
				<p className="island-kicker mb-2">Configure</p>
				<h1 className="demo-title">活动配置</h1>
			</header>

			<ProjectOverviewSection projects={projects} />
			<BasicsSection config={config} activityId={activityId} onSaved={load} />
			<FormBuilderSection
				config={config}
				activityId={activityId}
				onSaved={load}
			/>
		</main>
	);
}

const PROJECT_FILTERS = [
	"all",
	"proposal_submitted",
	"proposal_approved",
	"proposal_rejected",
	"manuscript_submitted",
	"manuscript_approved",
	"info_supplement",
	"completed",
	"withdrawn",
] as const satisfies readonly ("all" | ProjectStatus)[];

const MANUSCRIPT_FILTERS = [
	"all",
	"none",
	"pending",
	"approved",
	"revision_requested",
	"rejected",
] as const satisfies readonly ("all" | "none" | ManuscriptStatus)[];

function ProjectOverviewSection({
	projects,
}: {
	projects: OrganizerActivityProjectRecord[];
}) {
	const [query, setQuery] = useState("");
	const [projectStatus, setProjectStatus] =
		useState<(typeof PROJECT_FILTERS)[number]>("all");
	const [manuscriptStatus, setManuscriptStatus] =
		useState<(typeof MANUSCRIPT_FILTERS)[number]>("all");

	const normalizedQuery = query.trim().toLowerCase();
	const filtered = projects.filter((item) => {
		const matchesQuery =
			!normalizedQuery ||
			[item.projectTitle, item.creatorName, item.creatorEmail]
				.join(" ")
				.toLowerCase()
				.includes(normalizedQuery);
		const matchesProjectStatus =
			projectStatus === "all" || item.projectStatus === projectStatus;
		const matchesManuscriptStatus =
			manuscriptStatus === "all" ||
			(manuscriptStatus === "none"
				? item.manuscriptStatus === null
				: item.manuscriptStatus === manuscriptStatus ||
					item.latestVersionStatus === manuscriptStatus);
		return matchesQuery && matchesProjectStatus && matchesManuscriptStatus;
	});

	const pendingCount = projects.filter(
		(item) =>
			item.projectStatus === "proposal_submitted" ||
			item.manuscriptStatus === "pending" ||
			item.latestVersionStatus === "pending",
	).length;

	return (
		<section className="demo-panel mb-6">
			<div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
						项目 / 稿件总览
					</h2>
					<p className="demo-muted mt-2 text-sm">
						共 {projects.length} 个立项，{pendingCount} 个待处理。
					</p>
				</div>
				<div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_10rem_10rem]">
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="搜索项目 / 提交人 / 邮箱"
						className="demo-input h-10"
					/>
					<select
						value={projectStatus}
						onChange={(event) =>
							setProjectStatus(
								event.target.value as (typeof PROJECT_FILTERS)[number],
							)
						}
						className="demo-input h-10"
					>
						{PROJECT_FILTERS.map((status) => (
							<option key={status} value={status}>
								{status === "all"
									? "全部项目状态"
									: PROJECT_STATUS_LABELS[status]}
							</option>
						))}
					</select>
					<select
						value={manuscriptStatus}
						onChange={(event) =>
							setManuscriptStatus(
								event.target.value as (typeof MANUSCRIPT_FILTERS)[number],
							)
						}
						className="demo-input h-10"
					>
						{MANUSCRIPT_FILTERS.map((status) => (
							<option key={status} value={status}>
								{status === "all"
									? "全部稿件状态"
									: status === "none"
										? "未提交稿件"
										: MANUSCRIPT_STATUS_LABELS[status]}
							</option>
						))}
					</select>
				</div>
			</div>

			{filtered.length === 0 ? (
				<div className="rounded-lg border border-[var(--line)] bg-[var(--chip-bg)] p-6 text-center">
					<p className="demo-muted m-0 text-sm">没有匹配的立项。</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-lg border border-[var(--line)]">
					<table className="w-full min-w-[56rem] border-collapse text-sm">
						<thead className="bg-[var(--chip-bg)] text-left text-[var(--muted)]">
							<tr>
								<th className="px-4 py-3 font-semibold">项目</th>
								<th className="px-4 py-3 font-semibold">提交人</th>
								<th className="px-4 py-3 font-semibold">项目状态</th>
								<th className="px-4 py-3 font-semibold">稿件状态</th>
								<th className="px-4 py-3 font-semibold">最新提交</th>
								<th className="px-4 py-3 font-semibold">操作</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((item) => (
								<tr
									key={item.projectId}
									className="border-t border-[var(--line)] align-top"
								>
									<td className="px-4 py-3">
										<p className="m-0 font-semibold text-[var(--sea-ink)]">
											{item.projectTitle}
										</p>
										<p className="demo-muted m-0 mt-1 text-xs">
											创建于 {formatDate(new Date(item.createdAt))}
										</p>
									</td>
									<td className="px-4 py-3">
										<p className="m-0">{item.creatorName}</p>
										<p className="demo-muted m-0 mt-1 text-xs">
											{item.creatorEmail}
										</p>
									</td>
									<td className="px-4 py-3">
										<ProjectStatusBadge status={item.projectStatus} />
									</td>
									<td className="px-4 py-3">
										{item.manuscriptStatus ? (
											<div className="flex flex-wrap items-center gap-2">
												<ManuscriptStatusBadge status={item.manuscriptStatus} />
												{item.latestVersionStatus &&
													item.latestVersionStatus !==
														item.manuscriptStatus && (
														<ManuscriptStatusBadge
															status={item.latestVersionStatus}
														/>
													)}
												{item.latestVersion && (
													<span className="demo-muted text-xs">
														第 {item.latestVersion} 版
													</span>
												)}
											</div>
										) : (
											<span className="demo-muted text-xs">未提交</span>
										)}
									</td>
									<td className="px-4 py-3">
										{item.latestSubmittedAt ? (
											formatDate(new Date(item.latestSubmittedAt))
										) : (
											<span className="demo-muted text-xs">—</span>
										)}
									</td>
									<td className="px-4 py-3">
										<Link
											to="/organizer/manuscripts"
											className="text-[var(--lagoon-deep)] no-underline"
										>
											审核队列
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}

function BasicsSection({
	config,
	activityId,
	onSaved,
}: {
	config: ActivityConfig;
	activityId: string;
	onSaved: () => void;
}) {
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [message, setMessage] = useState("");
	const [busy, setBusy] = useState(false);

	const handle = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setBusy(true);
		setErrors({});
		setMessage("");
		const fd = new FormData(e.currentTarget);
		const res = await fetch("/api/organizer/activity-config", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				action: "saveBasics",
				activityId,
				title: fd.get("title"),
				description: fd.get("description"),
				startAt: fd.get("startAt"),
				proposalDeadline: fd.get("proposalDeadline"),
				submissionDeadline: fd.get("submissionDeadline"),
				infoSupplementDeadline: fd.get("infoSupplementDeadline"),
				publish: fd.get("publish") === "on",
			}),
		});
		const json = (await res.json()) as {
			ok: boolean;
			error?: string;
			errors?: Record<string, string>;
		};
		setBusy(false);
		if (!json.ok) {
			setErrors(json.errors ?? {});
			setMessage(json.error ?? "保存失败，请检查时间时序。");
			return;
		}
		setMessage("活动信息已保存。");
		onSaved();
	};

	return (
		<section className="demo-panel mb-6">
			<h2 className="m-0 mb-4 text-lg font-bold text-[var(--sea-ink)]">
				基础信息 & 截止时间
			</h2>
			<p className="demo-muted mb-4 text-sm">
				组织者：{config.organizers.join("、") || "—"}
			</p>
			<form onSubmit={handle} className="grid gap-4">
				<ConfigField label="活动名称" error={errors.title} required>
					<input
						name="title"
						defaultValue={config.title}
						required
						className="demo-input"
					/>
				</ConfigField>
				<ConfigField label="简介">
					<textarea
						name="description"
						defaultValue={config.description ?? ""}
						className="demo-textarea"
					/>
				</ConfigField>
				<div className="grid gap-4 sm:grid-cols-2">
					<ConfigField label="开始时间" error={errors.startAt} required>
						<input
							type="datetime-local"
							name="startAt"
							defaultValue={toLocalInput(config.startAt)}
							required
							className="demo-input"
						/>
					</ConfigField>
					<ConfigField
						label="立项截止"
						error={errors.proposalDeadline}
						required
					>
						<input
							type="datetime-local"
							name="proposalDeadline"
							defaultValue={toLocalInput(config.proposalDeadline)}
							required
							className="demo-input"
						/>
					</ConfigField>
					<ConfigField
						label="稿件提交截止"
						error={errors.submissionDeadline}
						required
					>
						<input
							type="datetime-local"
							name="submissionDeadline"
							defaultValue={toLocalInput(config.submissionDeadline)}
							required
							className="demo-input"
						/>
					</ConfigField>
					<ConfigField
						label="信息补充截止"
						error={errors.infoSupplementDeadline}
						required
					>
						<input
							type="datetime-local"
							name="infoSupplementDeadline"
							defaultValue={toLocalInput(config.infoSupplementDeadline)}
							required
							className="demo-input"
						/>
					</ConfigField>
				</div>
				<p className="demo-muted m-0 text-xs">
					需满足时序：开始 ≤ 立项截止 ≤ 稿件提交 ≤ 信息补充截止。
				</p>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						name="publish"
						defaultChecked={config.status === "published"}
						className="h-4 w-4 accent-[var(--lagoon-deep)]"
					/>
					公开活动（用户侧可见并可参与）
				</label>
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
				<button type="submit" disabled={busy} className="demo-button w-fit">
					{busy ? "保存中..." : "保存基础信息"}
				</button>
			</form>
		</section>
	);
}

function FormBuilderSection({
	config,
	activityId,
	onSaved,
}: {
	config: ActivityConfig;
	activityId: string;
	onSaved: () => void;
}) {
	const [schema, setSchema] = useState<FormQuestion[]>(config.formSchema);
	const [message, setMessage] = useState("");
	const [isError, setIsError] = useState(false);
	const [busy, setBusy] = useState(false);

	const save = async () => {
		setBusy(true);
		setMessage("");
		const res = await fetch("/api/organizer/activity-config", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ action: "saveForm", activityId, schema }),
		});
		const json = (await res.json()) as {
			ok: boolean;
			error?: string;
			formErrors?: Record<string, string>;
		};
		setBusy(false);
		if (!json.ok) {
			setIsError(true);
			setMessage(
				json.formErrors
					? `题目有误：${Object.values(json.formErrors).join("；")}`
					: (json.error ?? "保存失败"),
			);
			return;
		}
		setIsError(false);
		setMessage("立项表单已保存，将生效于用户侧。");
		onSaved();
	};

	return (
		<section className="demo-panel">
			<h2 className="m-0 mb-2 text-lg font-bold text-[var(--sea-ink)]">
				立项表单自定义
			</h2>
			<p className="demo-muted mb-4 text-sm">
				系统强制字段（邮箱 / 用户名 /
				项目标题）始终存在、不可删改。以下为自定义题目。
			</p>

			<div className="mb-4">
				<FormSchemaBuilder
					schema={schema}
					onChange={setSchema}
					presets={config.presets}
				/>
			</div>

			{message && (
				<div
					className={isError ? "demo-alert demo-alert-danger" : "demo-alert"}
				>
					<p className="m-0 text-sm">{message}</p>
				</div>
			)}
			<button
				type="button"
				onClick={save}
				disabled={busy}
				className="demo-button mt-3 w-fit"
			>
				{busy ? "保存中..." : "保存立项表单"}
			</button>
		</section>
	);
}

function ConfigField({
	label,
	error,
	required,
	children,
}: {
	label: string;
	error?: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div className="grid gap-1.5">
			<span className="text-sm font-medium">
				{label}
				{required && <span className="ml-1 text-red-600">*</span>}
			</span>
			{children}
			{error && <p className="m-0 text-xs text-red-600">{error}</p>}
		</div>
	);
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

function formatDate(date: Date): string {
	return dateFormatter.format(date);
}
