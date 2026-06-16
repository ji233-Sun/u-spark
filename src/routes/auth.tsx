import { createFileRoute } from "@tanstack/react-router";
import { AuthPanel } from "#/components/auth/AuthPanel";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
	return (
		<main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
			<AuthPanel redirectTo="/dashboard" />
		</main>
	);
}
