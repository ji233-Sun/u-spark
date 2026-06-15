import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import { db } from "#/db/index";
import { auth } from "#/lib/auth";
import {
	isEmailIdentifier,
	PASSWORD_RESET_SENT_MESSAGE,
} from "#/lib/auth-policy";

export const Route = createFileRoute("/api/password-reset/request")({
	server: {
		handlers: {
			POST: requestPasswordReset,
		},
	},
});

async function requestPasswordReset({ request }: { request: Request }) {
	let identifier = "";

	try {
		const body = (await request.json()) as { identifier?: unknown };
		identifier = String(body.identifier ?? "")
			.trim()
			.toLowerCase();
	} catch {
		return Response.json({
			status: true,
			message: PASSWORD_RESET_SENT_MESSAGE,
		});
	}

	const email = isEmailIdentifier(identifier)
		? identifier
		: await emailForUsername(identifier);

	await auth.handler(
		new Request(new URL("/api/auth/request-password-reset", request.url), {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: new URL(request.url).origin,
			},
			body: JSON.stringify({
				email: email ?? `${identifier || "unknown"}@invalid.local`,
				redirectTo: "/reset-password",
			}),
		}),
	);

	return Response.json({ status: true, message: PASSWORD_RESET_SENT_MESSAGE });
}

async function emailForUsername(username: string): Promise<string | null> {
	if (!username) return null;

	const [found] = await db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.username, username))
		.limit(1);

	return found?.email ?? null;
}
