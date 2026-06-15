import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { emailTemplate } from "#/db/celebration-schema";
import { db } from "#/db/index";
import { adminActor } from "#/lib/celebration/admin-guard";
import {
	EMAIL_TEMPLATE_KEYS,
	type EmailTemplate,
	type EmailTemplateData,
	isKnownTemplate,
	renderTemplate,
} from "#/lib/email/templates";

export type EmailTemplateRecord = {
	key: string;
	subject: string;
	body: string;
	isOverride: boolean;
};

export const Route = createFileRoute("/api/admin/email-templates")({
	server: {
		handlers: {
			GET: listTemplates,
			POST: mutateTemplate,
		},
	},
});

// 用 Proxy 把内置模板渲染为「占位形态」（${d.x} → {x}），作为可编辑起点。
const placeholderData = new Proxy(
	{},
	{ get: (_t, prop) => `{${String(prop)}}` },
) as EmailTemplateData;

function builtinPlaceholderForm(key: EmailTemplate) {
	return renderTemplate(key, placeholderData);
}

async function listTemplates({ request }: { request: Request }) {
	const actor = await adminActor(request);
	if (!actor) {
		return Response.json(
			{ ok: false, error: "需要管理员权限。" },
			{ status: 403 },
		);
	}
	const overrides = await db.select().from(emailTemplate);
	const overrideMap = new Map(overrides.map((o) => [o.templateKey, o]));

	const templates: EmailTemplateRecord[] = EMAIL_TEMPLATE_KEYS.map((key) => {
		const override = overrideMap.get(key);
		if (override) {
			return {
				key,
				subject: override.subject,
				body: override.body,
				isOverride: true,
			};
		}
		const builtin = builtinPlaceholderForm(key);
		return {
			key,
			subject: builtin.subject,
			body: builtin.body,
			isOverride: false,
		};
	});
	return Response.json({ ok: true, templates });
}

async function mutateTemplate({ request }: { request: Request }) {
	const actor = await adminActor(request);
	if (!actor) {
		return Response.json(
			{ ok: false, error: "需要管理员权限。" },
			{ status: 403 },
		);
	}
	const body = (await request.json().catch(() => null)) as {
		action?: unknown;
		key?: unknown;
		subject?: unknown;
		body?: unknown;
	} | null;
	const key = typeof body?.key === "string" ? body.key : "";
	if (!isKnownTemplate(key)) {
		return Response.json({ ok: false, error: "未知模板。" }, { status: 400 });
	}

	if (body?.action === "reset") {
		await db.delete(emailTemplate).where(eq(emailTemplate.templateKey, key));
		return Response.json({ ok: true });
	}

	const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
	const text = typeof body?.body === "string" ? body.body.trim() : "";
	if (!subject || !text) {
		return Response.json(
			{ ok: false, error: "主题与正文均为必填。" },
			{ status: 400 },
		);
	}
	await db
		.insert(emailTemplate)
		.values({ templateKey: key, subject, body: text, updatedBy: actor.userId })
		.onConflictDoUpdate({
			target: emailTemplate.templateKey,
			set: {
				subject,
				body: text,
				updatedBy: actor.userId,
				updatedAt: new Date(),
			},
		});
	return Response.json({ ok: true });
}
