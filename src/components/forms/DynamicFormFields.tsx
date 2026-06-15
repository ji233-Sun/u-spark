import type { ReactNode } from "react";
import type { FormAnswers, FormQuestion } from "#/db/celebration-schema";
import {
	type FormValidationErrors,
	SYSTEM_FORM_FIELDS,
} from "#/lib/celebration/form-engine";

type DynamicFormFieldsProps = {
	schema: FormQuestion[];
	values?: Partial<FormAnswers & Record<string, string>>;
	errors?: FormValidationErrors;
	disabled?: boolean;
	includeSystemFields?: boolean;
};

export function DynamicFormFields({
	schema,
	values = {},
	errors = {},
	disabled = false,
	includeSystemFields = true,
}: DynamicFormFieldsProps) {
	return (
		<div className="grid gap-4">
			{includeSystemFields && (
				<div className="grid gap-4 sm:grid-cols-2">
					{SYSTEM_FORM_FIELDS.map((field) => (
						<FormFieldShell
							key={field.id}
							id={field.id}
							label={field.label}
							required={field.required}
							error={errors[field.id]}
							locked
						>
							<input
								id={field.id}
								name={field.id}
								type={field.id === "email" ? "email" : "text"}
								required={field.required}
								readOnly={field.locked && field.id !== "projectTitle"}
								disabled={disabled}
								defaultValue={(values[field.id] as string | undefined) ?? ""}
								className="demo-input"
								autoComplete={field.id === "email" ? "email" : "username"}
							/>
						</FormFieldShell>
					))}
				</div>
			)}

			{schema.map((question) => (
				<DynamicQuestionField
					key={question.id}
					question={question}
					value={values[question.id]}
					error={errors[question.id]}
					disabled={disabled}
				/>
			))}
		</div>
	);
}

function DynamicQuestionField({
	question,
	value,
	error,
	disabled,
}: {
	question: FormQuestion;
	value: FormAnswers[string] | undefined;
	error?: string;
	disabled: boolean;
}) {
	const name = `answers.${question.id}`;

	return (
		<FormFieldShell
			id={question.id}
			label={question.label}
			required={question.required}
			error={error}
		>
			{question.type === "text" && (
				<input
					id={question.id}
					name={name}
					type="text"
					required={question.required}
					disabled={disabled}
					defaultValue={typeof value === "string" ? value : ""}
					className="demo-input"
				/>
			)}
			{question.type === "textarea" && (
				<textarea
					id={question.id}
					name={name}
					required={question.required}
					disabled={disabled}
					defaultValue={typeof value === "string" ? value : ""}
					className="demo-textarea"
				/>
			)}
			{question.type === "single" && (
				<div className="grid gap-2">
					{question.options?.map((option) => (
						<label key={option} className="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name={name}
								value={option}
								required={question.required}
								disabled={disabled}
								defaultChecked={value === option}
								className="h-4 w-4 accent-[var(--lagoon-deep)]"
							/>
							<span>{option}</span>
						</label>
					))}
				</div>
			)}
			{question.type === "multi" && (
				<div className="grid gap-2">
					{question.options?.map((option) => (
						<label key={option} className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								name={name}
								value={option}
								disabled={disabled}
								defaultChecked={Array.isArray(value) && value.includes(option)}
								className="h-4 w-4 accent-[var(--lagoon-deep)]"
							/>
							<span>{option}</span>
						</label>
					))}
				</div>
			)}
			{question.type === "rating" && (
				<select
					id={question.id}
					name={name}
					required={question.required}
					disabled={disabled}
					defaultValue={typeof value === "number" ? String(value) : ""}
					className="demo-select"
				>
					<option value="">请选择</option>
					{Array.from({ length: question.ratingMax ?? 5 }, (_, i) => i + 1).map(
						(score) => (
							<option key={score} value={score}>
								{score}
							</option>
						),
					)}
				</select>
			)}
			{question.type === "date" && (
				<input
					id={question.id}
					name={name}
					type="date"
					required={question.required}
					disabled={disabled}
					defaultValue={typeof value === "string" ? value : ""}
					className="demo-input"
				/>
			)}
		</FormFieldShell>
	);
}

function FormFieldShell({
	id,
	label,
	required,
	error,
	locked = false,
	children,
}: {
	id: string;
	label: string;
	required: boolean;
	error?: string;
	locked?: boolean;
	children: ReactNode;
}) {
	return (
		<div className="grid gap-2">
			<label
				htmlFor={id}
				className="flex items-center gap-2 text-sm font-medium"
			>
				<span>{label}</span>
				{required && <span className="text-red-600">*</span>}
				{locked && (
					<span className="demo-pill py-0.5 text-[0.68rem]">系统字段</span>
				)}
			</label>
			{children}
			{error && <p className="m-0 text-xs text-red-600">{error}</p>}
		</div>
	);
}
