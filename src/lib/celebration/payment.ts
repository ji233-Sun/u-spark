import type { ProjectStatus } from "./state-machine.ts";

// 稿酬领域 SSOT（T25，依 T01 ②：项目级总额、作者间线下分账、系统不存分配比例）。
// 纯函数：金额校验 + 分配资格判定，零 DB 依赖。

export type AmountResult =
	| { ok: true; amount: string }
	| { ok: false; error: string };

// 金额校验 → numeric(10,2) 字符串（正数、两位小数）。
export function validateRemunerationAmount(raw: unknown): AmountResult {
	const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
	if (!Number.isFinite(n) || n <= 0) {
		return { ok: false, error: "稿酬金额需为正数。" };
	}
	if (n > 99_999_999) {
		return { ok: false, error: "稿酬金额过大。" };
	}
	return { ok: true, amount: n.toFixed(2) };
}

// 稿酬分配属于信息补充阶段：稿件审核通过后项目进入 info_supplement 才可核定。
export const REMUNERATION_ELIGIBLE_STATUSES = [
	"info_supplement",
] satisfies ProjectStatus[];

export function canAssignRemuneration(status: ProjectStatus): boolean {
	return (REMUNERATION_ELIGIBLE_STATUSES as readonly ProjectStatus[]).includes(
		status,
	);
}

export type PaymentStatus = "pending" | "paid";

export function isPaymentStatus(value: unknown): value is PaymentStatus {
	return value === "pending" || value === "paid";
}

// 收款码上传开放条件（T22）：仅信息补充阶段、已核定稿酬、且信息补充 DDL 未过。
export function canUploadPaymentCode(
	projectStatus: ProjectStatus,
	remunerationAssigned: boolean,
	infoDeadlinePassed: boolean,
): boolean {
	return (
		projectStatus === "info_supplement" &&
		remunerationAssigned &&
		!infoDeadlinePassed
	);
}
