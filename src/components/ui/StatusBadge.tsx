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

const TONE_CLASS: Record<Tone, string> = {
	neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
	info: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
	success:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
	warning:
		"bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
	danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}
		>
			{label}
		</span>
	);
}

// 便捷封装：直接吃状态枚举（对接状态机 SSOT）。
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
