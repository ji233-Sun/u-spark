import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { StatusBadge } from "#/components/ui/StatusBadge";
import { activity } from "#/db/celebration-schema";
import { db } from "#/db/index";
import {
	ACTIVITY_TIMELINE_FILTERS,
	type ActivityListItem,
	type ActivityTimelineFilter,
	parseActivityTimelineFilter,
	prepareActivityList,
} from "#/lib/celebration/activity-list";
import {
	ACTIVITY_TIMELINE_STATUS_LABELS,
	ACTIVITY_TIMELINE_STATUS_TONES,
} from "#/lib/celebration/labels";
import type { DeadlineKind } from "#/lib/celebration/state-machine";

type ActivitySearch = {
	timeline?: ActivityTimelineFilter;
};

type ActivityRecord = Omit<
	ActivityListItem,
	| "startAt"
	| "proposalDeadline"
	| "submissionDeadline"
	| "infoSupplementDeadline"
	| "createdAt"
> & {
	startAt: string;
	proposalDeadline: string;
	submissionDeadline: string;
	infoSupplementDeadline: string;
	createdAt: string;
};

const FILTER_LABELS = {
	all: "全部",
	ongoing: "进行中",
	not_started: "待开始",
	ended: "已结束",
} satisfies Record<ActivityTimelineFilter, string>;

const DEADLINE_LABELS = {
	proposal: "立项截止",
	submission: "稿件提交",
	info_supplement: "信息补充截止",
} satisfies Record<DeadlineKind, string>;

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

const getActivities = createServerFn({
	method: "GET",
}).handler(async (): Promise<ActivityRecord[]> => {
	const rows = await db
		.select({
			id: activity.id,
			title: activity.title,
			description: activity.description,
			coverImageUrl: activity.coverImageUrl,
			startAt: activity.startAt,
			proposalDeadline: activity.proposalDeadline,
			submissionDeadline: activity.submissionDeadline,
			infoSupplementDeadline: activity.infoSupplementDeadline,
			createdAt: activity.createdAt,
		})
		.from(activity)
		.where(eq(activity.status, "published"))
		.orderBy(desc(activity.createdAt));

	return rows.map((row) => ({
		...row,
		startAt: row.startAt.toISOString(),
		proposalDeadline: row.proposalDeadline.toISOString(),
		submissionDeadline: row.submissionDeadline.toISOString(),
		infoSupplementDeadline: row.infoSupplementDeadline.toISOString(),
		createdAt: row.createdAt.toISOString(),
	}));
});

export const Route = createFileRoute("/activities")({
	validateSearch: (search: Record<string, unknown>): ActivitySearch => ({
		timeline: parseActivityTimelineFilter(search.timeline),
	}),
	loader: async () => await getActivities(),
	pendingComponent: ActivitiesLoading,
	component: ActivitiesPage,
});

function toActivityListItem(record: ActivityRecord): ActivityListItem {
	return {
		...record,
		startAt: new Date(record.startAt),
		proposalDeadline: new Date(record.proposalDeadline),
		submissionDeadline: new Date(record.submissionDeadline),
		infoSupplementDeadline: new Date(record.infoSupplementDeadline),
		createdAt: new Date(record.createdAt),
	};
}

function ActivitiesPage() {
	const search = Route.useSearch();
	const records = Route.useLoaderData();
	const filter = parseActivityTimelineFilter(search.timeline);
	const activities = records.map(toActivityListItem);
	const rows = prepareActivityList(activities, filter, new Date());

	return (
		<main className="demo-page demo-page-wide">
			<header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="island-kicker mb-2">Activities</p>
					<h1 className="demo-title">活动列表</h1>
					<p className="demo-muted mt-3 max-w-2xl text-sm">
						按创建时间倒序展示已发布活动，并按当前时间动态派生活动状态。
					</p>
				</div>
				<p className="demo-pill w-fit">共 {rows.length} 个</p>
			</header>

			<nav className="mb-5 flex flex-wrap gap-2" aria-label="活动状态筛选">
				{ACTIVITY_TIMELINE_FILTERS.map((item) => (
					<Link
						key={item}
						to="/activities"
						search={{ timeline: item }}
						className={`demo-button no-underline ${filter === item ? "" : "demo-button-secondary"}`}
					>
						{FILTER_LABELS[item]}
					</Link>
				))}
			</nav>

			{records.length === 0 ? (
				<EmptyState title="暂无活动" description="发布活动后会在这里展示。" />
			) : rows.length === 0 ? (
				<EmptyState title="没有匹配的活动" description="换一个状态筛选看看。" />
			) : (
				<section className="grid gap-4">
					{rows.map((row) => (
						<article key={row.id} className="demo-list-item">
							<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
								<div className="min-w-0 flex-1">
									<div className="mb-2 flex flex-wrap items-center gap-2">
										<StatusBadge
											label={
												ACTIVITY_TIMELINE_STATUS_LABELS[row.timelineStatus]
											}
											tone={ACTIVITY_TIMELINE_STATUS_TONES[row.timelineStatus]}
										/>
										<span className="demo-muted text-xs">
											创建于 {formatDate(row.createdAt)}
										</span>
									</div>
									<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
										<Link
											to="/activities/$activityId"
											params={{ activityId: row.id }}
											className="text-[var(--sea-ink)] no-underline hover:text-[var(--lagoon-deep)]"
										>
											{row.title}
										</Link>
									</h2>
									{row.description && (
										<p className="demo-muted mt-2 line-clamp-2 text-sm">
											{row.description}
										</p>
									)}
								</div>

								<div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[28rem]">
									<Meta label="开始时间" value={formatDate(row.startAt)} />
									<Meta label="活动结束" value={formatDate(row.endsAt)} />
									<Meta
										label="当前 DDL"
										value={
											row.nextDeadlineKind && row.nextDeadline
												? `${DEADLINE_LABELS[row.nextDeadlineKind]} ${formatDate(row.nextDeadline)}`
												: "已结束"
										}
									/>
									<Meta
										label="倒计时"
										value={formatCountdown(row.millisecondsUntilNextDeadline)}
									/>
								</div>
							</div>
							<div className="mt-4 flex justify-end">
								<Link
									to="/activities/$activityId"
									params={{ activityId: row.id }}
									className="demo-button demo-button-secondary no-underline"
								>
									查看详情
								</Link>
							</div>
						</article>
					))}
				</section>
			)}
		</main>
	);
}

function ActivitiesLoading() {
	return (
		<main className="demo-page demo-page-wide">
			<div className="mb-6">
				<p className="island-kicker mb-2">Activities</p>
				<h1 className="demo-title">活动列表</h1>
			</div>
			<section className="grid gap-4" aria-label="活动列表加载中">
				{["one", "two", "three"].map((item) => (
					<div key={item} className="demo-list-item animate-pulse">
						<div className="mb-3 h-5 w-28 rounded bg-[var(--chip-line)]" />
						<div className="mb-2 h-6 w-1/2 rounded bg-[var(--chip-line)]" />
						<div className="h-4 w-3/4 rounded bg-[var(--chip-line)]" />
					</div>
				))}
			</section>
		</main>
	);
}

function EmptyState({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<section className="demo-panel flex min-h-56 flex-col items-center justify-center text-center">
			<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">{title}</h2>
			<p className="demo-muted mt-2 text-sm">{description}</p>
		</section>
	);
}

function Meta({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2">
			<p className="demo-muted m-0 text-xs">{label}</p>
			<p className="m-0 mt-1 font-semibold text-[var(--sea-ink)]">{value}</p>
		</div>
	);
}

function formatDate(date: Date): string {
	return dateFormatter.format(date);
}

function formatCountdown(milliseconds: number | null): string {
	if (milliseconds === null) return "无";
	if (milliseconds === 0) return "0 分钟";

	const minutes = Math.ceil(milliseconds / (60 * 1000));
	const days = Math.floor(minutes / (24 * 60));
	const hours = Math.floor((minutes - days * 24 * 60) / 60);
	const restMinutes = minutes % 60;

	if (days > 0) {
		return hours > 0 ? `${days} 天 ${hours} 小时` : `${days} 天`;
	}
	if (hours > 0) {
		return restMinutes > 0
			? `${hours} 小时 ${restMinutes} 分钟`
			: `${hours} 小时`;
	}
	return `${restMinutes} 分钟`;
}
