import { describe, expect, it } from "vitest";
import {
	AccessDeniedError,
	type Actor,
	assertCanManageActivity,
	canManageActivity,
	isAdmin,
	requireAdmin,
	requireUser,
	UnauthenticatedError,
} from "./access.ts";

const user: Actor = { userId: "u1", role: "user" };
const admin: Actor = { userId: "a1", role: "admin" };

describe("全局角色守卫", () => {
	it("isAdmin 区分角色", () => {
		expect(isAdmin(admin)).toBe(true);
		expect(isAdmin(user)).toBe(false);
	});

	it("requireUser：未登录抛 UnauthenticatedError", () => {
		expect(() => requireUser(null)).toThrow(UnauthenticatedError);
		expect(() => requireUser(undefined)).toThrow(UnauthenticatedError);
		expect(requireUser(user)).toBe(user);
	});

	it("requireAdmin：普通用户越权被拒、未登录被拒", () => {
		expect(() => requireAdmin(user)).toThrow(AccessDeniedError);
		expect(() => requireAdmin(null)).toThrow(UnauthenticatedError);
		expect(requireAdmin(admin)).toBe(admin);
	});
});

describe("数据级：组织者只能管理自己负责的活动", () => {
	it("admin 可管理任意活动（即便非组织者）", () => {
		expect(canManageActivity(admin, false)).toBe(true);
	});

	it("组织者可管理自己负责的活动", () => {
		expect(canManageActivity(user, true)).toBe(true);
	});

	it("非组织者跨活动访问被阻断", () => {
		expect(canManageActivity(user, false)).toBe(false);
		expect(() => assertCanManageActivity(user, false)).toThrow(
			AccessDeniedError,
		);
	});

	it("assert 放行合法访问", () => {
		expect(() => assertCanManageActivity(user, true)).not.toThrow();
		expect(() => assertCanManageActivity(admin, false)).not.toThrow();
	});
});
