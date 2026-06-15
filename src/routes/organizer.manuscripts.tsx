import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "#/lib/auth-client";
import type { OrganizerManuscriptRecord } from "./api/organizer/manuscripts";

export const Route = createFileRoute("/organizer/manuscripts")({
	component: OrganizerManuscriptsPage,
});

function OrganizerManuscriptsPage() {
	const { data: session, isPending } = authClient.useSession();
	const [items, setItems] = useState<OrganizerManuscriptRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [busyId, setBusyId] = useState<string | null>(null);

	useEffect(() => {
		if (isPending || !session?.user) return;
		let cancelled = false;
		setLoading(true);
		void fetch("/api/organizer/manuscripts")
			.then(async (response) => {
				const json = (await response.json()) as {
					ok: boolean;
					error?: string;
					manuscripts?: OrganizerManuscriptRecord[];
				};
				if (!response.ok || !json.ok) throw new Error(json.error ?? "加载失败");
				if (!cancelled) {
					setItems(json.manuscripts ?? []);
					setError("");
				}
			})
			.catch((err) => {
				if (!cancelled)
					setError(err instanceof Error ? err.message : "加载失败");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [isPending, session?.user]);

	if (isPending) return <ManuscriptsLoading />;

	if (!session?.user) {
		return (
			<main className="demo-page">
				<section className="demo-panel text-center">
					<h1 className="demo-title">请先登录</h1>
					<p className="demo-muted mt-3 text-sm">
						登录后可审核负责活动的稿件。
					</p>
					<Link to="/auth" className="demo-button mt-6 no-underline">
						去登录
					</Link>
				</section>
			</main>
		);
	}

	const review = async (
		item: OrganizerManuscriptRecord,
		decision: "approve" | "reject" | "revise",
		reason: string,
	) => {
		setBusyId(item.projectId);
		setError("");
		const response = await fetch("/api/organizer/manuscripts", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ projectId: item.projectId, decision, reason }),
		});
		const json = (await response.json()) as { ok: boolean; error?: string };
		setBusyId(null);
		if (!response.ok || !json.ok) {
			setError(json.error ?? "审核失败");
			return;
		}
		setItems((list) => list.filter((x) => x.projectId !== item.projectId));
	};

	return (
		<main className="demo-page demo-page-wide">
			<header className="mb-6">
				<p className="island-kicker mb-2">Organizer</p>
				<h1 className="demo-title">稿件审核</h1>
				<p className="demo-muted mt-3 text-sm">
					仅展示你负责活动中已提交、待审核的稿件。
				</p>
			</header>

			{loading ? (
				<ManuscriptsLoading />
			) : error ? (
				<section className="demo-alert demo-alert-danger mb-4">
					<p className="m-0 text-sm text-red-600">{error}</p>
				</section>
			) : null}

			{!loading && items.length === 0 && !error ? (
				<section className="demo-panel text-center">
					<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
						暂无待审核稿件
					</h2>
					<p className="demo-muted mt-2 text-sm">
						新的稿件提交后会出现在这里。
					</p>
				</section>
			) : (
				<section className="grid gap-4">
					{items.map((item) => (
						<ManuscriptReviewCard
							key={item.projectId}
							item={item}
							busy={busyId === item.projectId}
							onReview={review}
						/>
					))}
				</section>
			)}
		</main>
	);
}

function ManuscriptReviewCard({
	item,
	busy,
	onReview,
}: {
	item: OrganizerManuscriptRecord;
	busy: boolean;
	onReview: (
		item: OrganizerManuscriptRecord,
		decision: "approve" | "reject" | "revise",
		reason: string,
	) => void;
}) {
	const [reason, setReason] = useState("");

	return (
		<article className="demo-list-item">
			<div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
				<div>
					<div className="mb-2 flex flex-wrap items-center gap-2">
						<span className="demo-pill text-xs">第 {item.version} 版</span>
						{item.isResubmitCopy && (
							<span className="demo-pill text-xs text-amber-700">重提副本</span>
						)}
						<span className="demo-muted text-xs">
							提交于 {formatDate(new Date(item.submittedAt))}
						</span>
					</div>
					<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
						{item.projectTitle}
					</h2>
					<p className="demo-muted mt-2 text-sm">活动：{item.activityTitle}</p>
					<p className="demo-muted mt-1 text-sm">
						提交人：{item.creatorName}（{item.creatorEmail}）
					</p>
					{item.coverUrl && (
						<img
							src={item.coverUrl}
							alt="稿件封面"
							className="mt-3 max-h-48 rounded-lg border border-[var(--line)]"
						/>
					)}
					{item.driveLink && (
						<p className="mt-3 m-0 text-sm break-all">
							网盘：
							<a
								href={item.driveLink}
								target="_blank"
								rel="noreferrer"
								className="text-[var(--lagoon-deep)]"
							>
								{item.driveLink}
							</a>
							{item.extractCode && `　提取码：${item.extractCode}`}
						</p>
					)}
					{item.note && (
						<p className="demo-muted mt-1 text-sm">备注：{item.note}</p>
					)}
				</div>

				<div className="grid gap-3">
					<textarea
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="拒绝 / 打回理由（对用户可见）"
						className="demo-textarea min-h-24"
						disabled={busy}
					/>
					<button
						type="button"
						disabled={busy}
						className="demo-button"
						onClick={() => onReview(item, "approve", "")}
					>
						通过 → 信息补充
					</button>
					<div className="grid gap-2 sm:grid-cols-2">
						<button
							type="button"
							disabled={busy}
							className="demo-button demo-button-secondary"
							onClick={() => onReview(item, "revise", reason)}
						>
							打回重交
						</button>
						<button
							type="button"
							disabled={busy}
							className="demo-button demo-button-danger"
							onClick={() => onReview(item, "reject", reason)}
						>
							拒绝
						</button>
					</div>
				</div>
			</div>
		</article>
	);
}

function ManuscriptsLoading() {
	return (
		<main className="demo-page demo-page-wide">
			<section className="grid gap-4">
				{["one", "two"].map((item) => (
					<div key={item} className="demo-list-item animate-pulse">
						<div className="mb-3 h-5 w-28 rounded bg-[var(--chip-line)]" />
						<div className="mb-2 h-6 w-1/2 rounded bg-[var(--chip-line)]" />
						<div className="h-24 rounded bg-[var(--chip-line)]" />
					</div>
				))}
			</section>
		</main>
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
