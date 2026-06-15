import { describe, expect, it } from "vitest";
import { buildSignedPath, signKey, verifySignature } from "./signing.ts";

const SECRET = "test-secret";
const KEY = "payment-codes/p1.png";

describe("签名 URL（私有图片访问）", () => {
	it("合法签名在有效期内通过", () => {
		const expiresAt = 10_000;
		const sig = signKey(KEY, expiresAt, SECRET);
		expect(
			verifySignature({
				key: KEY,
				expiresAt,
				signature: sig,
				secret: SECRET,
				now: 5_000,
			}),
		).toEqual({ ok: true });
	});

	it("过期被拒", () => {
		const expiresAt = 10_000;
		const sig = signKey(KEY, expiresAt, SECRET);
		expect(
			verifySignature({
				key: KEY,
				expiresAt,
				signature: sig,
				secret: SECRET,
				now: 20_000,
			}),
		).toMatchObject({ ok: false });
	});

	it("篡改签名被拒", () => {
		const expiresAt = 10_000;
		expect(
			verifySignature({
				key: KEY,
				expiresAt,
				signature: "deadbeef",
				secret: SECRET,
				now: 5_000,
			}),
		).toMatchObject({ ok: false });
	});

	it("换 key 签名失配（防越权访问他人图片）", () => {
		const expiresAt = 10_000;
		const sig = signKey(KEY, expiresAt, SECRET);
		expect(
			verifySignature({
				key: "payment-codes/other.png",
				expiresAt,
				signature: sig,
				secret: SECRET,
				now: 5_000,
			}),
		).toMatchObject({ ok: false });
	});

	it("buildSignedPath 含 key/expires/sig", () => {
		const path = buildSignedPath(KEY, 10_000, SECRET);
		expect(path).toContain("expires=10000");
		expect(path).toContain("sig=");
	});
});
