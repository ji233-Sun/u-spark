import type { FormAnswers } from "#/db/celebration-schema";
import type { ProjectStatus } from "./state-machine.ts";

export const RESUBMITTABLE_PROJECT_STATUSES = [
	"proposal_rejected",
	"withdrawn",
] satisfies ProjectStatus[];

export function canCreateProposalForActivity(
	existingStatuses: ProjectStatus[],
): boolean {
	return existingStatuses.every((status) =>
		(RESUBMITTABLE_PROJECT_STATUSES as readonly ProjectStatus[]).includes(
			status,
		),
	);
}

export function toStoredProposalAnswers(
	answers: Partial<Record<string, unknown>>,
): FormAnswers {
	const rest = { ...answers };
	delete rest.email;
	delete rest.username;
	delete rest.projectTitle;
	return rest as FormAnswers;
}
