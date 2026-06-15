// 活动配置领域 SSOT（T24）：活动基础信息 + 三类 DDL 时序校验。纯函数，零 DB 依赖。
// 时序约束对齐 T01 ①：开始 ≤ 立项截止 ≤ 稿件提交 ≤ 信息补充（与 schema check 约束一致）。

export type ConfigErrors = Record<string, string>;

export type ActivityScheduleInput = {
	startAt?: unknown;
	proposalDeadline?: unknown;
	submissionDeadline?: unknown;
	infoSupplementDeadline?: unknown;
};

const DEADLINE_FIELDS = [
	"startAt",
	"proposalDeadline",
	"submissionDeadline",
	"infoSupplementDeadline",
] as const;

const DEADLINE_LABELS: Record<(typeof DEADLINE_FIELDS)[number], string> = {
	startAt: "开始时间",
	proposalDeadline: "立项截止",
	submissionDeadline: "稿件提交",
	infoSupplementDeadline: "信息补充截止",
};

function parseDate(value: unknown): number | null {
	if (typeof value !== "string" || !value.trim()) return null;
	const t = Date.parse(value);
	return Number.isNaN(t) ? null : t;
}

// 校验四个时间合法且单调递增。
export function validateActivitySchedule(
	input: ActivityScheduleInput,
): ConfigErrors {
	const errors: ConfigErrors = {};
	const times: Partial<Record<(typeof DEADLINE_FIELDS)[number], number>> = {};

	for (const field of DEADLINE_FIELDS) {
		const t = parseDate(input[field]);
		if (t === null) {
			errors[field] = `${DEADLINE_LABELS[field]}为必填且需合法。`;
		} else {
			times[field] = t;
		}
	}
	if (Object.keys(errors).length > 0) return errors;

	// 单调递增校验
	const order = DEADLINE_FIELDS;
	for (let i = 1; i < order.length; i++) {
		const prev = order[i - 1];
		const cur = order[i];
		if ((times[cur] as number) < (times[prev] as number)) {
			errors[cur] = `${DEADLINE_LABELS[cur]}不得早于${DEADLINE_LABELS[prev]}。`;
		}
	}
	return errors;
}

export function validateActivityBasics(input: {
	title?: unknown;
}): ConfigErrors {
	const errors: ConfigErrors = {};
	const title = typeof input.title === "string" ? input.title.trim() : "";
	if (!title) {
		errors.title = "活动名称为必填项。";
	} else if (title.length > 100) {
		errors.title = "活动名称过长（最多 100 字）。";
	}
	return errors;
}

export function hasConfigErrors(errors: ConfigErrors): boolean {
	return Object.keys(errors).length > 0;
}
