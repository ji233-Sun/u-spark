import { randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "#/lib/auth";
import {
	ALLOWED_IMAGE_TYPES,
	IMAGE_EXTENSIONS,
	uploadImage,
} from "#/lib/storage";

// 通用图片上传入口（T19 封面 / T22 收款码共用）。鉴权 + 白名单校验 + 存储 → 返回 key。
// 资源级越权防护由消费方接口（提交稿件 / 上传收款码）负责，此处仅保证「登录 + 合法图片」。

// 上传分类 → 存储路径前缀
const CATEGORY_PREFIX = {
	"manuscript-cover": "manuscript-cover",
	"payment-code": "payment-code",
} as const;
type UploadCategory = keyof typeof CATEGORY_PREFIX;

function isCategory(value: unknown): value is UploadCategory {
	return typeof value === "string" && value in CATEGORY_PREFIX;
}

export const Route = createFileRoute("/api/uploads")({
	server: {
		handlers: {
			POST: handleUpload,
		},
	},
});

async function handleUpload({ request }: { request: Request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
	}

	const formData = await request.formData().catch(() => null);
	const file = formData?.get("file");
	const category = formData?.get("category");

	if (!isCategory(category)) {
		return Response.json(
			{ ok: false, error: "上传分类无效。" },
			{ status: 400 },
		);
	}
	if (!(file instanceof File)) {
		return Response.json({ ok: false, error: "缺少文件。" }, { status: 400 });
	}
	if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
		return Response.json(
			{ ok: false, error: `仅支持图片：${ALLOWED_IMAGE_TYPES.join(" / ")}` },
			{ status: 400 },
		);
	}

	const bytes = new Uint8Array(await file.arrayBuffer());
	const ext = IMAGE_EXTENSIONS[file.type as keyof typeof IMAGE_EXTENSIONS];
	const key = `${CATEGORY_PREFIX[category]}/${randomUUID()}.${ext}`;

	const result = await uploadImage({ key, mimeType: file.type, bytes });
	if (!result.ok) {
		return Response.json({ ok: false, error: result.reason }, { status: 400 });
	}

	return Response.json({ ok: true, key: result.key });
}
