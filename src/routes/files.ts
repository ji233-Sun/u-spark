import { createFileRoute } from "@tanstack/react-router";
import { serveSignedFileRequest } from "#/lib/storage/file-response";

// 私有图片访问（T06 签名机制落地）：仅凭服务端签发的 HMAC 签名 + 未过期方可读取，
// 非授权方无法直接拼 URL 访问收款码 / 封面等敏感图。签发见 signedFileUrl。
// 新签发路径使用 /api/files；此路由保留用于兼容已打开的旧链接。

export const Route = createFileRoute("/files")({
	server: {
		handlers: {
			GET: serveSignedFile,
		},
	},
});

async function serveSignedFile({ request }: { request: Request }) {
	return serveSignedFileRequest(request);
}
