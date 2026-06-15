import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PASSWORD_RESET_SENT_MESSAGE } from "#/lib/auth-policy";

export const Route = createFileRoute("/forgot-password")({
	component: ForgotPassword,
});

function ForgotPassword() {
	const [identifier, setIdentifier] = useState("");
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setMessage("");

		try {
			await fetch("/api/password-reset/request", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ identifier }),
			});
			setMessage(PASSWORD_RESET_SENT_MESSAGE);
		} catch {
			setMessage(PASSWORD_RESET_SENT_MESSAGE);
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="demo-page demo-center">
			<section className="demo-panel w-full max-w-md">
				<p className="island-kicker mb-2">Account recovery</p>
				<h1 className="demo-title">找回密码</h1>

				<form onSubmit={handleSubmit} className="mt-6 grid gap-4">
					<div className="grid gap-2">
						<label htmlFor="identifier" className="text-sm font-medium">
							用户名或邮箱
						</label>
						<input
							id="identifier"
							type="text"
							value={identifier}
							onChange={(e) => setIdentifier(e.target.value)}
							className="demo-input"
							required
							autoComplete="username"
						/>
					</div>

					{message && (
						<div className="demo-alert">
							<p className="text-sm">{message}</p>
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="demo-button w-full"
					>
						{loading ? "Please wait" : "发送重置链接"}
					</button>
				</form>

				<div className="mt-5 text-center">
					<Link
						to="/auth"
						className="demo-muted text-sm no-underline transition-colors hover:text-[var(--sea-ink)]"
					>
						返回登录
					</Link>
				</div>
			</section>
		</main>
	);
}
