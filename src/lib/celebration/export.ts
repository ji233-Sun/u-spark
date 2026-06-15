// 数据导出领域 SSOT（T26）：CSV 序列化 + 敏感字段脱敏。纯函数，零 DB 依赖。

export type CsvCell = string | number | null | undefined;

// RFC4180 转义：含逗号 / 引号 / 换行的单元格用引号包裹并转义内部引号。
export function csvEscape(value: CsvCell): string {
	const s = value == null ? "" : String(value);
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 生成 CSV 文本（带 UTF-8 BOM，避免 Excel 中文乱码；CRLF 行分隔）。
export function toCsv(headers: string[], rows: CsvCell[][]): string {
	const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
	return `﻿${lines.join("\r\n")}`;
}

// 手机号脱敏：保留前 3 后 4，中间打码。
export function maskPhone(phone: string): string {
	const digits = phone.replace(/\D/g, "");
	if (digits.length < 7) return "***";
	return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

// 地址脱敏：仅保留前 6 字符，其余省略。
export function maskAddress(address: string): string {
	if (!address) return "";
	return address.length <= 6
		? `${address.slice(0, 2)}***`
		: `${address.slice(0, 6)}…`;
}

// 导出类型（决定 CSV 列集与数据源）。
export const EXPORT_TYPES = [
	"proposals",
	"manuscripts",
	"authors",
	"shipping",
	"payments",
] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export function isExportType(value: unknown): value is ExportType {
	return (EXPORT_TYPES as readonly string[]).includes(value as string);
}

export const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
	proposals: "立项",
	manuscripts: "稿件",
	authors: "作者",
	shipping: "收货地址",
	payments: "收款 / 稿酬",
};
