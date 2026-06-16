import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
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
	redirectTo = "/dashboard",
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
	const [needsOtp, setNeedsOtp] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	if (isPending) {
		return (
			<div className="flex min-h-64 items-center justify-center">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (session?.user && showSignedInState) {
		return (
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>已登录</CardTitle>
					<CardDescription>{session.user.email}</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-3 sm:grid-cols-2">
					<Button asChild>
						<Link to="/dashboard">进入用户中心</Link>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							void authClient.signOut({
								fetchOptions: {
									onSuccess: () => {
										void navigate({ to: "/" });
									},
								},
							});
						}}
					>
						退出登录
					</Button>
				</CardContent>
			</Card>
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
						callbackURL: redirectTo,
					})
				: await authClient.signIn.username({
						username: identifier,
						password,
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

			const result = await fetch("/api/auth/register/begin", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					email,
					username,
					password,
				}),
			});

			if (!result.ok) {
				const data = (await result.json().catch(() => null)) as {
					error?: string;
				} | null;
				setError(readableAuthError(data?.error));
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
			const result = await fetch("/api/auth/register/verify", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email, otp, password }),
			});
			if (!result.ok) {
				const data = (await result.json().catch(() => null)) as {
					error?: string;
				} | null;
				setError(readableAuthError(data?.error));
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
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle className="text-2xl">
					{mode === "signup" ? "创建账号" : "登录 U-Spark"}
				</CardTitle>
				<CardDescription>
					{mode === "signup"
						? "注册后即可发起立项与投稿。"
						: "使用用户名/邮箱密码、或登录链接进入。"}
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-6">
				<Tabs value={mode} onValueChange={(v) => switchMode(v as AuthMode)}>
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="password">密码</TabsTrigger>
						<TabsTrigger value="magic">链接</TabsTrigger>
						<TabsTrigger value="signup">注册</TabsTrigger>
					</TabsList>
				</Tabs>

				{mode === "password" && (
					<form onSubmit={handlePasswordLogin} className="grid gap-4">
						<div className="grid gap-2">
							<Label htmlFor="identifier">用户名或邮箱</Label>
							<Input
								id="identifier"
								type="text"
								value={identifier}
								onChange={(e) => setIdentifier(e.target.value)}
								required
								autoComplete="username"
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="password">密码</Label>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={8}
								autoComplete="current-password"
							/>
						</div>
						<Feedback error={error} message={message} />
						<SubmitButton loading={loading} label="登录" />
						<Link
							to="/forgot-password"
							className="text-center text-sm text-muted-foreground no-underline hover:text-foreground"
						>
							忘记密码？
						</Link>
					</form>
				)}

				{mode === "magic" && (
					<form onSubmit={handleMagicLink} className="grid gap-4">
						<div className="grid gap-2">
							<Label htmlFor="magicEmail">邮箱</Label>
							<Input
								id="magicEmail"
								type="email"
								value={magicEmail}
								onChange={(e) => setMagicEmail(e.target.value)}
								required
								autoComplete="email"
							/>
						</div>
						<Feedback error={error} message={message} />
						<SubmitButton loading={loading} label="发送登录链接" />
					</form>
				)}

				{mode === "signup" && !needsOtp && (
					<form onSubmit={handleSignUp} className="grid gap-4">
						<div className="grid gap-2">
							<Label htmlFor="username">用户名</Label>
							<Input
								id="username"
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								required
								minLength={3}
								maxLength={30}
								autoComplete="username"
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="email">邮箱</Label>
							<Input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								autoComplete="email"
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="newPassword">密码</Label>
							<Input
								id="newPassword"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={8}
								autoComplete="new-password"
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="confirmPassword">确认密码</Label>
							<Input
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
								minLength={8}
								autoComplete="new-password"
							/>
						</div>
						<Feedback error={error} message={message} />
						<SubmitButton loading={loading} label="创建账号并发送验证码" />
					</form>
				)}

				{mode === "signup" && needsOtp && (
					<form onSubmit={handleVerifyOtp} className="grid gap-4">
						<Alert>
							<AlertDescription>验证码已发送至 {email}。</AlertDescription>
						</Alert>
						<div className="grid gap-2">
							<Label htmlFor="otp">验证码</Label>
							<Input
								id="otp"
								type="text"
								inputMode="numeric"
								value={otp}
								onChange={(e) => setOtp(e.target.value)}
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
			</CardContent>
		</Card>
	);
}

function Feedback({ error, message }: { error: string; message: string }) {
	if (error) {
		return (
			<Alert variant="destructive">
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		);
	}
	if (message) {
		return (
			<Alert>
				<AlertDescription>{message}</AlertDescription>
			</Alert>
		);
	}
	return null;
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
	return (
		<Button type="submit" disabled={loading} className="w-full">
			{loading ? (
				<>
					<Loader2 className="animate-spin" />
					请稍候
				</>
			) : (
				label
			)}
		</Button>
	);
}
