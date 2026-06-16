import { describe, expect, it } from "vitest";
import { toStoredProposalAnswers } from "./proposal.ts";

describe("立项提交规则", () => {
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
