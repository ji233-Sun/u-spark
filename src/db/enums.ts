import { pgEnum } from "drizzle-orm/pg-core";

// ───────────────────────────────────────────────────────────
// 确定枚举（已由 T01 #1 定稿，可直接使用）
// ───────────────────────────────────────────────────────────
// 注：user.role 由 better-auth 生成为 text 列（additionalFields），不在此用 pgEnum。

// 题型集 —— T01 ③ 定稿：立项表单与问卷共用，文件/图片走独立上传不入题
export const formQuestionType = pgEnum("form_question_type", [
	"text", // 单行文本
	"textarea", // 多行文本
	"single", // 单选
	"multi", // 多选
	"rating", // 评分（1–N）
	"date", // 日期
]);

// 表单类型 —— 立项 / 问卷 / 信息补充，三者共用统一表单引擎
export const formType = pgEnum("form_type", [
	"proposal", // 立项表单
	"survey", // 问卷
	"info_supplement", // 信息补充
]);

// ───────────────────────────────────────────────────────────
// ⚠️ 状态枚举占位初稿 —— 待 T03 #3 状态机 SSOT 定稿后对齐
//    旧实现中 project 为「多状态轴」，此处先给单轴占位，T03 时拆分
// ───────────────────────────────────────────────────────────

export const activityStatus = pgEnum("activity_status", [
	"draft", // 草稿（未公开）
	"published", // 已公开
	"canceled", // 已取消（读时派生失效）
]);

export const projectStatus = pgEnum("project_status", [
	"draft",
	"proposal_submitted", // 立项已提交，待审核
	"proposal_approved", // 立项通过
	"proposal_rejected", // 立项被拒
	"manuscript_submitted", // 稿件已提交
	"manuscript_approved", // 稿件通过
	"completed", // 全流程完成
	"withdrawn", // 已撤回
]);

export const manuscriptStatus = pgEnum("manuscript_status", [
	"pending", // 待审核
	"approved", // 通过
	"rejected", // 拒绝
	"revision_requested", // 打回重提
]);

export const paymentStatus = pgEnum("payment_status", [
	"pending", // 待发放
	"paid", // 已发放
]);

export const emailStatus = pgEnum("email_status", [
	"queued", // 排队中
	"sent", // 已发送
	"failed", // 失败
]);
