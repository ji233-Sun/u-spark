import {
	type ActivitySchedule,
	type ActivityTimelineStatus,
	deriveActivityTimeline,
} from "./state-machine.ts";

export const ACTIVITY_TIMELINE_FILTERS = [
	"all",
	"ongoing",
	"not_started",
	"ended",
] as const;

export type ActivityTimelineFilter = (typeof ACTIVITY_TIMELINE_FILTERS)[number];

export type ActivityListItem = ActivitySchedule & {
	id: string;
	title: string;
	description: string | null;
	coverImageUrl: string | null;
	createdAt: Date;
};

export type ActivityListRow = ActivityListItem & {
	timelineStatus: ActivityTimelineStatus;
	nextDeadline: Date | null;
	nextDeadlineKind: ReturnType<
		typeof deriveActivityTimeline
	>["nextDeadlineKind"];
	millisecondsUntilNextDeadline: number | null;
	endsAt: Date;
};

export type ActivityParticipationState = {
	enabled: boolean;
	reason: string;
};

export function parseActivityTimelineFilter(
	value: unknown,
): ActivityTimelineFilter {
	return ACTIVITY_TIMELINE_FILTERS.includes(value as ActivityTimelineFilter)
		? (value as ActivityTimelineFilter)
		: "all";
}

export function sortActivitiesByCreatedAt<T extends { createdAt: Date }>(
	activities: T[],
): T[] {
	return [...activities].sort(
		(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
	);
}

export function toActivityListRows(
	activities: ActivityListItem[],
	now: Date,
): ActivityListRow[] {
	return activities.map((activity) => {
		const timeline = deriveActivityTimeline(activity, now);
		return {
			...activity,
			timelineStatus: timeline.status,
			nextDeadline: timeline.nextDeadline,
			nextDeadlineKind: timeline.nextDeadlineKind,
			millisecondsUntilNextDeadline: timeline.millisecondsUntilNextDeadline,
			endsAt: timeline.endsAt,
		};
	});
}

export function filterActivityListRows(
	rows: ActivityListRow[],
	filter: ActivityTimelineFilter,
): ActivityListRow[] {
	return filter === "all"
		? rows
		: rows.filter((row) => row.timelineStatus === filter);
}

export function prepareActivityList(
	activities: ActivityListItem[],
	filter: ActivityTimelineFilter,
	now: Date,
): ActivityListRow[] {
	return filterActivityListRows(
		toActivityListRows(sortActivitiesByCreatedAt(activities), now),
		filter,
	);
}

export function activityParticipationState(
	row: Pick<ActivityListRow, "timelineStatus" | "nextDeadlineKind">,
): ActivityParticipationState {
	if (row.timelineStatus === "not_started") {
		return { enabled: false, reason: "活动尚未开始" };
	}
	if (row.timelineStatus === "ended") {
		return { enabled: false, reason: "活动已结束" };
	}
	if (row.nextDeadlineKind !== "proposal") {
		return { enabled: false, reason: "立项入口已关闭" };
	}
	return { enabled: true, reason: "进入立项流程" };
}
