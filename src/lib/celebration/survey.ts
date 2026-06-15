import type { FormAnswers, FormQuestion } from "#/db/celebration-schema";

// 问卷领域 SSOT（T27）：开放窗口判定、重复提交去重、答案行展开。纯函数，零 DB 依赖。
// 问卷复用统一表单引擎（FormQuestion / FormAnswers），题型集与立项一致（T01 ③）。

// 问卷开放窗口：opensAt/closesAt 任一为空表示该侧不限制。
export function isSurveyOpen(
	opensAt: Date | null,
	closesAt: Date | null,
	now: Date,
): boolean {
	if (opensAt && now.getTime() < opensAt.getTime()) return false;
	if (closesAt && now.getTime() > closesAt.getTime()) return false;
	return true;
}

// 重复填写规则：同一填写者多次提交按 submittedAt 累积为审计日志，
// 取每人最新一条为当前答案（匿名条目不去重）。
export function latestResponsesByRespondent<
	T extends { respondentId: string | null; submittedAt: Date },
>(responses: T[]): T[] {
	const byUser = new Map<string, T>();
	const anonymous: T[] = [];
	for (const r of responses) {
		if (r.respondentId == null) {
			anonymous.push(r);
			continue;
		}
		const existing = byUser.get(r.respondentId);
		if (!existing || r.submittedAt.getTime() > existing.submittedAt.getTime()) {
			byUser.set(r.respondentId, r);
		}
	}
	return [...byUser.values(), ...anonymous];
}

// 答案按 schema 顺序展开为字符串行（多选以「、」连接），供 CSV / 表格使用。
export function answersToRow(
	schema: FormQuestion[],
	answers: FormAnswers,
): string[] {
	return schema.map((q) => {
		const v = answers[q.id];
		if (Array.isArray(v)) return v.join("、");
		return v == null ? "" : String(v);
	});
}
