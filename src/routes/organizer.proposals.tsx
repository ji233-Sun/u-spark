import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProjectStatusBadge } from "#/components/ui";
import { authClient } from "#/lib/auth-client";
import type { OrganizerProposalRecord } from "./api/organizer/proposals";

export const Route = createFileRoute("/organizer/proposals")({
	component: OrganizerProposalsPage,
});

function OrganizerProposalsPage() {
	const { data: session, isPending } = authClient.useSession();
	const [proposals, setProposals] = useState<OrganizerProposalRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [busyId, setBusyId] = useState<string | null>(null);

	useEffect(() => {
		if (isPending || !session?.user) return;
		let cancelled = false;
		setLoading(true);
		void fetch("/api/organizer/proposals")
			.then(async (response) => {
				const json = (await response.json()) as {
					ok: boolean;
					error?: string;
					proposals?: OrganizerProposalRecord[];
				};
				if (!response.ok || !json.ok) throw new Error(json.error ?? "加载失败");
				if (!cancelled) {
					setProposals(json.proposals ?? []);
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

	if (isPending) return <OrganizerLoading />;

	if (!session?.user) {
		return (
			<main className="demo-page">
				<section className="demo-panel text-center">
					<h1 className="demo-title">请先登录</h1>
					<p className="demo-muted mt-3 text-sm">
						登录后可审核负责活动的立项。
					</p>
					<Link to="/auth" className="demo-button mt-6 no-underline">
						去登录
					</Link>
				</section>
			</main>
		);
	}

	const review = async (
		proposal: OrganizerProposalRecord,
		decision: "approve" | "reject",
		form?: HTMLFormElement,
	) => {
		setBusyId(proposal.id);
		setError("");
		const reason = form ? String(new FormData(form).get("reason") ?? "") : "";
		const response = await fetch("/api/organizer/proposals", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ projectId: proposal.id, decision, reason }),
		});
		const json = (await response.json()) as { ok: boolean; error?: string };
		setBusyId(null);
		if (!response.ok || !json.ok) {
			setError(json.error ?? "审核失败");
			return;
		}
		setProposals((items) => items.filter((item) => item.id !== proposal.id));
	};

	return (
		<main className="demo-page demo-page-wide">
			<header className="mb-6">
				<p className="island-kicker mb-2">Organizer</p>
				<h1 className="demo-title">立项审核</h1>
				<p className="demo-muted mt-3 text-sm">
					仅展示你负责活动中的待审核立项。
				</p>
			</header>

			{loading ? (
				<OrganizerLoading />
			) : error ? (
				<section className="demo-alert demo-alert-danger mb-4">
					<p className="m-0 text-sm text-red-600">{error}</p>
				</section>
			) : null}

			{!loading && proposals.length === 0 && !error ? (
				<section className="demo-panel text-center">
					<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
						暂无待审核立项
					</h2>
					<p className="demo-muted mt-2 text-sm">
						新的立项提交后会出现在这里。
					</p>
				</section>
			) : (
				<section className="grid gap-4">
					{proposals.map((proposal) => (
						<article key={proposal.id} className="demo-list-item">
							<div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
								<div>
									<div className="mb-2 flex flex-wrap items-center gap-2">
										<ProjectStatusBadge status={proposal.status} />
										<span className="demo-muted text-xs">
											提交于 {formatDate(new Date(proposal.createdAt))}
										</span>
									</div>
									<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
										{proposal.title}
									</h2>
									<p className="demo-muted mt-2 text-sm">
										活动：{proposal.activityTitle}
									</p>
									<p className="demo-muted mt-1 text-sm">
										提交人：{proposal.creatorName}（{proposal.creatorEmail}）
									</p>
								</div>

								<form
									className="grid gap-3"
									onSubmit={(event) => {
										event.preventDefault();
										void review(proposal, "reject", event.currentTarget);
									}}
								>
									<textarea
										name="reason"
										placeholder="拒绝原因"
										className="demo-textarea min-h-24"
										disabled={busyId === proposal.id}
									/>
									<div className="grid gap-2 sm:grid-cols-2">
										<button
											type="button"
											disabled={busyId === proposal.id}
											className="demo-button"
											onClick={() => void review(proposal, "approve")}
										>
											通过
										</button>
										<button
											type="submit"
											disabled={busyId === proposal.id}
											className="demo-button demo-button-danger"
										>
											拒绝
										</button>
									</div>
								</form>
							</div>
						</article>
					))}
				</section>
			)}
		</main>
	);
}

function OrganizerLoading() {
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
