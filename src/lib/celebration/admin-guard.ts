import { auth } from "#/lib/auth";
import type { Actor } from "./access.ts";

// 管理员鉴权（T28）：从请求会话解析 Actor，仅 admin 放行，否则返回 null。
// 全局角色仅 user / admin（见 access.ts）；管理员后台所有接口前置此守卫。
export async function adminActor(request: Request): Promise<Actor | null> {
	const session = await auth.api.getSession({ headers: request.headers });
	const user = session?.user;
	if (!user) return null;
	if (user.role !== "admin") return null;
	return { userId: user.id, role: "admin" };
}
