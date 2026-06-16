import type { ProjectStatus } from "./state-machine.ts";

// 多作者 / 收件信息领域 SSOT（T21）：纯函数校验 + 管理窗口判定，零 DB 依赖。

export type AuthorErrors = Record<string, string>;

function str(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export type AuthorInput = {
	displayName?: unknown;
	bilibiliUid?: unknown;
	duty?: unknown;
};

export function validateAuthorInput(input: AuthorInput): AuthorErrors {
	const errors: AuthorErrors = {};
	const name = str(input.displayName);
	if (!name) {
		errors.displayName = "作者昵称为必填项。";
	} else if (name.length > 50) {
		errors.displayName = "昵称过长（最多 50 字）。";
	}
	const uid = str(input.bilibiliUid);
	if (!uid) {
		errors.bilibiliUid = "B站 UID 为必填项。";
	} else if (!/^\d{1,15}$/.test(uid)) {
		errors.bilibiliUid = "B站 UID 应为纯数字。";
	}
	const duty = str(input.duty);
	if (!duty) {
		errors.duty = "职能为必填项。";
	} else if (duty.length > 50) {
		errors.duty = "职能描述过长（最多 50 字）。";
	}
	return errors;
}

export type ShippingInput = {
	recipientName?: unknown;
	phone?: unknown;
	address?: unknown;
};

export function validateShippingAddress(input: ShippingInput): AuthorErrors {
	const errors: AuthorErrors = {};
	if (!str(input.recipientName)) {
		errors.recipientName = "收件人为必填项。";
	}
	const phone = str(input.phone);
	if (!phone) {
		errors.phone = "联系电话为必填项。";
	} else if (!/^[0-9+\-\s]{5,20}$/.test(phone)) {
		errors.phone = "联系电话格式不正确。";
	}
	if (!str(input.address)) {
		errors.address = "收货地址为必填项。";
	}
	return errors;
}

// 作者增删改窗口：信息补充 DDL 前、且项目未撤回方可操作（T21：DDL 后入口关闭）。
export function canManageAuthors(
	projectStatus: ProjectStatus,
	infoDeadlinePassed: boolean,
): boolean {
	return projectStatus !== "withdrawn" && !infoDeadlinePassed;
}

export function hasAuthorErrors(errors: AuthorErrors): boolean {
	return Object.keys(errors).length > 0;
}
