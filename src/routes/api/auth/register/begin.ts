import { createFileRoute } from "@tanstack/react-router";
import { beginPendingRegistration } from "#/lib/auth-registration.ts";

export const Route = createFileRoute("/api/auth/register/begin")({
	server: {
		handlers: {
			POST: beginRegistration,
		},
	},
});

async function beginRegistration({ request }: { request: Request }) {
	const body = (await request.json().catch(() => null)) as {
		email?: unknown;
		username?: unknown;
		password?: unknown;
	} | null;

	const result = await beginPendingRegistration({
		email: String(body?.email ?? ""),
		username: String(body?.username ?? ""),
		password: String(body?.password ?? ""),
	});

	if (!result.ok) {
		return Response.json(
			{ ok: false, error: result.error },
			{ status: result.status },
		);
	}
	return Response.json({ ok: true });
}
