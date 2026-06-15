import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StatusBadge } from "#/components/ui";
import { authClient } from "#/lib/auth-client";
import type { OrganizerActivityRecord } from "./api/organizer/activities";

export const Route = createFileRoute("/organizer/activities")({
	component: OrganizerActivitiesPage,
});

const STATUS_LABEL: Record<OrganizerActivityRecord["status"], string> = {
	draft: "草稿",
	published: "已公开",
	canceled: "已取消",
};
const STATUS_TONE = {
	draft: "neutral",
	published: "success",
	canceled: "danger",
} as const;

function OrganizerActivitiesPage() {
	const { data: session, isPending } = authClient.useSession();
	const [items, setItems] = useState<OrganizerActivityRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		if (isPending || !session?.user) return;
		let cancelled = false;
		void fetch("/api/organizer/activities")
			.then(async (res) => {
				const json = (await res.json()) as {
					ok: boolean;
					error?: string;
					activities?: OrganizerActivityRecord[];
				};
				if (!res.ok || !json.ok) throw new Error(json.error ?? "加载失败");
				if (!cancelled) setItems(json.activities ?? []);
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

	if (isPending || loading) {
		return (
			<main className="demo-page demo-page-wide">
				<div className="demo-panel animate-pulse h-40" />
			</main>
		);
	}
	if (!session?.user) {
		return (
			<main className="demo-page">
				<section className="demo-panel text-center">
					<h1 className="demo-title">请先登录</h1>
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
				<h1 className="demo-title">活动管理</h1>
				<p className="demo-muted mt-3 text-sm">
					配置你负责活动的基础信息、立项表单与三类截止时间。
				</p>
			</header>

			{error && (
				<section className="demo-alert demo-alert-danger mb-4">
					<p className="m-0 text-sm text-red-600">{error}</p>
				</section>
			)}

			{items.length === 0 && !error ? (
				<section className="demo-panel text-center">
					<p className="demo-muted m-0 text-sm">
						你还没有负责的活动。活动由管理员创建并指派组织者。
					</p>
				</section>
			) : (
				<section className="grid gap-4">
					{items.map((item) => (
						<article key={item.id} className="demo-list-item">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<div className="mb-2">
										<StatusBadge
											label={STATUS_LABEL[item.status]}
											tone={STATUS_TONE[item.status]}
										/>
									</div>
									<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
										{item.title}
									</h2>
								</div>
								<Link
									to="/organizer/activities/$activityId"
									params={{ activityId: item.id }}
									className="demo-button no-underline"
								>
									配置
								</Link>
							</div>
						</article>
					))}
				</section>
			)}
		</main>
	);
}
