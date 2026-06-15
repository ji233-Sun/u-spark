import { describe, expect, it } from "vitest";
import {
	canCreateProposalForActivity,
	toStoredProposalAnswers,
} from "./proposal.ts";

describe("立项提交规则", () => {
	it("同一用户同一活动已有非终止立项时不可重复提交", () => {
		expect(canCreateProposalForActivity([])).toBe(true);
		expect(canCreateProposalForActivity(["proposal_rejected"])).toBe(true);
		expect(canCreateProposalForActivity(["withdrawn"])).toBe(true);
		expect(canCreateProposalForActivity(["proposal_submitted"])).toBe(false);
		expect(canCreateProposalForActivity(["proposal_approved"])).toBe(false);
	});

	it("存储立项答案时剥离系统字段", () => {
		expect(
			toStoredProposalAnswers({
				email: "creator@example.com",
				username: "creator",
				projectTitle: "企划",
				intro: "介绍",
			}),
		).toEqual({ intro: "介绍" });
	});
});
