import {
	createFileRoute,
	Link,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { useEffect, useState } from "react";
import { StatusBadge } from "#/components/ui";
import { user } from "#/db/auth-schema";
import { activity, activityOrganizer, form } from "#/db/celebration-schema";
import { db } from "#/db/index";
import {
	type ActivityListItem,
	activityParticipationState,
	toActivityListRows,
} from "#/lib/celebration/activity-list";
import {
	ACTIVITY_TIMELINE_STATUS_LABELS,
	ACTIVITY_TIMELINE_STATUS_TONES,
} from "#/lib/celebration/labels";
import type { DeadlineKind } from "#/lib/celebration/state-machine";
import { isSurveyOpen } from "#/lib/celebration/survey";

type ActivityDetailRecord = ActivityListItem & {
	organizers: string[];
};

type SerializedActivityDetail = Omit<
	ActivityDetailRecord,
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
	surveys: { id: string; title: string }[];
};

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

const getActivityDetail = createServerFn({
	method: "GET",
})
	.validator((data: { activityId: string }) => data)
	.handler(async ({ data }): Promise<SerializedActivityDetail | null> => {
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
				organizerName: user.name,
				organizerEmail: user.email,
			})
			.from(activity)
			.leftJoin(
				activityOrganizer,
				eq(activityOrganizer.activityId, activity.id),
			)
			.leftJoin(user, eq(user.id, activityOrganizer.userId))
			.where(
				and(eq(activity.id, data.activityId), eq(activity.status, "published")),
			);

		if (rows.length === 0) return null;

		const first = rows[0];
		const organizers = rows
			.map((row) => row.organizerName || row.organizerEmail)
			.filter((name): name is string => Boolean(name));

		// 开放中的问卷（用户在活动界面填写入口）
		const surveyRows = await db
			.select({
				id: form.id,
				title: form.title,
				opensAt: form.opensAt,
				closesAt: form.closesAt,
			})
			.from(form)
			.where(
				and(eq(form.activityId, data.activityId), eq(form.type, "survey")),
			);
		const surveyNow = new Date();
		const surveys = surveyRows
			.filter((s) => isSurveyOpen(s.opensAt, s.closesAt, surveyNow))
			.map((s) => ({ id: s.id, title: s.title }));

		return {
			id: first.id,
			title: first.title,
			description: first.description,
			coverImageUrl: first.coverImageUrl,
			startAt: first.startAt.toISOString(),
			proposalDeadline: first.proposalDeadline.toISOString(),
			submissionDeadline: first.submissionDeadline.toISOString(),
			infoSupplementDeadline: first.infoSupplementDeadline.toISOString(),
			createdAt: first.createdAt.toISOString(),
			organizers,
			surveys,
		};
	});

export const Route = createFileRoute("/activities_/$activityId")({
	loader: async ({ params }) =>
		await getActivityDetail({ data: { activityId: params.activityId } }),
	component: ActivityDetailPage,
	pendingComponent: ActivityDetailLoading,
});

function toActivityDetail(
	record: SerializedActivityDetail,
): ActivityDetailRecord {
	return {
		...record,
		startAt: new Date(record.startAt),
		proposalDeadline: new Date(record.proposalDeadline),
		submissionDeadline: new Date(record.submissionDeadline),
		infoSupplementDeadline: new Date(record.infoSupplementDeadline),
		createdAt: new Date(record.createdAt),
	};
}

function ActivityDetailPage() {
	const record = Route.useLoaderData();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		const id = window.setInterval(() => setNow(new Date()), 30 * 1000);
		return () => window.clearInterval(id);
	}, []);

	if (pathname.endsWith("/proposal")) {
		return <Outlet />;
	}

	if (!record) {
		return (
			<main className="demo-page">
				<section className="demo-panel text-center">
					<h1 className="demo-title">活动不存在</h1>
					<p className="demo-muted mt-3 text-sm">
						它可能尚未发布，或已经下线。
					</p>
					<Link to="/activities" className="demo-button mt-6 no-underline">
						返回活动列表
					</Link>
				</section>
			</main>
		);
	}

	const detail = toActivityDetail(record);
	const timeline = toActivityListRows([detail], now)[0];
	const participation = activityParticipationState(timeline);
	const organizers =
		detail.organizers.length > 0 ? detail.organizers.join("、") : "暂未指派";

	return (
		<main className="demo-page demo-page-wide">
			<Link to="/activities" className="demo-muted text-sm no-underline">
				返回活动列表
			</Link>

			<section className="mt-4 grid gap-6 lg:grid-cols-[1fr_24rem]">
				<article className="demo-panel">
					<div className="mb-4 flex flex-wrap items-center gap-2">
						<StatusBadge
							label={ACTIVITY_TIMELINE_STATUS_LABELS[timeline.timelineStatus]}
							tone={ACTIVITY_TIMELINE_STATUS_TONES[timeline.timelineStatus]}
						/>
						<span className="demo-muted text-xs">
							创建于 {formatDate(detail.createdAt)}
						</span>
					</div>

					<h1 className="demo-title">{detail.title}</h1>
					<p className="demo-muted mt-4 text-sm">组织者：{organizers}</p>
					<p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-[var(--sea-ink)]">
						{detail.description || "暂无简介。"}
					</p>
				</article>

				<aside className="demo-panel h-fit space-y-4">
					<div>
						<p className="island-kicker mb-2">Deadline</p>
						<h2 className="m-0 text-xl font-bold text-[var(--sea-ink)]">
							{timeline.nextDeadlineKind && timeline.nextDeadline
								? DEADLINE_LABELS[timeline.nextDeadlineKind]
								: "活动已结束"}
						</h2>
						<p className="mt-2 text-3xl font-extrabold text-[var(--lagoon-deep)]">
							{formatCountdown(timeline.millisecondsUntilNextDeadline)}
						</p>
					</div>

					<div className="grid gap-2 text-sm">
						<Meta label="开始时间" value={formatDate(detail.startAt)} />
						<Meta
							label="立项截止"
							value={formatDate(detail.proposalDeadline)}
						/>
						<Meta
							label="稿件提交"
							value={formatDate(detail.submissionDeadline)}
						/>
						<Meta
							label="信息补充截止"
							value={formatDate(detail.infoSupplementDeadline)}
						/>
					</div>

					{participation.enabled ? (
						<Link
							to="/activities/$activityId/proposal"
							params={{ activityId: detail.id }}
							className="demo-button w-full no-underline"
						>
							参与活动
						</Link>
					) : (
						<button type="button" disabled className="demo-button w-full">
							{participation.reason}
						</button>
					)}
				</aside>
			</section>

			{record.surveys.length > 0 && (
				<section className="demo-panel mt-6">
					<p className="island-kicker mb-3">Surveys</p>
					<h2 className="m-0 text-lg font-bold text-[var(--sea-ink)]">
						活动问卷
					</h2>
					<ul className="mt-3 grid gap-2">
						{record.surveys.map((survey) => (
							<li key={survey.id}>
								<a
									href={`/surveys/${survey.id}`}
									className="text-[var(--lagoon-deep)]"
								>
									{survey.title} →
								</a>
							</li>
						))}
					</ul>
				</section>
			)}
		</main>
	);
}

function ActivityDetailLoading() {
	return (
		<main className="demo-page demo-page-wide">
			<section className="grid gap-6 lg:grid-cols-[1fr_24rem]">
				<div className="demo-panel animate-pulse">
					<div className="mb-4 h-5 w-24 rounded bg-[var(--chip-line)]" />
					<div className="mb-4 h-10 w-2/3 rounded bg-[var(--chip-line)]" />
					<div className="h-24 rounded bg-[var(--chip-line)]" />
				</div>
				<div className="demo-panel h-80 animate-pulse">
					<div className="mb-4 h-6 w-32 rounded bg-[var(--chip-line)]" />
					<div className="h-10 w-40 rounded bg-[var(--chip-line)]" />
				</div>
			</section>
		</main>
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
