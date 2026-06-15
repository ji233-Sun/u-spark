import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { authClient } from "#/lib/auth-client";
import type { AdminActivityRecord } from "./api/admin/activities";
import type { EmailTemplateRecord } from "./api/admin/email-templates";
import type { PresetRecord } from "./api/admin/presets";
import type { AdminUserRecord } from "./api/admin/users";

export const Route = createFileRoute("/admin")({
	component: AdminPage,
});

function isAdminUser(u: unknown): boolean {
	return (
		typeof u === "object" &&
		u !== null &&
		"role" in u &&
		(u as { role?: string }).role === "admin"
	);
}

async function postJson(url: string, payload: unknown) {
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	});
	return (await res.json()) as {
		ok: boolean;
		error?: string;
		errors?: Record<string, string>;
	};
}

function AdminPage() {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return (
			<main className="demo-page demo-page-wide">
				<div className="demo-panel animate-pulse h-40" />
			</main>
		);
	}
	if (!session?.user || !isAdminUser(session.user)) {
		return (
			<main className="demo-page">
				<section className="demo-panel text-center">
					<h1 className="demo-title">需要管理员权限</h1>
					<p className="demo-muted mt-3 text-sm">此页面仅管理员可访问。</p>
					<Link to="/" className="demo-button mt-6 no-underline">
						返回首页
					</Link>
				</section>
			</main>
		);
	}

	return (
		<main className="demo-page demo-page-wide">
			<header className="mb-6">
				<p className="island-kicker mb-2">Admin</p>
				<h1 className="demo-title">管理员后台</h1>
				<p className="demo-muted mt-3 text-sm">
					创建活动并指派组织者、维护预设题库与邮件模板、管理全平台用户。
				</p>
			</header>
			<div className="grid gap-6">
				<ActivitiesSection />
				<PresetsSection />
				<EmailTemplatesSection />
				<UsersSection />
			</div>
		</main>
	);
}

// ── 活动 & 组织者 ──
function ActivitiesSection() {
	const [items, setItems] = useState<AdminActivityRecord[]>([]);
	const [error, setError] = useState("");

	const load = () => {
		void fetch("/api/admin/activities")
			.then((r) => r.json())
			.then((j: { activities?: AdminActivityRecord[] }) =>
				setItems(j.activities ?? []),
			);
	};
	useEffect(load, []);

	const create = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const form = e.currentTarget;
		const j = await postJson("/api/admin/activities", {
			title: fd.get("title"),
			description: fd.get("description"),
			startAt: fd.get("startAt"),
			proposalDeadline: fd.get("proposalDeadline"),
			submissionDeadline: fd.get("submissionDeadline"),
			infoSupplementDeadline: fd.get("infoSupplementDeadline"),
		});
		if (!j.ok) {
			setError(
				j.error ?? (j.errors ? Object.values(j.errors).join("；") : "创建失败"),
			);
			return;
		}
		setError("");
		form.reset();
		load();
	};

	const manageOrganizer = async (
		activityId: string,
		email: string,
		action: "add" | "remove",
	) => {
		const j = await postJson("/api/admin/organizers", {
			activityId,
			email,
			action,
		});
		if (!j.ok) {
			setError(j.error ?? "操作失败");
			return;
		}
		setError("");
		load();
	};

	return (
		<section className="demo-panel">
			<h2 className="m-0 mb-4 text-lg font-bold text-[var(--sea-ink)]">
				活动 & 组织者
			</h2>
			{error && (
				<p className="demo-alert demo-alert-danger m-0 mb-3 text-sm">{error}</p>
			)}

			<form
				onSubmit={create}
				className="mb-5 grid gap-3 rounded-xl border border-[var(--line)] p-4"
			>
				<input
					name="title"
					placeholder="活动名称"
					required
					className="demo-input"
				/>
				<textarea
					name="description"
					placeholder="简介（选填）"
					className="demo-textarea"
				/>
				<div className="grid gap-3 sm:grid-cols-2">
					<label className="grid gap-1 text-xs">
						开始时间
						<input
							type="datetime-local"
							name="startAt"
							required
							className="demo-input"
						/>
					</label>
					<label className="grid gap-1 text-xs">
						立项截止
						<input
							type="datetime-local"
							name="proposalDeadline"
							required
							className="demo-input"
						/>
					</label>
					<label className="grid gap-1 text-xs">
						稿件提交截止
						<input
							type="datetime-local"
							name="submissionDeadline"
							required
							className="demo-input"
						/>
					</label>
					<label className="grid gap-1 text-xs">
						信息补充截止
						<input
							type="datetime-local"
							name="infoSupplementDeadline"
							required
							className="demo-input"
						/>
					</label>
				</div>
				<button type="submit" className="demo-button w-fit">
					创建活动
				</button>
			</form>

			<div className="grid gap-3">
				{items.map((a) => (
					<article
						key={a.id}
						className="rounded-xl border border-[var(--line)] p-4"
					>
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="m-0 text-base font-bold text-[var(--sea-ink)]">
								{a.title}
							</h3>
							<span className="demo-pill text-xs">{a.status}</span>
						</div>
						<p className="demo-muted mt-1 text-sm">
							组织者：{a.organizers.length ? a.organizers.join("、") : "未指派"}
						</p>
						<form
							className="mt-2 flex flex-wrap gap-2"
							onSubmit={(e) => {
								e.preventDefault();
								const fd = new FormData(e.currentTarget);
								void manageOrganizer(
									a.id,
									String(fd.get("email") ?? ""),
									"add",
								);
								e.currentTarget.reset();
							}}
						>
							<input
								name="email"
								type="email"
								placeholder="组织者邮箱"
								className="demo-input flex-1"
							/>
							<button
								type="submit"
								className="demo-button demo-button-secondary text-sm"
							>
								指派
							</button>
						</form>
					</article>
				))}
				{items.length === 0 && <p className="demo-muted text-sm">暂无活动。</p>}
			</div>
		</section>
	);
}

// ── 预设题库 ──
function PresetsSection() {
	const [items, setItems] = useState<PresetRecord[]>([]);
	const load = () => {
		void fetch("/api/admin/presets")
			.then((r) => r.json())
			.then((j: { presets?: PresetRecord[] }) => setItems(j.presets ?? []));
	};
	useEffect(load, []);

	const create = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const form = e.currentTarget;
		const optionsRaw = String(fd.get("options") ?? "").trim();
		await postJson("/api/admin/presets", {
			action: "create",
			type: fd.get("type"),
			label: fd.get("label"),
			options: optionsRaw
				? optionsRaw
						.split("\n")
						.map((s) => s.trim())
						.filter(Boolean)
				: undefined,
			ratingMax: fd.get("ratingMax") ? Number(fd.get("ratingMax")) : undefined,
		});
		form.reset();
		load();
	};
	const remove = async (presetId: string) => {
		await postJson("/api/admin/presets", { action: "delete", presetId });
		load();
	};

	return (
		<section className="demo-panel">
			<h2 className="m-0 mb-4 text-lg font-bold text-[var(--sea-ink)]">
				预设问题库
			</h2>
			<form
				onSubmit={create}
				className="mb-4 grid gap-3 rounded-xl border border-[var(--line)] p-4 sm:grid-cols-2"
			>
				<input
					name="label"
					placeholder="题目标题"
					required
					className="demo-input"
				/>
				<select name="type" className="demo-select">
					<option value="text">单行文本</option>
					<option value="textarea">多行文本</option>
					<option value="single">单选</option>
					<option value="multi">多选</option>
					<option value="rating">评分</option>
					<option value="date">日期</option>
				</select>
				<textarea
					name="options"
					placeholder="选项（每行一个，单/多选用）"
					className="demo-textarea"
				/>
				<input
					name="ratingMax"
					type="number"
					min="1"
					placeholder="评分上限（评分题用）"
					className="demo-input"
				/>
				<button type="submit" className="demo-button w-fit">
					添加题目
				</button>
			</form>
			<div className="grid gap-2">
				{items.map((p) => (
					<div
						key={p.id}
						className="flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
					>
						<span>
							{p.label}（{p.type}）
							{p.options ? ` · ${p.options.join("/")}` : ""}
							{p.ratingMax ? ` · 1-${p.ratingMax}` : ""}
						</span>
						<button
							type="button"
							className="demo-button demo-button-danger text-xs"
							onClick={() => remove(p.id)}
						>
							删除
						</button>
					</div>
				))}
				{items.length === 0 && <p className="demo-muted text-sm">题库为空。</p>}
			</div>
		</section>
	);
}

// ── 邮件模板 ──
function EmailTemplatesSection() {
	const [items, setItems] = useState<EmailTemplateRecord[]>([]);
	const load = () => {
		void fetch("/api/admin/email-templates")
			.then((r) => r.json())
			.then((j: { templates?: EmailTemplateRecord[] }) =>
				setItems(j.templates ?? []),
			);
	};
	useEffect(load, []);

	const save = async (key: string, subject: string, body: string) => {
		await postJson("/api/admin/email-templates", { key, subject, body });
		load();
	};
	const reset = async (key: string) => {
		await postJson("/api/admin/email-templates", { action: "reset", key });
		load();
	};

	return (
		<section className="demo-panel">
			<h2 className="m-0 mb-2 text-lg font-bold text-[var(--sea-ink)]">
				邮件模板
			</h2>
			<p className="demo-muted mb-4 text-sm">
				正文用 {"{占位符}"} 插值（如 {"{projectTitle}"}
				）。未覆盖时展示内置模板的占位形态。
			</p>
			<div className="grid gap-3">
				{items.map((t) => (
					<TemplateEditor
						key={t.key}
						template={t}
						onSave={save}
						onReset={reset}
					/>
				))}
			</div>
		</section>
	);
}

function TemplateEditor({
	template,
	onSave,
	onReset,
}: {
	template: EmailTemplateRecord;
	onSave: (key: string, subject: string, body: string) => void;
	onReset: (key: string) => void;
}) {
	const [subject, setSubject] = useState(template.subject);
	const [body, setBody] = useState(template.body);

	return (
		<details className="rounded-xl border border-[var(--line)] p-3">
			<summary className="cursor-pointer text-sm font-medium">
				{template.key}
				{template.isOverride && (
					<span className="demo-pill ml-2 text-xs text-amber-700">已覆盖</span>
				)}
			</summary>
			<div className="mt-3 grid gap-2">
				<input
					value={subject}
					onChange={(e) => setSubject(e.target.value)}
					className="demo-input"
					placeholder="主题"
				/>
				<textarea
					value={body}
					onChange={(e) => setBody(e.target.value)}
					className="demo-textarea"
					placeholder="正文"
				/>
				<div className="flex gap-2">
					<button
						type="button"
						className="demo-button text-sm"
						onClick={() => onSave(template.key, subject, body)}
					>
						保存覆盖
					</button>
					{template.isOverride && (
						<button
							type="button"
							className="demo-button demo-button-secondary text-sm"
							onClick={() => onReset(template.key)}
						>
							恢复内置
						</button>
					)}
				</div>
			</div>
		</details>
	);
}

// ── 用户 ──
function UsersSection() {
	const [items, setItems] = useState<AdminUserRecord[]>([]);
	const [error, setError] = useState("");
	const load = () => {
		void fetch("/api/admin/users")
			.then((r) => r.json())
			.then((j: { users?: AdminUserRecord[] }) => setItems(j.users ?? []));
	};
	useEffect(load, []);

	const setRole = async (userId: string, role: "user" | "admin") => {
		const j = await postJson("/api/admin/users", { userId, role });
		if (!j.ok) {
			setError(j.error ?? "操作失败");
			return;
		}
		setError("");
		load();
	};

	return (
		<section className="demo-panel">
			<h2 className="m-0 mb-4 text-lg font-bold text-[var(--sea-ink)]">
				用户管理
			</h2>
			{error && (
				<p className="demo-alert demo-alert-danger m-0 mb-3 text-sm">{error}</p>
			)}
			<div className="grid gap-2">
				{items.map((u) => (
					<div
						key={u.id}
						className="flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
					>
						<span>
							{u.name}（{u.email}） · <strong>{u.role}</strong>
						</span>
						<button
							type="button"
							className="demo-button demo-button-secondary text-xs"
							onClick={() =>
								setRole(u.id, u.role === "admin" ? "user" : "admin")
							}
						>
							{u.role === "admin" ? "降为 user" : "升为 admin"}
						</button>
					</div>
				))}
				{items.length === 0 && <p className="demo-muted text-sm">暂无用户。</p>}
			</div>
		</section>
	);
}
