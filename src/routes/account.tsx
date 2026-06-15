import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/account")({
	component: AccountPage,
});

function AccountPage() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	useEffect(() => {
		if (!isPending && !session?.user) {
			void navigate({ to: "/auth", replace: true });
		}
	}, [isPending, navigate, session?.user]);

	if (isPending || !session?.user) {
		return (
			<main className="demo-page demo-center">
				<section className="demo-panel w-full max-w-md">
					<div className="flex min-h-32 items-center justify-center">
						<div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-800 dark:border-t-neutral-100" />
					</div>
				</section>
			</main>
		);
	}

	return (
		<main className="demo-page demo-center">
			<section className="demo-panel w-full max-w-lg space-y-6">
				<div>
					<p className="island-kicker mb-2">Protected</p>
					<h1 className="demo-title">账号中心</h1>
					<p className="demo-muted mt-2 text-sm">
						这是一条受保护路由，只有登录后才能访问。
					</p>
				</div>

				<div className="demo-list-item grid gap-2">
					<div className="flex items-center justify-between gap-4">
						<span className="demo-muted text-sm">用户名</span>
						<span className="text-sm font-semibold">{session.user.name}</span>
					</div>
					<div className="flex items-center justify-between gap-4">
						<span className="demo-muted text-sm">邮箱</span>
						<span className="text-sm font-semibold">{session.user.email}</span>
					</div>
					<div className="flex items-center justify-between gap-4">
						<span className="demo-muted text-sm">邮箱验证</span>
						<span className="text-sm font-semibold">
							{session.user.emailVerified ? "已验证" : "待验证"}
						</span>
					</div>
				</div>

				<button
					type="button"
					onClick={() => {
						void authClient.signOut({
							fetchOptions: {
								onSuccess: () => {
									void navigate({ to: "/auth" });
								},
							},
						});
					}}
					className="demo-button demo-button-secondary w-full"
				>
					退出登录
				</button>
			</section>
		</main>
	);
}
