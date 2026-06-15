import { MemoryStorageProvider, type StorageProvider } from "./provider.ts";
import { validateImageUpload } from "./validation.ts";

// 图片上传统一入口（T06 #6）：校验（白名单 + magic bytes）→ 存储 → 返回 key。

let provider: StorageProvider = new MemoryStorageProvider();
export function setStorageProvider(p: StorageProvider): void {
	provider = p;
}

export type UploadInput = {
	key: string; // 存储路径，如 payment-codes/<projectId>.png
	mimeType: string;
	bytes: Uint8Array;
};

export type UploadResult =
	| { ok: true; key: string; size: number }
	| { ok: false; reason: string };

export async function uploadImage(input: UploadInput): Promise<UploadResult> {
	const v = validateImageUpload({
		mimeType: input.mimeType,
		size: input.bytes.byteLength,
		bytes: input.bytes,
	});
	if (!v.ok) {
		return { ok: false, reason: v.reason };
	}
	const obj = await provider.put(input.key, input.bytes);
	return { ok: true, key: obj.key, size: obj.size };
}

// 读取对象（私有访问前需先校验签名，见 signing.ts）。
export async function getObject(key: string): Promise<Uint8Array | null> {
	return provider.get(key);
}

export { buildSignedPath, signKey, verifySignature } from "./signing.ts";
export {
	ALLOWED_IMAGE_TYPES,
	MAX_IMAGE_BYTES,
	validateImageUpload,
} from "./validation.ts";
export type { StorageProvider } from "./provider.ts";
