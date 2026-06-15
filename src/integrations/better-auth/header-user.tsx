import { Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "#/lib/auth-client";

export default function BetterAuthHeader() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return (
			<div className="h-8 w-8 animate-pulse bg-neutral-100 dark:bg-neutral-800" />
		);
	}

	if (session?.user) {
		return (
			<div className="flex items-center gap-2">
				<Link
					to="/account"
					className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5"
				>
					{session.user.image ? (
						<img src={session.user.image} alt="" className="h-6 w-6" />
					) : (
						<span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
							{session.user.name?.charAt(0).toUpperCase() || "U"}
						</span>
					)}
					<span className="hidden max-w-24 truncate sm:inline">
						{session.user.name || session.user.email}
					</span>
				</Link>
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
					className="inline-flex h-9 items-center rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 text-sm font-semibold text-[var(--sea-ink-soft)] transition hover:-translate-y-0.5 hover:text-[var(--sea-ink)]"
				>
					登出
				</button>
			</div>
		);
	}

	return (
		<Link
			to="/auth"
			className="inline-flex h-9 items-center rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5"
		>
			登录
		</Link>
	);
}
