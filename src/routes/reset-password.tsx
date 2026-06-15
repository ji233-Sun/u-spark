import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/reset-password")({
	validateSearch: (search) => ({
		token: typeof search.token === "string" ? search.token : "",
		error: typeof search.error === "string" ? search.error : "",
	}),
	component: ResetPassword,
});

function ResetPassword() {
	const { token, error: linkError } = useSearch({ from: "/reset-password" });
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState(
		linkError ? "重置链接无效或已过期，请重新申请。" : "",
	);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setMessage("");

		if (!token) {
			setError("重置链接无效或已过期，请重新申请。");
			return;
		}
		if (password !== confirmPassword) {
			setError("两次输入的密码不一致。");
			return;
		}

		setLoading(true);
		try {
			const response = await fetch("/api/auth/reset-password", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ token, newPassword: password }),
			});

			if (!response.ok) {
				setError("重置链接无效、已过期或已被使用，请重新申请。");
				return;
			}

			setPassword("");
			setConfirmPassword("");
			setMessage("密码已重置，请使用新密码登录。");
		} catch {
			setError("密码重置失败，请稍后再试。");
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="demo-page demo-center">
			<section className="demo-panel w-full max-w-md">
				<p className="island-kicker mb-2">Account recovery</p>
				<h1 className="demo-title">设置新密码</h1>

				<form onSubmit={handleSubmit} className="mt-6 grid gap-4">
					<div className="grid gap-2">
						<label htmlFor="password" className="text-sm font-medium">
							新密码
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="demo-input"
							required
							minLength={8}
							autoComplete="new-password"
							disabled={!token || Boolean(message)}
						/>
					</div>

					<div className="grid gap-2">
						<label htmlFor="confirmPassword" className="text-sm font-medium">
							确认新密码
						</label>
						<input
							id="confirmPassword"
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							className="demo-input"
							required
							minLength={8}
							autoComplete="new-password"
							disabled={!token || Boolean(message)}
						/>
					</div>

					{error && (
						<div className="demo-alert demo-alert-danger">
							<p className="text-sm text-red-600">{error}</p>
						</div>
					)}
					{message && (
						<div className="demo-alert">
							<p className="text-sm">{message}</p>
						</div>
					)}

					<button
						type="submit"
						disabled={loading || !token || Boolean(message)}
						className="demo-button w-full"
					>
						{loading ? "Please wait" : "重置密码"}
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
