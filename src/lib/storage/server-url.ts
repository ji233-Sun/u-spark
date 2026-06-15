import { buildSignedPath, signKey } from "./signing.ts";

// 私有图片签名 URL（服务端专用，T19 封面 / T22 收款码共用）。
// secret 取自 BETTER_AUTH_SECRET，TTL 默认 1 小时；每次页面 / 接口读取时重新签发。
// 注意：本模块用到 Date.now()，仅供服务端运行时，勿在 vitest 纯函数测试中引入。

const SIGNED_TTL_MS = 60 * 60 * 1000; // 1 小时

function storageSecret(): string {
	return process.env.BETTER_AUTH_SECRET ?? "dev-storage-secret";
}

// 由存储 key 生成带签名、限时有效的访问路径。
export function signedFileUrl(key: string, now: number = Date.now()): string {
	return buildSignedPath(key, now + SIGNED_TTL_MS, storageSecret());
}

// 校验入参（供 /files 路由），复用同一 secret。
export { signKey, storageSecret };
