import { createFileRoute } from "@tanstack/react-router";
import { auth } from "#/lib/auth";
import { isVerifiedRegistrationRequest } from "#/lib/auth-registration.ts";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => auth.handler(request),
			POST: ({ request }) => {
				const pathname = new URL(request.url).pathname;
				if (
					pathname.endsWith("/sign-up/email") &&
					!isVerifiedRegistrationRequest(request)
				) {
					return Response.json(
						{ error: "请先完成邮箱验证。" },
						{ status: 403 },
					);
				}
				return auth.handler(request);
			},
		},
	},
});
