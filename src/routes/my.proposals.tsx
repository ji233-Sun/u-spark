import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProjectStatusBadge } from "#/components/ui/StatusBadge";
import { Timeline } from "#/components/ui/Timeline";
import { authClient } from "#/lib/auth-client";
import {
	canRestartProposal,
	proposalTimelineNodes,
} from "#/lib/celebration/proposal-timeline";
import type {
	ManuscriptStatus,
	ProjectStatus,
} from "#/lib/celebration/state-machine";
import type { MyProposalRecord } from "./api/my/proposals";

// 进入稿件阶段的 project 状态：展示「提交 / 查看稿件」入口
const MANUSCRIPT_STAGES: ProjectStatus[] = [
	"proposal_approved",
	"manuscript_submitted",
	"manuscript_approved",
	"info_supplement",
	"completed",
];

export const Route = createFileRoute("/my/proposals")({
	component: MyProposalsPage,
});

function MyProposalsPage() {
	const { data: session, isPending } = authClient.useSession();
	const [proposals, setProposals] = useState<MyProposalRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (isPending || !session?.user) return;
		let cancelled = false;
		setLoading(true);
		void fetch("/api/my/proposals")
			.then(async (response) => {
				const json = (await response.json()) as {
					ok: boolean;
					error?: string;
					proposals?: MyProposalRecord[];
				};
				if (!response.ok || !json.ok) {
					throw new Error(json.error ?? "加载失败");
				}
				if (!cancelled) {
					setProposals(json.proposals ?? []);
					setError("");
				}
			})
			.catch((err) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "加载失败");
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [isPending, session?.user]);

	if (isPending) {
		return <MyProposalsLoading />;
	}

	if (!session?.user) {
		return (
			<main className="demo-page">
				<section className="demo-panel text-center">
					<h1 className="demo-title">请先登录</h1>
					<p className="demo-muted mt-3 text-sm">登录后可查看你的立项状态。</p>
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
				<p className="island-kicker mb-2">My Proposals</p>
				<h1 className="demo-title">我的立项</h1>
				<p className="demo-muted mt-3 text-sm">
					查看已提交、未通过和后续稿件阶段的所有立项。
				</p>
			</header>

			{loading ? (
				<MyProposalsLoading />
			) : error ? (
				<section className="demo-alert demo-alert-danger">
					<p className="m-0 text-sm text-red-600">{error}</p>
				</section>
			) : proposals.length === 0 ? (
				<section className="demo-panel text-center">
					<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
						暂无立项
					</h2>
					<p className="demo-muted mt-2 text-sm">参与活动后会在这里展示。</p>
					<Link to="/activities" className="demo-button mt-6 no-underline">
						浏览活动
					</Link>
				</section>
			) : (
				<section className="grid gap-4">
					{proposals.map((proposal) => {
						const projectStatus = proposal.status as ProjectStatus;
						const manuscriptStatus =
							proposal.manuscriptStatus as ManuscriptStatus | null;
						return (
							<article key={proposal.id} className="demo-list-item">
								<div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
									<div>
										<div className="mb-2 flex flex-wrap items-center gap-2">
											<ProjectStatusBadge status={projectStatus} />
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
										<div className="mt-4 flex flex-wrap gap-2">
											<Link
												to="/activities/$activityId"
												params={{ activityId: proposal.activityId }}
												className="demo-button demo-button-secondary no-underline"
											>
												查看活动
											</Link>
											{MANUSCRIPT_STAGES.includes(projectStatus) && (
												<Link
													to="/projects/$projectId/manuscript"
													params={{ projectId: proposal.id }}
													className="demo-button no-underline"
												>
													{projectStatus === "proposal_approved"
														? "提交稿件"
														: "查看稿件"}
												</Link>
											)}
											{canRestartProposal(projectStatus) && (
												<Link
													to="/activities/$activityId/proposal"
													params={{ activityId: proposal.activityId }}
													className="demo-button no-underline"
												>
													重新立项
												</Link>
											)}
										</div>
									</div>
									<Timeline
										nodes={proposalTimelineNodes(
											projectStatus,
											manuscriptStatus,
										)}
									/>
								</div>
							</article>
						);
					})}
				</section>
			)}
		</main>
	);
}

function MyProposalsLoading() {
	return (
		<main className="demo-page demo-page-wide">
			<section className="grid gap-4">
				{["one", "two"].map((item) => (
					<div key={item} className="demo-list-item animate-pulse">
						<div className="mb-3 h-5 w-28 rounded bg-[var(--chip-line)]" />
						<div className="mb-2 h-6 w-1/2 rounded bg-[var(--chip-line)]" />
						<div className="h-28 rounded bg-[var(--chip-line)]" />
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
