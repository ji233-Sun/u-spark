import { describe, expect, it } from "vitest";
import { manuscriptStatus, projectStatus } from "../../db/enums.ts";
import {
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
});
