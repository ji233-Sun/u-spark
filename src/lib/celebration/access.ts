// RBAC SSOT（T04 #4）纯逻辑层：角色 / 越权判断，零 DB / 框架依赖，便于单测。
// 「组织者」不是全局角色，而是数据级关系（user × activity，见 activity_organizer）；
// 全局角色只有 user / admin（better-auth user.role）。

export type Role = "user" | "admin";

export type Actor = {
	userId: string;
	role: Role;
};

export class UnauthenticatedError extends Error {
	constructor(message = "未登录") {
		super(message);
		this.name = "UnauthenticatedError";
	}
}

export class AccessDeniedError extends Error {
	constructor(message = "无权访问") {
		super(message);
		this.name = "AccessDeniedError";
	}
}

// ── 全局角色守卫 ──
export function isAdmin(actor: Actor): boolean {
	return actor.role === "admin";
}

export function requireUser(actor: Actor | null | undefined): Actor {
	if (!actor) {
		throw new UnauthenticatedError();
	}
	return actor;
}

export function requireAdmin(actor: Actor | null | undefined): Actor {
	const a = requireUser(actor);
	if (!isAdmin(a)) {
		throw new AccessDeniedError("需要管理员权限");
	}
	return a;
}

// ── 数据级：组织者只能管理自己负责的活动 ──
// isOrganizerOfActivity 由调用方查 activity_organizer 提供（保持本层纯函数、可单测）。
export function canManageActivity(
	actor: Actor,
	isOrganizerOfActivity: boolean,
): boolean {
	return isAdmin(actor) || isOrganizerOfActivity;
}

export function assertCanManageActivity(
	actor: Actor,
	isOrganizerOfActivity: boolean,
): void {
	if (!canManageActivity(actor, isOrganizerOfActivity)) {
		throw new AccessDeniedError("仅活动组织者或管理员可操作此活动");
	}
}
