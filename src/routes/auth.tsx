import { createFileRoute } from "@tanstack/react-router";
import { AuthPanel } from "#/components/auth/AuthPanel";

export const Route = createFileRoute("/auth")({
	component: AuthPage,
});

function AuthPage() {
	return (
		<main className="demo-page demo-center">
			<AuthPanel redirectTo="/account" />
		</main>
	);
}
