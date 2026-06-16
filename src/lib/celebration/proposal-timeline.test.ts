import { describe, expect, it } from "vitest";
import {
	canRestartProposal,
	proposalOverviewBadge,
	proposalTimelineNodes,
} from "./proposal-timeline.ts";

describe("我的立项时间轴", () => {
	it("始终返回 6 个策划节点", () => {
		expect(
			proposalTimelineNodes("proposal_submitted").map((node) => node.label),
		).toEqual([
			"提交立项",
			"立项审核",
			"稿件提交",
			"稿件已提交",
			"稿件拒绝",
			"信息补充",
		]);
	});

	it("立项被拒节点标记 rejected，并开放重新立项入口", () => {
		const nodes = proposalTimelineNodes("proposal_rejected");
		expect(nodes[1]).toMatchObject({ label: "立项审核", status: "rejected" });
		expect(canRestartProposal("proposal_rejected")).toBe(true);
	});

	it("稿件提交后前置节点完成，信息补充为待处理", () => {
		const nodes = proposalTimelineNodes("manuscript_submitted");
		expect(nodes[0]?.status).toBe("done");
		expect(nodes[1]?.status).toBe("done");
		expect(nodes[2]?.status).toBe("done");
		expect(nodes[3]?.status).toBe("done");
		expect(nodes[5]?.status).toBe("pending");
	});

	it("稿件拒绝轴可标记稿件拒绝节点", () => {
		expect(
			proposalTimelineNodes("manuscript_submitted", "rejected")[4],
		).toMatchObject({
			label: "稿件拒绝",
			status: "rejected",
		});
	});

	it("卡片总览 badge 优先展示稿件打回态", () => {
		expect(proposalOverviewBadge("manuscript_submitted", "rejected")).toEqual({
			label: "稿件被拒",
			tone: "danger",
		});
		expect(
			proposalOverviewBadge("manuscript_submitted", "revision_requested"),
		).toEqual({
			label: "稿件需修改",
			tone: "warning",
		});
	});
});
