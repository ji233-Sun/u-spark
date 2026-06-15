import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "#/lib/auth-client";
import {
	isEmailIdentifier,
	MAGIC_LINK_SENT_MESSAGE,
	PASSWORD_LOGIN_ERROR,
} from "#/lib/auth-policy";

type AuthMode = "password" | "magic" | "signup";

type AuthPanelProps = {
	redirectTo?: string;
	showSignedInState?: boolean;
};

function readableAuthError(message: string | undefined): string {
	if (!message) return "操作失败，请稍后重试。";
	if (message.includes("USERNAME_IS_ALREADY_TAKEN")) {
		return "用户名已被占用，请换一个。";
	}
	if (
		message.includes("USER_ALREADY_EXISTS") ||
		message.includes("already exists")
	) {
		return "邮箱已注册，请直接登录或换一个邮箱。";
	}
	if (message.includes("INVALID_OTP") || message.includes("OTP")) {
		return "验证码无效或已过期，请重新获取。";
	}
	if (message.includes("USERNAME_TOO_SHORT")) {
		return "用户名至少需要 3 个字符。";
	}
	if (message.includes("USERNAME_TOO_LONG")) {
		return "用户名最多 30 个字符。";
	}
	if (message.includes("PASSWORD_TOO_SHORT")) {
		return "密码至少需要 8 位。";
	}
	if (message.includes("EMAIL_NOT_VERIFIED")) {
		return "请先完成邮箱验证。";
	}
	return message;
}

export function AuthPanel({
	redirectTo = "/account",
	showSignedInState = true,
}: AuthPanelProps) {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();
	const [mode, setMode] = useState<AuthMode>("password");
	const [identifier, setIdentifier] = useState("");
	const [magicEmail, setMagicEmail] = useState("");
	const [email, setEmail] = useState("");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [otp, setOtp] = useState("");
	const [rememberMe, setRememberMe] = useState(true);
	const [needsOtp, setNeedsOtp] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	if (isPending) {
		return (
			<div className="flex min-h-64 items-center justify-center">
				<div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-800 dark:border-t-neutral-100" />
			</div>
		);
	}

	if (session?.user && showSignedInState) {
		return (
			<section className="demo-panel w-full max-w-md space-y-6">
				<div className="space-y-1.5">
					<p className="island-kicker mb-2">Session</p>
					<h1 className="demo-title">已登录</h1>
					<p className="demo-muted text-sm">{session.user.email}</p>
				</div>

				<div className="flex items-center gap-3">
					{session.user.image ? (
						<img src={session.user.image} alt="" className="h-10 w-10" />
					) : (
						<div className="flex h-10 w-10 items-center justify-center bg-neutral-200 dark:bg-neutral-800">
							<span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
								{session.user.name?.charAt(0).toUpperCase() || "U"}
							</span>
						</div>
					)}
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">{session.user.name}</p>
						<p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
							{session.user.email}
						</p>
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-2">
					<Link to="/account" className="demo-button no-underline">
						进入账号页
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
						className="demo-button demo-button-secondary"
					>
						退出登录
					</button>
				</div>
			</section>
		);
	}

	const resetFeedback = () => {
		setError("");
		setMessage("");
	};

	const switchMode = (nextMode: AuthMode) => {
		setMode(nextMode);
		setNeedsOtp(false);
		setOtp("");
		resetFeedback();
	};

	const goAfterAuth = () => {
		void navigate({ to: redirectTo });
	};

	const handlePasswordLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		resetFeedback();
		setLoading(true);

		try {
			const login = isEmailIdentifier(identifier)
				? await authClient.signIn.email({
						email: identifier,
						password,
						rememberMe,
						callbackURL: redirectTo,
					})
				: await authClient.signIn.username({
						username: identifier,
						password,
						rememberMe,
						callbackURL: redirectTo,
					});

			if (login.error) {
				setError(PASSWORD_LOGIN_ERROR);
				return;
			}
			goAfterAuth();
		} catch {
			setError(PASSWORD_LOGIN_ERROR);
		} finally {
			setLoading(false);
		}
	};

	const handleMagicLink = async (e: React.FormEvent) => {
		e.preventDefault();
		resetFeedback();
		setLoading(true);

		try {
			await authClient.signIn.magicLink({
				email: magicEmail,
				callbackURL: redirectTo,
				errorCallbackURL: "/auth",
			});
			setMessage(MAGIC_LINK_SENT_MESSAGE);
		} catch {
			setMessage(MAGIC_LINK_SENT_MESSAGE);
		} finally {
			setLoading(false);
		}
	};

	const handleSignUp = async (e: React.FormEvent) => {
		e.preventDefault();
		resetFeedback();
		setLoading(true);

		try {
			if (password !== confirmPassword) {
				setError("两次输入的密码不一致。");
				return;
			}

			const availability = await authClient.isUsernameAvailable({ username });
			if (availability.error) {
				setError(readableAuthError(availability.error.message));
				return;
			}
			if (!availability.data?.available) {
				setError("用户名已被占用，请换一个。");
				return;
			}

			const result = await authClient.signUp.email({
				email,
				password,
				name: username,
				username,
				displayUsername: username,
				rememberMe,
				callbackURL: redirectTo,
			});

			if (result.error) {
				setError(readableAuthError(result.error.message));
				return;
			}

			setNeedsOtp(true);
			setMessage("验证码已发送，请在 5 分钟内完成验证。");
		} catch (err) {
			setError(
				err instanceof Error ? readableAuthError(err.message) : "注册失败。",
			);
		} finally {
			setLoading(false);
		}
	};

	const handleVerifyOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		resetFeedback();
		setLoading(true);

		try {
			const result = await authClient.emailOtp.verifyEmail({
				email,
				otp,
			});
			if (result.error) {
				setError(readableAuthError(result.error.message));
				return;
			}
			setMessage("邮箱验证成功，正在进入账号。");
			goAfterAuth();
		} catch (err) {
			setError(
				err instanceof Error
					? readableAuthError(err.message)
					: "验证码验证失败。",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<section className="demo-panel w-full max-w-md">
			<p className="island-kicker mb-2">U-Spark Account</p>
			<h1 className="demo-title">
				{mode === "signup" ? "Create an account" : "Sign in"}
			</h1>

			<div className="mt-6 grid grid-cols-3 gap-2 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-1">
				<button
					type="button"
					onClick={() => switchMode("password")}
					className={`demo-button px-2 ${mode === "password" ? "" : "demo-button-secondary"}`}
				>
					密码
				</button>
				<button
					type="button"
					onClick={() => switchMode("magic")}
					className={`demo-button px-2 ${mode === "magic" ? "" : "demo-button-secondary"}`}
				>
					链接
				</button>
				<button
					type="button"
					onClick={() => switchMode("signup")}
					className={`demo-button px-2 ${mode === "signup" ? "" : "demo-button-secondary"}`}
				>
					注册
				</button>
			</div>

			{mode === "password" && (
				<form onSubmit={handlePasswordLogin} className="mt-6 grid gap-4">
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

					<div className="grid gap-2">
						<label htmlFor="password" className="text-sm font-medium">
							密码
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="demo-input"
							required
							minLength={8}
							autoComplete="current-password"
						/>
					</div>

					<RememberMe checked={rememberMe} onChange={setRememberMe} />
					<Feedback error={error} message={message} />
					<SubmitButton loading={loading} label="登录" />
					<Link
						to="/forgot-password"
						className="demo-muted text-center text-sm no-underline transition-colors hover:text-[var(--sea-ink)]"
					>
						忘记密码？
					</Link>
				</form>
			)}

			{mode === "magic" && (
				<form onSubmit={handleMagicLink} className="mt-6 grid gap-4">
					<div className="grid gap-2">
						<label htmlFor="magicEmail" className="text-sm font-medium">
							邮箱
						</label>
						<input
							id="magicEmail"
							type="email"
							value={magicEmail}
							onChange={(e) => setMagicEmail(e.target.value)}
							className="demo-input"
							required
							autoComplete="email"
						/>
					</div>

					<Feedback error={error} message={message} />
					<SubmitButton loading={loading} label="发送登录链接" />
				</form>
			)}

			{mode === "signup" && !needsOtp && (
				<form onSubmit={handleSignUp} className="mt-6 grid gap-4">
					<div className="grid gap-2">
						<label htmlFor="username" className="text-sm font-medium">
							用户名
						</label>
						<input
							id="username"
							type="text"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							className="demo-input"
							required
							minLength={3}
							maxLength={30}
							autoComplete="username"
						/>
					</div>

					<div className="grid gap-2">
						<label htmlFor="email" className="text-sm font-medium">
							邮箱
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="demo-input"
							required
							autoComplete="email"
						/>
					</div>

					<div className="grid gap-2">
						<label htmlFor="newPassword" className="text-sm font-medium">
							密码
						</label>
						<input
							id="newPassword"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="demo-input"
							required
							minLength={8}
							autoComplete="new-password"
						/>
					</div>

					<div className="grid gap-2">
						<label htmlFor="confirmPassword" className="text-sm font-medium">
							确认密码
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
						/>
					</div>

					<RememberMe checked={rememberMe} onChange={setRememberMe} />
					<Feedback error={error} message={message} />
					<SubmitButton loading={loading} label="创建账号并发送验证码" />
				</form>
			)}

			{mode === "signup" && needsOtp && (
				<form onSubmit={handleVerifyOtp} className="mt-6 grid gap-4">
					<div className="demo-alert">
						<p className="text-sm">验证码已发送至 {email}。</p>
					</div>
					<div className="grid gap-2">
						<label htmlFor="otp" className="text-sm font-medium">
							验证码
						</label>
						<input
							id="otp"
							type="text"
							inputMode="numeric"
							value={otp}
							onChange={(e) => setOtp(e.target.value)}
							className="demo-input"
							required
							minLength={6}
							maxLength={6}
							autoComplete="one-time-code"
						/>
					</div>

					<Feedback error={error} message={message} />
					<SubmitButton loading={loading} label="验证并登录" />
				</form>
			)}
		</section>
	);
}

function RememberMe({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]">
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				className="h-4 w-4 accent-[var(--lagoon-deep)]"
			/>
			<span>记住我</span>
		</label>
	);
}

function Feedback({ error, message }: { error: string; message: string }) {
	if (error) {
		return (
			<div className="demo-alert demo-alert-danger">
				<p className="text-sm text-red-600">{error}</p>
			</div>
		);
	}
	if (message) {
		return (
			<div className="demo-alert">
				<p className="text-sm">{message}</p>
			</div>
		);
	}
	return null;
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
	return (
		<button type="submit" disabled={loading} className="demo-button w-full">
			{loading ? (
				<span className="flex items-center justify-center gap-2">
					<span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-white dark:border-neutral-600 dark:border-t-neutral-900" />
					<span>Please wait</span>
				</span>
			) : (
				label
			)}
		</button>
	);
}
