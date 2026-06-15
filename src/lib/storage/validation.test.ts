import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, validateImageUpload } from "./validation.ts";

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

describe("图片上传校验", () => {
	it("合法 PNG 通过", () => {
		const r = validateImageUpload({
			mimeType: "image/png",
			size: PNG_MAGIC.byteLength,
			bytes: PNG_MAGIC,
		});
		expect(r.ok).toBe(true);
	});

	it("非白名单类型被拒", () => {
		const r = validateImageUpload({
			mimeType: "application/x-msdownload",
			size: 10,
			bytes: new Uint8Array([0x4d, 0x5a]),
		});
		expect(r).toMatchObject({ ok: false });
	});

	it("超过大小上限被拒", () => {
		const r = validateImageUpload({
			mimeType: "image/png",
			size: MAX_IMAGE_BYTES + 1,
			bytes: PNG_MAGIC,
		});
		expect(r).toMatchObject({ ok: false });
	});

	it("改扩展名伪装（mime 是 png 但内容是 jpeg）被拒", () => {
		const r = validateImageUpload({
			mimeType: "image/png",
			size: JPEG_MAGIC.byteLength,
			bytes: JPEG_MAGIC,
		});
		expect(r).toMatchObject({ ok: false });
	});
});
