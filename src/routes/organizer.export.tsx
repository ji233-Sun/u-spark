import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "#/lib/auth-client";
import { EXPORT_TYPE_LABELS, EXPORT_TYPES } from "#/lib/celebration/export";
import type { OrganizerActivityRecord } from "./api/organizer/activities";

export const Route = createFileRoute("/organizer/export")({
	component: ExportPage,
});

function ExportPage() {
	const { data: session, isPending } = authClient.useSession();
	const [activities, setActivities] = useState<OrganizerActivityRecord[]>([]);
	const [activityId, setActivityId] = useState("");
	const [full, setFull] = useState(false);
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
				if (!cancelled) {
					setActivities(json.activities ?? []);
					setActivityId(json.activities?.[0]?.id ?? "");
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
				<h1 className="demo-title">数据导出</h1>
				<p className="demo-muted mt-3 text-sm">
					导出本活动的立项 / 稿件 / 作者 / 收货地址 /
					收款信息（CSV）。仅本活动组织者可导出，敏感字段默认脱敏。
				</p>
			</header>

			{error && (
				<section className="demo-alert demo-alert-danger mb-4">
					<p className="m-0 text-sm text-red-600">{error}</p>
				</section>
			)}

			{activities.length === 0 ? (
				<section className="demo-panel text-center">
					<p className="demo-muted m-0 text-sm">你还没有负责的活动。</p>
				</section>
			) : (
				<section className="demo-panel grid gap-5">
					<div className="grid gap-1.5">
						<span className="text-sm font-medium">选择活动</span>
						<select
							value={activityId}
							onChange={(e) => setActivityId(e.target.value)}
							className="demo-select"
						>
							{activities.map((a) => (
								<option key={a.id} value={a.id}>
									{a.title}
								</option>
							))}
						</select>
					</div>

					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={full}
							onChange={(e) => setFull(e.target.checked)}
							className="h-4 w-4 accent-[var(--lagoon-deep)]"
						/>
						包含敏感信息（电话 / 完整地址不脱敏，用于实际寄送）
					</label>

					<div className="flex flex-wrap gap-2">
						{EXPORT_TYPES.map((type) => (
							<a
								key={type}
								href={`/api/organizer/export?activityId=${activityId}&type=${type}&full=${full}`}
								className="demo-button no-underline"
							>
								导出{EXPORT_TYPE_LABELS[type]}
							</a>
						))}
					</div>
					<p className="demo-muted m-0 text-xs">
						提示：仅「收货地址」受「包含敏感信息」开关影响；未勾选时电话打码、地址仅留前缀。
					</p>
				</section>
			)}
		</main>
	);
}
