import { getObject, mimeFromKey, verifySignature } from "./index.ts";
import { storageSecret } from "./server-url.ts";

// 私有图片访问响应：签名校验通过后从存储读取对象。
export async function serveSignedFileRequest(request: Request) {
	const url = new URL(request.url);
	const key = url.searchParams.get("key") ?? "";

	const expiresAt = Number(url.searchParams.get("expires"));
	const signature = url.searchParams.get("sig") ?? "";
	if (!key || !Number.isFinite(expiresAt) || !signature) {
		return new Response("Bad Request", { status: 400 });
	}

	const verdict = verifySignature({
		key,
		expiresAt,
		signature,
		secret: storageSecret(),
		now: Date.now(),
	});
	if (!verdict.ok) {
		return new Response(verdict.reason, { status: 403 });
	}

	const bytes = await getObject(key);
	if (!bytes) {
		return new Response("Not Found", { status: 404 });
	}

	const contentType = mimeFromKey(key) ?? "application/octet-stream";
	return new Response(bytes as unknown as BodyInit, {
		status: 200,
		headers: {
			"content-type": contentType,
			"cache-control": "private, max-age=3600",
		},
	});
}
