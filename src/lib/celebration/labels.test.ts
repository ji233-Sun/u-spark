import { describe, expect, it } from "vitest";
import { manuscriptStatus, projectStatus } from "../../db/enums.ts";
import {
	ACTIVITY_TIMELINE_STATUS_LABELS,
	ACTIVITY_TIMELINE_STATUS_TONES,
	MANUSCRIPT_STATUS_LABELS,
	PROJECT_STATUS_LABELS,
	PROJECT_STATUS_TONES,
} from "./labels.ts";

describe("状态中文词表", () => {
	it("覆盖所有 project 状态（标签 + 色调）", () => {
		for (const s of projectStatus.enumValues) {
			expect(PROJECT_STATUS_LABELS[s]).toBeTruthy();
			expect(PROJECT_STATUS_TONES[s]).toBeTruthy();
		}
	});

	it("覆盖所有 manuscript 状态", () => {
		for (const s of manuscriptStatus.enumValues) {
			expect(MANUSCRIPT_STATUS_LABELS[s]).toBeTruthy();
		}
	});

	it("语义色调：通过=success、被拒=danger", () => {
		expect(PROJECT_STATUS_TONES.proposal_approved).toBe("success");
		expect(PROJECT_STATUS_TONES.proposal_rejected).toBe("danger");
	});

	it("项目主轴的稿件阶段不表达具体审核结果", () => {
		expect(PROJECT_STATUS_LABELS.manuscript_submitted).toBe("稿件阶段");
		expect(PROJECT_STATUS_LABELS.manuscript_submitted).not.toContain("待审");
		expect(MANUSCRIPT_STATUS_LABELS.rejected).toBe("已拒绝");
	});

	it("覆盖活动时间线三状态", () => {
		expect(ACTIVITY_TIMELINE_STATUS_LABELS.ongoing).toBe("进行中");
		expect(ACTIVITY_TIMELINE_STATUS_LABELS.not_started).toBe("待开始");
		expect(ACTIVITY_TIMELINE_STATUS_LABELS.ended).toBe("已结束");
		expect(ACTIVITY_TIMELINE_STATUS_TONES.ongoing).toBe("success");
	});
});
