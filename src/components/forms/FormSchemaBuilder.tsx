import type { FormQuestion } from "#/db/celebration-schema";

// 题目编辑器（T24/T27 共用，DRY）：受控编辑 FormQuestion[]，支持增删、改题型 / 选项 /
// 评分上限 / 必填，以及从预设题库一键添加。系统强制字段由表单引擎注入，不在此编辑。

export const QUESTION_TYPES: { value: FormQuestion["type"]; label: string }[] =
	[
		{ value: "text", label: "单行文本" },
		{ value: "textarea", label: "多行文本" },
		{ value: "single", label: "单选" },
		{ value: "multi", label: "多选" },
		{ value: "rating", label: "评分" },
		{ value: "date", label: "日期" },
	];

function newId(): string {
	return typeof crypto !== "undefined" && crypto.randomUUID
		? `q_${crypto.randomUUID().slice(0, 8)}`
		: `q_${Math.floor(performance.now())}`;
}

export type PresetOption = {
	id: string;
	type: FormQuestion["type"];
	label: string;
};

export function FormSchemaBuilder({
	schema,
	onChange,
	presets = [],
}: {
	schema: FormQuestion[];
	onChange: (schema: FormQuestion[]) => void;
	presets?: PresetOption[];
}) {
	const addQuestion = (type: FormQuestion["type"], label = "新题目") => {
		onChange([
			...schema,
			{
				id: newId(),
				type,
				label,
				required: false,
				...(type === "single" || type === "multi"
					? { options: ["选项一"] }
					: {}),
				...(type === "rating" ? { ratingMax: 5 } : {}),
			},
		]);
	};
	const update = (id: string, patch: Partial<FormQuestion>) =>
		onChange(schema.map((q) => (q.id === id ? { ...q, ...patch } : q)));
	const remove = (id: string) => onChange(schema.filter((q) => q.id !== id));

	return (
		<div className="grid gap-4">
			<div className="grid gap-3">
				{schema.map((q) => (
					<QuestionEditor
						key={q.id}
						question={q}
						onChange={(patch) => update(q.id, patch)}
						onRemove={() => remove(q.id)}
					/>
				))}
				{schema.length === 0 && (
					<p className="demo-muted text-sm">暂无题目。</p>
				)}
			</div>

			<div className="flex flex-wrap gap-2">
				{QUESTION_TYPES.map((t) => (
					<button
						key={t.value}
						type="button"
						className="demo-button demo-button-secondary text-sm"
						onClick={() => addQuestion(t.value)}
					>
						+ {t.label}
					</button>
				))}
			</div>

			{presets.length > 0 && (
				<div>
					<p className="island-kicker mb-2">题库快速添加</p>
					<div className="flex flex-wrap gap-2">
						{presets.map((p) => (
							<button
								key={p.id}
								type="button"
								className="demo-pill cursor-pointer text-xs"
								onClick={() => addQuestion(p.type, p.label)}
							>
								+ {p.label}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function QuestionEditor({
	question,
	onChange,
	onRemove,
}: {
	question: FormQuestion;
	onChange: (patch: Partial<FormQuestion>) => void;
	onRemove: () => void;
}) {
	const showOptions = question.type === "single" || question.type === "multi";
	return (
		<div className="rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-4">
			<div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
				<input
					value={question.label}
					onChange={(e) => onChange({ label: e.target.value })}
					placeholder="题目标题"
					className="demo-input"
				/>
				<select
					value={question.type}
					onChange={(e) =>
						onChange({ type: e.target.value as FormQuestion["type"] })
					}
					className="demo-select"
				>
					{QUESTION_TYPES.map((t) => (
						<option key={t.value} value={t.value}>
							{t.label}
						</option>
					))}
				</select>
			</div>

			{showOptions && (
				<textarea
					value={(question.options ?? []).join("\n")}
					onChange={(e) =>
						onChange({
							options: e.target.value
								.split("\n")
								.map((o) => o.trim())
								.filter(Boolean),
						})
					}
					placeholder="每行一个选项"
					className="demo-textarea mt-3"
				/>
			)}
			{question.type === "rating" && (
				<input
					type="number"
					min="1"
					max="10"
					value={question.ratingMax ?? 5}
					onChange={(e) => onChange({ ratingMax: Number(e.target.value) })}
					className="demo-input mt-3 w-32"
				/>
			)}

			<div className="mt-3 flex items-center justify-between">
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={question.required}
						onChange={(e) => onChange({ required: e.target.checked })}
						className="h-4 w-4 accent-[var(--lagoon-deep)]"
					/>
					必填
				</label>
				<button
					type="button"
					onClick={onRemove}
					className="demo-button demo-button-danger text-sm"
				>
					删除题目
				</button>
			</div>
		</div>
	);
}
