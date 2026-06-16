import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { ProjectStatusBadge } from "#/components/ui";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
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

	const actionableRecords = records.filter(
		(record) => !record.amount || record.paymentCode,
	);

	return (
		<main className="demo-page demo-page-wide">
			<header className="mb-6">
				<p className="island-kicker mb-2">Organizer</p>
				<h1 className="demo-title">稿酬分配</h1>
				<p className="demo-muted mt-3 text-sm">
					先核定稿酬；创作者上传收款码后，再在这里发放稿酬。
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
			) : actionableRecords.length === 0 ? (
				<section className="demo-panel text-center">
					<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
						暂无可处理的稿酬
					</h2>
					<p className="demo-muted mt-2 text-sm">
						未核定稿酬的项目会在这里出现；已核定但尚未上传收款码的项目会暂时隐藏。
					</p>
				</section>
			) : (
				<section className="grid gap-4">
					{actionableRecords.map((record) =>
						record.amount && record.paymentCode ? (
							<DisbursementCard
								key={record.projectId}
								record={record}
								onSaved={load}
								onError={setError}
							/>
						) : (
							<AssignmentCard
								key={record.projectId}
								record={record}
								onSaved={load}
								onError={setError}
							/>
						),
					)}
				</section>
			)}
		</main>
	);
}

function ProjectSummary({ record }: { record: RemunerationRecord }) {
	return (
		<div>
			<div className="mb-2 flex flex-wrap items-center gap-2">
				<ProjectStatusBadge status={record.projectStatus} />
				{record.amount ? (
					<span className="demo-pill text-xs">
						已核定 {record.amount} 元 ·{" "}
						{record.status === "paid" ? "已发放" : "待发放"}
					</span>
				) : (
					<span className="demo-pill text-xs">待核定稿酬</span>
				)}
			</div>
			<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
				{record.projectTitle}
			</h2>
			<p className="demo-muted mt-2 text-sm">活动：{record.activityTitle}</p>
			<p className="demo-muted mt-1 text-sm">
				作者：{record.creatorName}（{record.creatorEmail}）
			</p>
		</div>
	);
}

function AssignmentCard({
	record,
	onSaved,
	onError,
}: {
	record: RemunerationRecord;
	onSaved: () => void;
	onError: (msg: string) => void;
}) {
	const [busy, setBusy] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [draft, setDraft] = useState({ amount: "", note: "" });

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		setDraft({
			amount: String(fd.get("amount") ?? ""),
			note: String(fd.get("note") ?? ""),
		});
		setConfirmOpen(true);
	};

	const confirmAssignment = async () => {
		setBusy(true);
		onError("");
		const res = await fetch("/api/organizer/payments", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				projectId: record.projectId,
				amount: draft.amount,
				status: "pending",
				note: draft.note,
			}),
		});
		const json = (await res.json()) as { ok: boolean; error?: string };
		setBusy(false);
		if (!res.ok || !json.ok) {
			onError(json.error ?? "保存失败");
			return;
		}
		setConfirmOpen(false);
		onSaved();
	};

	return (
		<article className="demo-list-item">
			<div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
				<ProjectSummary record={record} />

				<form onSubmit={handleSubmit} className="grid gap-3">
					<div className="grid gap-1.5">
						<span className="text-sm font-medium">稿酬总额（元）</span>
						<input
							name="amount"
							type="number"
							min="0.01"
							step="0.01"
							required
							disabled={busy}
							className="demo-input"
						/>
					</div>
					<input
						name="note"
						placeholder="备注（选填）"
						disabled={busy}
						className="demo-input"
					/>
					<button type="submit" disabled={busy} className="demo-button">
						核定稿酬
					</button>
				</form>
			</div>
			<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>确认核定稿酬</DialogTitle>
						<DialogDescription>
							核定后会通知创作者上传收款码。在收款码上传前，该项目不会出现在发放列表。
						</DialogDescription>
					</DialogHeader>
					<div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
						<p className="m-0 font-medium text-foreground">
							{record.projectTitle}
						</p>
						<p className="m-0 mt-2 text-muted-foreground">
							核定金额：{draft.amount || "-"} 元
						</p>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline" disabled={busy}>
								取消
							</Button>
						</DialogClose>
						<Button type="button" disabled={busy} onClick={confirmAssignment}>
							{busy ? "核定中..." : "确认核定"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</article>
	);
}

function DisbursementCard({
	record,
	onSaved,
	onError,
}: {
	record: RemunerationRecord;
	onSaved: () => void;
	onError: (msg: string) => void;
}) {
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState("");

	const markPaid = async () => {
		if (!record.amount) return;
		setBusy(true);
		onError("");
		const res = await fetch("/api/organizer/payments", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				projectId: record.projectId,
				amount: record.amount,
				status: "paid",
				note,
			}),
		});
		const json = (await res.json()) as { ok: boolean; error?: string };
		setBusy(false);
		if (!res.ok || !json.ok) {
			onError(json.error ?? "发放失败");
			return;
		}
		onSaved();
	};

	return (
		<article className="demo-list-item">
			<div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
				<ProjectSummary record={record} />
				<div className="grid content-start gap-3">
					<div className="rounded-lg border border-[var(--line)] bg-[var(--chip-bg)] p-4">
						<p className="m-0 text-sm font-medium text-[var(--sea-ink)]">
							待发放稿酬
						</p>
						<p className="m-0 mt-2 text-2xl font-bold text-[var(--sea-ink)]">
							{record.amount} 元
						</p>
						{record.paymentCode?.payeeName && (
							<p className="demo-muted m-0 mt-2 text-sm">
								收款人：{record.paymentCode.payeeName}
							</p>
						)}
					</div>
					<a
						href={record.paymentCode?.url}
						target="_blank"
						rel="noreferrer"
						className="demo-button demo-button-secondary no-underline"
					>
						查看收款码
					</a>
					<input
						value={note}
						onChange={(event) => setNote(event.target.value)}
						placeholder="发放备注（选填）"
						disabled={busy || record.status === "paid"}
						className="demo-input"
					/>
					<Button
						type="button"
						disabled={busy || record.status === "paid"}
						onClick={markPaid}
					>
						{record.status === "paid"
							? "已发放"
							: busy
								? "发放中..."
								: "标记为已发放"}
					</Button>
				</div>
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
