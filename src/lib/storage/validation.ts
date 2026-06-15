// 图片上传校验（T06 #6）：白名单 mime + 大小 + magic bytes（防伪装扩展名 / 恶意文件）。纯函数。
export const ALLOWED_IMAGE_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export type ValidationResult =
	| { ok: true; type: AllowedImageType }
	| { ok: false; reason: string };

// 各类型文件头 magic bytes 前缀
const MAGIC: Record<AllowedImageType, readonly number[]> = {
	"image/png": [0x89, 0x50, 0x4e, 0x47],
	"image/jpeg": [0xff, 0xd8, 0xff],
	"image/gif": [0x47, 0x49, 0x46, 0x38],
	"image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF 容器（webp 外层）
};

function matchesMagic(type: AllowedImageType, bytes: Uint8Array): boolean {
	return MAGIC[type].every((b, i) => bytes[i] === b);
}

export function validateImageUpload(input: {
	mimeType: string;
	size: number;
	bytes: Uint8Array;
}): ValidationResult {
	if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(input.mimeType)) {
		return { ok: false, reason: `类型不在白名单：${input.mimeType}` };
	}
	const type = input.mimeType as AllowedImageType;

	if (input.size <= 0 || input.size > MAX_IMAGE_BYTES) {
		return { ok: false, reason: "文件大小非法（空或超过 5MB）" };
	}

	// magic bytes 必须与声明的 mime 一致，防止改扩展名伪装。
	if (!matchesMagic(type, input.bytes)) {
		return { ok: false, reason: "文件内容与声明类型不符" };
	}

	return { ok: true, type };
}
