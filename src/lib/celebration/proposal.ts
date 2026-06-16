import type { FormAnswers } from "#/db/celebration-schema";

export function toStoredProposalAnswers(
	answers: Partial<Record<string, unknown>>,
): FormAnswers {
	const rest = { ...answers };
	delete rest.email;
	delete rest.username;
	delete rest.projectTitle;
	return rest as FormAnswers;
}
