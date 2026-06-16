import { createFileRoute } from "@tanstack/react-router";
import { serveSignedFileRequest } from "#/lib/storage/file-response";

// 私有图片访问 API：图片子资源请求在 dev server 下需走 /api 路径。
export const Route = createFileRoute("/api/files")({
	server: {
		handlers: {
			GET: serveSignedFile,
		},
	},
});

async function serveSignedFile({ request }: { request: Request }) {
	return serveSignedFileRequest(request);
}
