import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { authClient } from "#/lib/auth-client";
import type {
	AuthorsPayload,
	ProjectAuthorRecord,
} from "./api/projects/authors";

export const Route = createFileRoute("/projects_/$projectId/authors")({
	component: AuthorsPage,
});

type MutateBody = Record<string, unknown> & { action: string };

function AuthorsPage() {
	const { projectId } = Route.useParams();
	const { data: session, isPending } = authClient.useSession();
	const [payload, setPayload] = useState<AuthorsPayload | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = () => {
		setLoading(true);
		void fetch(`/api/projects/authors?projectId=${projectId}`)
			.then(async (res) => {
				const json = (await res.json()) as {
					ok: boolean;
					error?: string;
					payload?: AuthorsPayload;
				};
				if (!res.ok || !json.ok) throw new Error(json.error ?? "加载失败");
				setPayload(json.payload ?? null);
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

	const mutate = async (
		body: MutateBody,
	): Promise<Record<string, string> | null> => {
		const res = await fetch("/api/projects/authors", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ ...body, projectId }),
		});
		const json = (await res.json()) as {
			ok: boolean;
			error?: string;
			errors?: Record<string, string>;
			authors?: ProjectAuthorRecord[];
		};
		if (!res.ok || !json.ok) {
			if (json.errors) return json.errors;
			setError(json.error ?? "操作失败");
			return null;
		}
		setError("");
		setPayload((prev) =>
			prev ? { ...prev, authors: json.authors ?? prev.authors } : prev,
		);
		return null;
	};

	if (isPending || (loading && !payload)) return <AuthorsLoading />;
	if (!session?.user) {
		return (
			<Prompt
				title="请先登录"
				body="登录后可管理作者信息。"
				to="/auth"
				cta="去登录"
			/>
		);
	}
	if (error && !payload) {
		return (
			<Prompt
				title="无法加载"
				body={error}
				to="/my/proposals"
				cta="返回我的立项"
			/>
		);
	}
	if (!payload) return <AuthorsLoading />;

	return (
		<main className="demo-page demo-page-wide">
			<Link to="/my/proposals" className="demo-muted text-sm no-underline">
				返回我的立项
			</Link>
			<header className="mt-4 mb-6">
				<p className="island-kicker mb-2">Authors</p>
				<h1 className="demo-title">多作者管理</h1>
				<p className="demo-muted mt-3 text-sm">
					{payload.projectTitle} · 昵称 / B站UID / 职能 /
					收货地址（敏感信息仅本人与组织者可见）。
				</p>
				{!payload.canManage && (
					<div className="demo-alert demo-alert-danger mt-3">
						<p className="m-0 text-sm">信息补充已截止，作者信息已锁定。</p>
					</div>
				)}
			</header>

			{error && (
				<section className="demo-alert demo-alert-danger mb-4">
					<p className="m-0 text-sm text-red-600">{error}</p>
				</section>
			)}

			<section className="grid gap-4">
				{payload.authors.map((author) => (
					<AuthorCard
						key={author.id}
						author={author}
						canManage={payload.canManage}
						mutate={mutate}
					/>
				))}
				{payload.authors.length === 0 && (
					<p className="demo-muted text-sm">还没有作者，先添加一位吧。</p>
				)}
			</section>

			{payload.canManage && (
				<section className="demo-panel mt-6">
					<h2 className="m-0 mb-4 text-lg font-bold text-[var(--sea-ink)]">
						添加作者
					</h2>
					<AuthorForm
						submitLabel="添加作者"
						onSubmit={(values) => mutate({ action: "create", ...values })}
					/>
				</section>
			)}
		</main>
	);
}

function AuthorCard({
	author,
	canManage,
	mutate,
}: {
	author: ProjectAuthorRecord;
	canManage: boolean;
	mutate: (body: MutateBody) => Promise<Record<string, string> | null>;
}) {
	const [editing, setEditing] = useState(false);
	const [shipOpen, setShipOpen] = useState(false);

	return (
		<article className="demo-list-item">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="m-0 text-base font-bold text-[var(--sea-ink)]">
					{author.displayName}
				</h3>
				{author.duty && (
					<span className="demo-pill text-xs">{author.duty}</span>
				)}
				{author.bilibiliUid && (
					<span className="demo-muted text-xs">
						B站UID：{author.bilibiliUid}
					</span>
				)}
			</div>

			{author.shipping ? (
				<p className="demo-muted mt-2 text-sm">
					收件：{author.shipping.recipientName} · {author.shipping.phone} ·{" "}
					{author.shipping.address}
					{author.shipping.note ? `（${author.shipping.note}）` : ""}
				</p>
			) : (
				<p className="demo-muted mt-2 text-sm">未登记收货地址</p>
			)}

			{canManage && (
				<div className="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						className="demo-button demo-button-secondary"
						onClick={() => setEditing((v) => !v)}
					>
						{editing ? "取消编辑" : "编辑信息"}
					</button>
					<button
						type="button"
						className="demo-button demo-button-secondary"
						onClick={() => setShipOpen((v) => !v)}
					>
						{shipOpen ? "收起收货" : "收货地址"}
					</button>
					<button
						type="button"
						className="demo-button demo-button-danger"
						onClick={() => {
							if (confirm(`确认删除作者「${author.displayName}」？`)) {
								void mutate({ action: "delete", authorId: author.id });
							}
						}}
					>
						删除
					</button>
				</div>
			)}

			{editing && canManage && (
				<div className="mt-4 border-t border-[var(--line)] pt-4">
					<AuthorForm
						submitLabel="保存修改"
						initial={author}
						onSubmit={async (values) => {
							const errs = await mutate({
								action: "update",
								authorId: author.id,
								...values,
							});
							if (!errs) setEditing(false);
							return errs;
						}}
					/>
				</div>
			)}

			{shipOpen && canManage && (
				<div className="mt-4 border-t border-[var(--line)] pt-4">
					<ShippingForm
						initial={author.shipping}
						onSubmit={(shipping) =>
							mutate({ action: "setShipping", authorId: author.id, shipping })
						}
						onClear={
							author.shipping
								? () =>
										mutate({ action: "deleteShipping", authorId: author.id })
								: undefined
						}
					/>
				</div>
			)}
		</article>
	);
}

function AuthorForm({
	submitLabel,
	initial,
	onSubmit,
}: {
	submitLabel: string;
	initial?: ProjectAuthorRecord;
	onSubmit: (values: {
		displayName: string;
		bilibiliUid: string;
		duty: string;
	}) => Promise<Record<string, string> | null>;
}) {
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);

	const handle = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setBusy(true);
		const fd = new FormData(e.currentTarget);
		const form = e.currentTarget;
		const errs = await onSubmit({
			displayName: String(fd.get("displayName") ?? ""),
			bilibiliUid: String(fd.get("bilibiliUid") ?? ""),
			duty: String(fd.get("duty") ?? ""),
		});
		setBusy(false);
		setErrors(errs ?? {});
		if (!errs && !initial) form.reset();
	};

	return (
		<form onSubmit={handle} className="grid gap-3">
			<Field label="昵称" error={errors.displayName} required>
				<input
					name="displayName"
					defaultValue={initial?.displayName ?? ""}
					required
					className="demo-input"
				/>
			</Field>
			<div className="grid gap-3 sm:grid-cols-2">
				<Field label="B站 UID" error={errors.bilibiliUid} required>
					<input
						name="bilibiliUid"
						defaultValue={initial?.bilibiliUid ?? ""}
						required
						inputMode="numeric"
						pattern="[0-9]{1,15}"
						className="demo-input"
					/>
				</Field>
				<Field label="职能" error={errors.duty} required>
					<input
						name="duty"
						defaultValue={initial?.duty ?? ""}
						placeholder="导演 / 剪辑 / 后期…"
						required
						className="demo-input"
					/>
				</Field>
			</div>
			<button type="submit" disabled={busy} className="demo-button w-fit">
				{busy ? "保存中..." : submitLabel}
			</button>
		</form>
	);
}

function ShippingForm({
	initial,
	onSubmit,
	onClear,
}: {
	initial: ProjectAuthorRecord["shipping"];
	onSubmit: (shipping: {
		recipientName: string;
		phone: string;
		address: string;
		note: string;
	}) => Promise<Record<string, string> | null>;
	onClear?: () => void;
}) {
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);

	const handle = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setBusy(true);
		const fd = new FormData(e.currentTarget);
		const errs = await onSubmit({
			recipientName: String(fd.get("recipientName") ?? ""),
			phone: String(fd.get("phone") ?? ""),
			address: String(fd.get("address") ?? ""),
			note: String(fd.get("note") ?? ""),
		});
		setBusy(false);
		setErrors(errs ?? {});
	};

	return (
		<form onSubmit={handle} className="grid gap-3">
			<div className="grid gap-3 sm:grid-cols-2">
				<Field label="收件人" error={errors.recipientName} required>
					<input
						name="recipientName"
						defaultValue={initial?.recipientName ?? ""}
						required
						className="demo-input"
					/>
				</Field>
				<Field label="联系电话" error={errors.phone} required>
					<input
						name="phone"
						defaultValue={initial?.phone ?? ""}
						required
						className="demo-input"
					/>
				</Field>
			</div>
			<Field label="收货地址" error={errors.address} required>
				<input
					name="address"
					defaultValue={initial?.address ?? ""}
					required
					className="demo-input"
				/>
			</Field>
			<Field label="备注（选填）">
				<input
					name="note"
					defaultValue={initial?.note ?? ""}
					className="demo-input"
				/>
			</Field>
			<div className="flex gap-2">
				<button type="submit" disabled={busy} className="demo-button w-fit">
					{busy ? "保存中..." : "保存收货地址"}
				</button>
				{onClear && (
					<button
						type="button"
						className="demo-button demo-button-secondary w-fit"
						onClick={onClear}
					>
						清除
					</button>
				)}
			</div>
		</form>
	);
}

function Field({
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

function Prompt({
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

function AuthorsLoading() {
	return (
		<main className="demo-page demo-page-wide">
			<section className="grid gap-4">
				{["one", "two"].map((i) => (
					<div key={i} className="demo-list-item animate-pulse">
						<div className="mb-2 h-5 w-1/3 rounded bg-[var(--chip-line)]" />
						<div className="h-4 w-2/3 rounded bg-[var(--chip-line)]" />
					</div>
				))}
			</section>
		</main>
	);
}
