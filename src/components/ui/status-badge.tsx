import {
	MANUSCRIPT_STATUS_LABELS,
	MANUSCRIPT_STATUS_TONES,
	PROJECT_STATUS_LABELS,
	PROJECT_STATUS_TONES,
	type Tone,
} from "#/lib/celebration/labels";
import type {
	ManuscriptStatus,
	ProjectStatus,
} from "#/lib/celebration/state-machine";
import { cn } from "#/lib/utils";
import { Badge } from "./badge.tsx";

// 语义色调 → shadcn token 配色（对接状态机 SSOT）。
const TONE_CLASS: Record<Tone, string> = {
	neutral: "bg-muted text-muted-foreground",
	info: "bg-primary/10 text-primary",
	success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
	warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
	danger: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
	return (
		<Badge
			variant="secondary"
			className={cn("border-transparent", TONE_CLASS[tone])}
		>
			{label}
		</Badge>
	);
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
	return (
		<StatusBadge
			label={PROJECT_STATUS_LABELS[status]}
			tone={PROJECT_STATUS_TONES[status]}
		/>
	);
}

export function ManuscriptStatusBadge({
	status,
}: {
	status: ManuscriptStatus;
}) {
	return (
		<StatusBadge
			label={MANUSCRIPT_STATUS_LABELS[status]}
			tone={MANUSCRIPT_STATUS_TONES[status]}
		/>
	);
}
