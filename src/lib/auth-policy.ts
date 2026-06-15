export const AUTH_OTP_EXPIRES_SECONDS = 5 * 60;
export const AUTH_MAGIC_LINK_EXPIRES_SECONDS = 5 * 60;
export const AUTH_PASSWORD_RESET_EXPIRES_SECONDS = 24 * 60 * 60;
export const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;
export const AUTH_RATE_LIMIT_MAX = 3;

export const PASSWORD_LOGIN_ERROR = "账号或密码不正确，请检查后再试。";
export const MAGIC_LINK_SENT_MESSAGE = "如果账号存在，登录链接会发送到该邮箱。";
export const PASSWORD_RESET_SENT_MESSAGE =
	"如果账号存在，重置链接会发送到绑定邮箱。";

export function isEmailIdentifier(value: string): boolean {
	return value.includes("@");
}
