import { describe, expect, it } from "vitest";
import {
	type ActivityListItem,
	filterActivityListRows,
	parseActivityTimelineFilter,
	prepareActivityList,
	sortActivitiesByCreatedAt,
	toActivityListRows,
} from "./activity-list.ts";

describe("活动列表排序与筛选", () => {
	const t = (iso: string) => new Date(iso);
	const base = {
		description: null,
		coverImageUrl: null,
		startAt: t("2026-06-01T00:00:00Z"),
		proposalDeadline: t("2026-06-10T00:00:00Z"),
		submissionDeadline: t("2026-06-20T00:00:00Z"),
		infoSupplementDeadline: t("2026-06-30T00:00:00Z"),
	};
	const activities: ActivityListItem[] = [
		{
			...base,
			id: "old",
			title: "Old",
			createdAt: t("2026-05-01T00:00:00Z"),
		},
		{
			...base,
			id: "new",
			title: "New",
			createdAt: t("2026-05-03T00:00:00Z"),
		},
		{
			...base,
			id: "middle",
			title: "Middle",
			createdAt: t("2026-05-02T00:00:00Z"),
		},
	];

	it("默认按创建时间倒序排列", () => {
		expect(
			sortActivitiesByCreatedAt(activities).map((item) => item.id),
		).toEqual(["new", "middle", "old"]);
	});

	it("解析非法筛选值时回到 all", () => {
		expect(parseActivityTimelineFilter("ongoing")).toBe("ongoing");
		expect(parseActivityTimelineFilter("bad")).toBe("all");
		expect(parseActivityTimelineFilter(undefined)).toBe("all");
	});

	it("按 T12 三状态筛选：待开始 / 进行中 / 已结束", () => {
		const rows = [
			...toActivityListRows(
				[
					{
						...base,
						id: "future",
						title: "Future",
						createdAt: t("2026-05-01T00:00:00Z"),
					},
				],
				t("2026-05-31T00:00:00Z"),
			),
			...toActivityListRows(
				[
					{
						...base,
						id: "live",
						title: "Live",
						createdAt: t("2026-05-02T00:00:00Z"),
					},
				],
				t("2026-06-15T00:00:00Z"),
			),
			...toActivityListRows(
				[
					{
						...base,
						id: "ended",
						title: "Ended",
						createdAt: t("2026-05-03T00:00:00Z"),
					},
				],
				t("2026-07-01T00:00:00Z"),
			),
		];

		expect(
			filterActivityListRows(rows, "not_started").map((row) => row.id),
		).toEqual(["future"]);
		expect(
			filterActivityListRows(rows, "ongoing").map((row) => row.id),
		).toEqual(["live"]);
		expect(filterActivityListRows(rows, "ended").map((row) => row.id)).toEqual([
			"ended",
		]);
	});

	it("组合处理时保持筛选后的创建时间倒序", () => {
		expect(
			prepareActivityList(activities, "ongoing", t("2026-06-15T00:00:00Z")).map(
				(item) => item.id,
			),
		).toEqual(["new", "middle", "old"]);
	});
});
