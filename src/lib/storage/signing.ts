import { createHmac } from "node:crypto";

// 签名 URL（T06 #6）：收款码等敏感图走私有访问——HMAC 签名 + 限时有效，
// 非授权方无法直接拼 URL 访问。纯逻辑（secret / now 显式传入，便于测试）。

export function signKey(
	key: string,
	expiresAt: number,
	secret: string,
): string {
	return createHmac("sha256", secret)
		.update(`${key}:${expiresAt}`)
		.digest("hex");
}

// 生成带签名的访问路径，供前端请求私有图片。
export function buildSignedPath(
	key: string,
	expiresAt: number,
	secret: string,
): string {
	const sig = signKey(key, expiresAt, secret);
	return `/files/${encodeURIComponent(key)}?expires=${expiresAt}&sig=${sig}`;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export function verifySignature(input: {
	key: string;
	expiresAt: number;
	signature: string;
	secret: string;
	now: number;
}): VerifyResult {
	if (input.now > input.expiresAt) {
		return { ok: false, reason: "链接已过期" };
	}
	const expected = signKey(input.key, input.expiresAt, input.secret);
	if (!timingSafeEqualHex(expected, input.signature)) {
		return { ok: false, reason: "签名无效" };
	}
	return { ok: true };
}

// 定长时间安全比较，避免计时侧信道。
function timingSafeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}
