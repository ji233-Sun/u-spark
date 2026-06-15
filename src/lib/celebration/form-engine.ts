import type { FormAnswers, FormQuestion } from "#/db/celebration-schema";

export const SYSTEM_FORM_FIELDS = [
	{
		id: "email",
		label: "邮箱",
		type: "text",
		required: true,
		locked: true,
	},
	{
		id: "username",
		label: "用户名",
		type: "text",
		required: true,
		locked: true,
	},
	{
		id: "projectTitle",
		label: "项目标题",
		type: "text",
		required: true,
		locked: true,
	},
] as const;

export const RESERVED_FORM_FIELD_IDS = SYSTEM_FORM_FIELDS.map(
	(field) => field.id,
);

export type SystemFormFieldId = (typeof SYSTEM_FORM_FIELDS)[number]["id"];
export type DynamicFormValue = string | string[] | number;
export type DynamicFormAnswers = FormAnswers &
	Record<SystemFormFieldId, string>;
export type FormValidationErrors = Record<string, string>;

export type PresetQuestionInput = {
	type: FormQuestion["type"];
	label: string;
	config?: Pick<FormQuestion, "options" | "ratingMax"> | null;
};

export function isReservedFormFieldId(id: string): boolean {
	return RESERVED_FORM_FIELD_IDS.includes(id as SystemFormFieldId);
}

export function presetQuestionToFormQuestion(
	preset: PresetQuestionInput,
	id: string,
	required = false,
): FormQuestion {
	return {
		id,
		type: preset.type,
		label: preset.label,
		required,
		...(preset.config?.options ? { options: preset.config.options } : {}),
		...(preset.config?.ratingMax ? { ratingMax: preset.config.ratingMax } : {}),
	};
}

export function validateFormSchema(
	schema: FormQuestion[],
): FormValidationErrors {
	const errors: FormValidationErrors = {};
	const seen = new Set<string>();

	for (const question of schema) {
		if (!question.id.trim()) {
			errors[question.id || "id"] = "题目 ID 不能为空。";
			continue;
		}
		if (isReservedFormFieldId(question.id)) {
			errors[question.id] = "系统强制字段不可删改或覆盖。";
		}
		if (seen.has(question.id)) {
			errors[question.id] = "题目 ID 不能重复。";
		}
		seen.add(question.id);

		if (!question.label.trim()) {
			errors[question.id] = "题目标题不能为空。";
		}
		if (
			(question.type === "single" || question.type === "multi") &&
			(!question.options || question.options.length === 0)
		) {
			errors[question.id] = "选项题至少需要一个选项。";
		}
		if (
			question.type === "rating" &&
			(!question.ratingMax || question.ratingMax < 1)
		) {
			errors[question.id] = "评分题需要大于 0 的最高分。";
		}
	}

	return errors;
}

// 校验「纯题目」作答（不含系统强制字段）：schema 完整性 + 每题必填 / 类型。
// 立项（含系统字段）与问卷（无系统字段）共用此核心（DRY）。
export function validateSchemaAnswers(
	schema: FormQuestion[],
	answers: Partial<Record<string, unknown>>,
): FormValidationErrors {
	const errors = validateFormSchema(schema);

	for (const question of schema) {
		const value = answers[question.id];
		const empty = isEmptyAnswer(value);

		if (question.required && empty) {
			errors[question.id] = `${question.label}为必填项。`;
			continue;
		}
		if (empty) continue;

		const typeError = validateQuestionValue(question, value);
		if (typeError) {
			errors[question.id] = typeError;
		}
	}

	return errors;
}

export function validateDynamicFormAnswers(
	schema: FormQuestion[],
	answers: Partial<Record<string, unknown>>,
): FormValidationErrors {
	const errors = validateSchemaAnswers(schema, answers);

	for (const field of SYSTEM_FORM_FIELDS) {
		if (!isNonEmptyString(answers[field.id])) {
			errors[field.id] = `${field.label}为必填项。`;
		}
	}

	return errors;
}

export function formDataToDynamicAnswers(
	schema: FormQuestion[],
	formData: FormData,
): Partial<DynamicFormAnswers> {
	const answers: Partial<Record<string, DynamicFormValue>> = {
		email: String(formData.get("email") ?? ""),
		username: String(formData.get("username") ?? ""),
		projectTitle: String(formData.get("projectTitle") ?? ""),
	};

	for (const question of schema) {
		const name = `answers.${question.id}`;
		if (question.type === "multi") {
			answers[question.id] = formData.getAll(name).map(String);
			continue;
		}
		if (question.type === "rating") {
			const value = formData.get(name);
			answers[question.id] = value ? Number(value) : "";
			continue;
		}
		answers[question.id] = String(formData.get(name) ?? "");
	}

	return answers as Partial<DynamicFormAnswers>;
}

export function hasFormErrors(errors: FormValidationErrors): boolean {
	return Object.keys(errors).length > 0;
}

function validateQuestionValue(
	question: FormQuestion,
	value: unknown,
): string | null {
	switch (question.type) {
		case "text":
		case "textarea":
			return typeof value === "string" ? null : `${question.label}必须是文本。`;
		case "single":
			return typeof value === "string" && question.options?.includes(value)
				? null
				: `${question.label}必须选择有效选项。`;
		case "multi":
			return Array.isArray(value) &&
				value.every(
					(item) =>
						typeof item === "string" && question.options?.includes(item),
				)
				? null
				: `${question.label}包含无效选项。`;
		case "rating": {
			const max = question.ratingMax ?? 5;
			return typeof value === "number" && value >= 1 && value <= max
				? null
				: `${question.label}必须在 1-${max} 之间。`;
		}
		case "date":
			return typeof value === "string" && !Number.isNaN(Date.parse(value))
				? null
				: `${question.label}必须是有效日期。`;
		default:
			return "不支持的题型。";
	}
}

function isEmptyAnswer(value: unknown): boolean {
	return (
		value === undefined ||
		value === null ||
		(typeof value === "string" && value.trim() === "") ||
		(Array.isArray(value) && value.length === 0)
	);
}

function isNonEmptyString(value: unknown): boolean {
	return typeof value === "string" && value.trim().length > 0;
}
