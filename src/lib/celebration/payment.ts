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

// 可被核定稿酬的项目状态：立项通过及之后（排除草稿 / 被拒 / 撤回）。
export const REMUNERATION_ELIGIBLE_STATUSES = [
	"proposal_approved",
	"manuscript_submitted",
	"manuscript_approved",
	"info_supplement",
	"completed",
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
