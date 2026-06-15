import { describe, expect, it } from "vitest";
import {
	csvEscape,
	isExportType,
	maskAddress,
	maskPhone,
	toCsv,
} from "./export.ts";

describe("CSV 序列化", () => {
	it("转义含逗号 / 引号 / 换行的单元格", () => {
		expect(csvEscape("a,b")).toBe('"a,b"');
		expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
		expect(csvEscape("plain")).toBe("plain");
		expect(csvEscape(null)).toBe("");
	});

	it("生成带 BOM 的 CSV", () => {
		const csv = toCsv(["a", "b"], [["1", "2"]]);
		expect(csv.startsWith("﻿")).toBe(true);
		expect(csv).toContain("a,b");
		expect(csv).toContain("1,2");
	});
});

describe("敏感字段脱敏", () => {
	it("手机号保留前 3 后 4", () => {
		expect(maskPhone("13800138000")).toBe("138****8000");
		expect(maskPhone("123")).toBe("***");
	});

	it("地址仅保留前缀", () => {
		expect(maskAddress("某省某市某区某街道 1 号")).toContain("…");
		expect(maskAddress("北京")).toBe("北京***");
	});
});

describe("导出类型", () => {
	it("识别合法导出类型", () => {
		expect(isExportType("shipping")).toBe(true);
		expect(isExportType("nope")).toBe(false);
	});
});
