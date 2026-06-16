import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { ProjectStatusBadge } from "#/components/ui";
import { authClient } from "#/lib/auth-client";
import type { RemunerationRecord } from "./api/organizer/payments";

export const Route = createFileRoute("/organizer/payments")({
	component: PaymentsPage,
});

function PaymentsPage() {
	const { data: session, isPending } = authClient.useSession();
	const [records, setRecords] = useState<RemunerationRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = () => {
		setLoading(true);
		void fetch("/api/organizer/payments")
			.then(async (res) => {
				const json = (await res.json()) as {
					ok: boolean;
					error?: string;
					records?: RemunerationRecord[];
				};
				if (!res.ok || !json.ok) throw new Error(json.error ?? "加载失败");
				setRecords(json.records ?? []);
				setError("");
			})
			.catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
			.finally(() => setLoading(false));
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: 仅依赖会话状态触发首屏加载
	useEffect(() => {
		if (isPending || !session?.user) return;
		load();
	}, [isPending, session?.user]);

	if (isPending) return <PaymentsLoading />;
	if (!session?.user) {
		return (
			<main className="demo-page">
				<section className="demo-panel text-center">
					<h1 className="demo-title">请先登录</h1>
					<p className="demo-muted mt-3 text-sm">登录后可核定稿酬。</p>
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
				<h1 className="demo-title">稿酬分配</h1>
				<p className="demo-muted mt-3 text-sm">
					稿酬分配归入信息补充阶段，仅展示已进入信息补充的项目。
				</p>
			</header>

			{loading ? (
				<PaymentsLoading />
			) : error ? (
				<section className="demo-alert demo-alert-danger mb-4">
					<p className="m-0 text-sm text-red-600">{error}</p>
				</section>
			) : records.length === 0 ? (
				<section className="demo-panel text-center">
					<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
						暂无可核定稿酬的立项
					</h2>
					<p className="demo-muted mt-2 text-sm">
						稿件审核通过并进入信息补充后会出现在这里。
					</p>
				</section>
			) : (
				<section className="grid gap-4">
					{records.map((record) => (
						<PaymentCard
							key={record.projectId}
							record={record}
							onSaved={load}
							onError={setError}
						/>
					))}
				</section>
			)}
		</main>
	);
}

function PaymentCard({
	record,
	onSaved,
	onError,
}: {
	record: RemunerationRecord;
	onSaved: () => void;
	onError: (msg: string) => void;
}) {
	const [busy, setBusy] = useState(false);

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setBusy(true);
		onError("");
		const fd = new FormData(e.currentTarget);
		const res = await fetch("/api/organizer/payments", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				projectId: record.projectId,
				amount: String(fd.get("amount") ?? ""),
				status: fd.get("paid") === "on" ? "paid" : "pending",
				note: String(fd.get("note") ?? ""),
			}),
		});
		const json = (await res.json()) as { ok: boolean; error?: string };
		setBusy(false);
		if (!res.ok || !json.ok) {
			onError(json.error ?? "保存失败");
			return;
		}
		onSaved();
	};

	return (
		<article className="demo-list-item">
			<div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
				<div>
					<div className="mb-2 flex flex-wrap items-center gap-2">
						<ProjectStatusBadge status={record.projectStatus} />
						{record.amount && (
							<span className="demo-pill text-xs">
								已核定 {record.amount} 元 ·{" "}
								{record.status === "paid" ? "已发放" : "待发放"}
							</span>
						)}
					</div>
					<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
						{record.projectTitle}
					</h2>
					<p className="demo-muted mt-2 text-sm">
						活动：{record.activityTitle}
					</p>
					<p className="demo-muted mt-1 text-sm">
						作者：{record.creatorName}（{record.creatorEmail}）
					</p>
				</div>

				<form onSubmit={handleSubmit} className="grid gap-3">
					<div className="grid gap-1.5">
						<span className="text-sm font-medium">稿酬总额（元）</span>
						<input
							name="amount"
							type="number"
							min="0.01"
							step="0.01"
							defaultValue={record.amount ?? ""}
							required
							disabled={busy}
							className="demo-input"
						/>
					</div>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							name="paid"
							defaultChecked={record.status === "paid"}
							disabled={busy}
							className="h-4 w-4 accent-[var(--lagoon-deep)]"
						/>
						标记为已发放
					</label>
					<input
						name="note"
						placeholder="备注（选填）"
						disabled={busy}
						className="demo-input"
					/>
					<button type="submit" disabled={busy} className="demo-button">
						{busy ? "保存中..." : record.amount ? "更新稿酬" : "核定稿酬"}
					</button>
				</form>
			</div>
		</article>
	);
}

function PaymentsLoading() {
	return (
		<main className="demo-page demo-page-wide">
			<section className="grid gap-4">
				{["one", "two"].map((i) => (
					<div key={i} className="demo-list-item animate-pulse">
						<div className="mb-3 h-5 w-28 rounded bg-[var(--chip-line)]" />
						<div className="h-20 rounded bg-[var(--chip-line)]" />
					</div>
				))}
			</section>
		</main>
	);
}
