import type { TimelineNode } from "#/components/ui";
import type { ManuscriptStatus, ProjectStatus } from "./state-machine.ts";

export function proposalTimelineNodes(
	projectStatus: ProjectStatus,
	manuscriptStatus?: ManuscriptStatus | null,
): TimelineNode[] {
	const proposalRejected = projectStatus === "proposal_rejected";
	const proposalAccepted = [
		"proposal_approved",
		"manuscript_submitted",
		"manuscript_approved",
		"info_supplement",
		"completed",
	].includes(projectStatus);
	const manuscriptSubmitted = [
		"manuscript_submitted",
		"manuscript_approved",
		"info_supplement",
		"completed",
	].includes(projectStatus);
	const manuscriptAccepted = [
		"manuscript_approved",
		"info_supplement",
		"completed",
	].includes(projectStatus);
	const needsSupplement = ["info_supplement", "completed"].includes(
		projectStatus,
	);
	const manuscriptRejected =
		manuscriptStatus === "rejected" ||
		manuscriptStatus === "revision_requested";

	return [
		{
			label: "提交立项",
			status: projectStatus === "draft" ? "pending" : "done",
			description: "立项表单已进入审核队列",
		},
		{
			label: "立项审核",
			status: proposalRejected
				? "rejected"
				: proposalAccepted
					? "done"
					: "current",
			description: proposalRejected
				? "立项未通过，可重新立项"
				: "等待组织者审核",
		},
		{
			label: "稿件提交",
			status: manuscriptSubmitted
				? "done"
				: proposalAccepted
					? "current"
					: "pending",
			description: "立项通过后提交稿件",
		},
		{
			label: "稿件已提交",
			status: manuscriptSubmitted ? "done" : "pending",
			description: "稿件进入审核",
		},
		{
			label: "稿件拒绝",
			status: manuscriptRejected
				? "rejected"
				: manuscriptAccepted
					? "done"
					: "pending",
			description: manuscriptRejected ? "请按反馈修改后重提" : "无拒绝记录",
		},
		{
			label: "信息补充",
			status: needsSupplement
				? projectStatus === "completed"
					? "done"
					: "current"
				: "pending",
			description: "补充收款码 / 收件信息",
		},
	];
}

export function canRestartProposal(status: ProjectStatus): boolean {
	return status === "proposal_rejected" || status === "withdrawn";
}
