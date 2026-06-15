import { createFileRoute } from "@tanstack/react-router";
import { getObject, mimeFromKey, verifySignature } from "#/lib/storage";
import { storageSecret } from "#/lib/storage/server-url";

// 私有图片访问（T06 签名机制落地）：仅凭服务端签发的 HMAC 签名 + 未过期方可读取，
// 非授权方无法直接拼 URL 访问收款码 / 封面等敏感图。签发见 signedFileUrl。

export const Route = createFileRoute("/files/$")({
	server: {
		handlers: {
			GET: serveSignedFile,
		},
	},
});

async function serveSignedFile({ request }: { request: Request }) {
	const url = new URL(request.url);
	const marker = "/files/";
	const encoded = url.pathname.slice(
		url.pathname.indexOf(marker) + marker.length,
	);
	const key = decodeURIComponent(encoded);

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
