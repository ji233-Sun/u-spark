import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { type FormQuestion, presetQuestion } from "#/db/celebration-schema";
import { formQuestionType } from "#/db/enums";
import { db } from "#/db/index";
import { adminActor } from "#/lib/celebration/admin-guard";

export type PresetRecord = {
	id: string;
	type: FormQuestion["type"];
	label: string;
	options: string[] | null;
	ratingMax: number | null;
};

export const Route = createFileRoute("/api/admin/presets")({
	server: {
		handlers: {
			GET: listPresets,
			POST: mutatePreset,
		},
	},
});

function isQuestionType(value: unknown): value is FormQuestion["type"] {
	return (formQuestionType.enumValues as readonly string[]).includes(
		value as string,
	);
}

async function listPresets({ request }: { request: Request }) {
	const actor = await adminActor(request);
	if (!actor) {
		return Response.json(
			{ ok: false, error: "需要管理员权限。" },
			{ status: 403 },
		);
	}
	const rows = await db
		.select()
		.from(presetQuestion)
		.orderBy(desc(presetQuestion.createdAt));
	const presets: PresetRecord[] = rows.map((r) => ({
		id: r.id,
		type: r.type as FormQuestion["type"],
		label: r.label,
		options: r.config?.options ?? null,
		ratingMax: r.config?.ratingMax ?? null,
	}));
	return Response.json({ ok: true, presets });
}

async function mutatePreset({ request }: { request: Request }) {
	const actor = await adminActor(request);
	if (!actor) {
		return Response.json(
			{ ok: false, error: "需要管理员权限。" },
			{ status: 403 },
		);
	}
	const body = (await request.json().catch(() => null)) as {
		action?: unknown;
		presetId?: unknown;
		type?: unknown;
		label?: unknown;
		options?: unknown;
		ratingMax?: unknown;
	} | null;
	const action = typeof body?.action === "string" ? body.action : "";

	if (action === "delete") {
		const presetId = typeof body?.presetId === "string" ? body.presetId : "";
		await db.delete(presetQuestion).where(eq(presetQuestion.id, presetId));
		return Response.json({ ok: true });
	}

	if (action === "create") {
		if (!isQuestionType(body?.type)) {
			return Response.json({ ok: false, error: "题型无效。" }, { status: 400 });
		}
		const label = typeof body?.label === "string" ? body.label.trim() : "";
		if (!label) {
			return Response.json(
				{ ok: false, error: "题目标题为必填项。" },
				{ status: 400 },
			);
		}
		const options =
			Array.isArray(body?.options) && body.options.length > 0
				? (body.options as unknown[]).map(String)
				: undefined;
		const ratingMax =
			typeof body?.ratingMax === "number" && body.ratingMax > 0
				? body.ratingMax
				: undefined;
		await db.insert(presetQuestion).values({
			type: body.type,
			label,
			config: options || ratingMax ? { options, ratingMax } : null,
			createdBy: actor.userId,
		});
		return Response.json({ ok: true });
	}

	return Response.json({ ok: false, error: "未知操作。" }, { status: 400 });
}
