import { createFileRoute } from "@tanstack/react-router";
import { verifyPendingRegistration } from "#/lib/auth-registration.ts";

export const Route = createFileRoute("/api/auth/register/verify")({
	server: {
		handlers: {
			POST: verifyRegistration,
		},
	},
});

async function verifyRegistration({ request }: { request: Request }) {
	const body = (await request.json().catch(() => null)) as {
		email?: unknown;
		otp?: unknown;
		password?: unknown;
	} | null;

	const result = await verifyPendingRegistration({
		email: String(body?.email ?? ""),
		otp: String(body?.otp ?? ""),
		password: String(body?.password ?? ""),
		request,
	});

	if (!result.ok) {
		return Response.json(
			{ ok: false, error: result.error },
			{ status: result.status },
		);
	}
	return Response.json({ ok: true }, { headers: result.headers });
}
