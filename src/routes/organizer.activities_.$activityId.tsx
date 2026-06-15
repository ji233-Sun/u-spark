import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { FormSchemaBuilder } from "#/components/forms/FormSchemaBuilder";
import type { FormQuestion } from "#/db/celebration-schema";
import { authClient } from "#/lib/auth-client";
import type { ActivityConfig } from "./api/organizer/activity-config";

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
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = () => {
		setLoading(true);
		void fetch(`/api/organizer/activity-config?activityId=${activityId}`)
			.then(async (res) => {
				const json = (await res.json()) as {
					ok: boolean;
					error?: string;
					config?: ActivityConfig;
				};
				if (!res.ok || !json.ok) throw new Error(json.error ?? "加载失败");
				setConfig(json.config ?? null);
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

			<BasicsSection config={config} activityId={activityId} onSaved={load} />
			<FormBuilderSection
				config={config}
				activityId={activityId}
				onSaved={load}
			/>
		</main>
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
