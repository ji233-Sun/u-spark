import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.ts";
import {
	activityStatus,
	emailStatus,
	formQuestionType,
	formType,
	manuscriptStatus,
	paymentStatus,
	projectStatus,
} from "./enums.ts";

// ───────────────────────────────────────────────────────────
// 统一表单引擎的 JSON 形状（T01 ③：schema 驱动，立项与问卷共用）
// ───────────────────────────────────────────────────────────

/** 单条题目定义（存于 form.schema / preset_question） */
export type FormQuestion = {
	id: string;
	type: (typeof formQuestionType.enumValues)[number];
	label: string;
	required: boolean;
	options?: string[]; // single / multi
	ratingMax?: number; // rating
};

/** 一份作答（题目 id → 答案），存于 project.proposalAnswers / form_response.answers */
export type FormAnswers = Record<string, string | string[] | number>;

// 时间戳工厂（DRY：统一 created_at / updated_at 列定义）
const createdAt = () =>
	timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ───────────────────────────────────────────────────────────
// 活动 & 组织者
// ───────────────────────────────────────────────────────────

export const activity = pgTable(
	"activity",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		title: text("title").notNull(),
		description: text("description"),
		coverImageUrl: text("cover_image_url"),
		status: activityStatus("status").notNull().default("draft"),
		// 时间体系（T01 ①）：三类 DDL 为权威字段；活动结束时间 = max(三类 DDL)，派生不落库
		startAt: timestamp("start_at", { withTimezone: true }).notNull(), // 活动公开 / 立项开放
		proposalDeadline: timestamp("proposal_deadline", {
			withTimezone: true,
		}).notNull(),
		submissionDeadline: timestamp("submission_deadline", {
			withTimezone: true,
		}).notNull(),
		infoSupplementDeadline: timestamp("info_supplement_deadline", {
			withTimezone: true,
		}).notNull(),
		canceledAt: timestamp("canceled_at", { withTimezone: true }), // 取消 → 读时派生失效
		createdBy: text("created_by").references(() => user.id),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		// 单调递增（T01 ①）：开始 ≤ 立项 ≤ 稿件 ≤ 信息补充
		check(
			"activity_deadline_order",
			sql`${t.startAt} <= ${t.proposalDeadline} AND ${t.proposalDeadline} <= ${t.submissionDeadline} AND ${t.submissionDeadline} <= ${t.infoSupplementDeadline}`,
		),
	],
);

// 组织者指派（活动 × 用户，多对多）
export const activityOrganizer = pgTable(
	"activity_organizer",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		activityId: uuid("activity_id")
			.notNull()
			.references(() => activity.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		assignedBy: text("assigned_by").references(() => user.id),
		createdAt: createdAt(),
	},
	(t) => [unique("activity_organizer_uq").on(t.activityId, t.userId)],
);

// ───────────────────────────────────────────────────────────
// 统一表单引擎（T01 ③：立项 / 问卷 / 信息补充共用）
// ───────────────────────────────────────────────────────────

export const form = pgTable("form", {
	id: uuid("id").defaultRandom().primaryKey(),
	activityId: uuid("activity_id")
		.notNull()
		.references(() => activity.id, { onDelete: "cascade" }),
	type: formType("type").notNull(),
	title: text("title").notNull(),
	description: text("description"),
	// 题目定义（schema 驱动，T01 ③）
	schema: jsonb("schema").$type<FormQuestion[]>().notNull().default([]),
	// 问卷可独立开/关；立项表单留空，沿用活动 DDL
	opensAt: timestamp("opens_at", { withTimezone: true }),
	closesAt: timestamp("closes_at", { withTimezone: true }),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

// 预设题库（T28 管理员问题库，可复用插入 form.schema）
export const presetQuestion = pgTable("preset_question", {
	id: uuid("id").defaultRandom().primaryKey(),
	type: formQuestionType("type").notNull(),
	label: text("label").notNull(),
	config: jsonb("config").$type<Pick<FormQuestion, "options" | "ratingMax">>(),
	createdBy: text("created_by").references(() => user.id),
	createdAt: createdAt(),
});

// ───────────────────────────────────────────────────────────
// 立项 & 多作者 & 收件信息
// ───────────────────────────────────────────────────────────

export const project = pgTable("project", {
	id: uuid("id").defaultRandom().primaryKey(),
	activityId: uuid("activity_id")
		.notNull()
		.references(() => activity.id, { onDelete: "cascade" }),
	// 该活动的立项表单（type=proposal），用于校验答案 schema
	proposalFormId: uuid("proposal_form_id").references(() => form.id),
	title: text("title").notNull(),
	status: projectStatus("status").notNull().default("draft"),
	// 立项答案内联（T01 ③：JSON 列，否决 EAV）
	proposalAnswers: jsonb("proposal_answers")
		.$type<FormAnswers>()
		.notNull()
		.default({}),
	// 稿酬（T01 ②）：项目级总额，作者间线下分账，系统不存分配比例
	remunerationAmount: numeric("remuneration_amount", {
		precision: 10,
		scale: 2,
	}),
	// 项目级特批延长（T01 ①）：effective* = max(活动级 DDL, 下列特批)
	specialProposalDeadline: timestamp("special_proposal_deadline", {
		withTimezone: true,
	}),
	specialSubmissionDeadline: timestamp("special_submission_deadline", {
		withTimezone: true,
	}),
	specialInfoSupplementDeadline: timestamp("special_info_supplement_deadline", {
		withTimezone: true,
	}),
	createdBy: text("created_by") // 队长 / 主创
		.notNull()
		.references(() => user.id),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

// 多作者（T01 ②）。userId 可空：外部作者无站内账号时仅留名
export const projectAuthor = pgTable(
	"project_author",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		userId: text("user_id").references(() => user.id),
		displayName: text("display_name").notNull(), // 昵称
		bilibiliUid: text("bilibili_uid"), // B站 UID（选填）
		duty: text("duty"), // 职能（如：导演 / 剪辑 / 后期，选填）
		// 项目级单一收款负责人（T01 ②：稿酬全额打给此人，线下分账）
		isPayee: boolean("is_payee").notNull().default(false),
		createdAt: createdAt(),
	},
	(t) => [unique("project_author_uq").on(t.projectId, t.userId)],
);

// 收件信息（T01 ②：奖品项目级授予，全体作者各自登记，组织者裁量寄送）
export const shippingAddress = pgTable("shipping_address", {
	id: uuid("id").defaultRandom().primaryKey(),
	projectId: uuid("project_id")
		.notNull()
		.references(() => project.id, { onDelete: "cascade" }),
	// 一位作者一条收件信息
	authorId: uuid("author_id")
		.notNull()
		.unique()
		.references(() => projectAuthor.id, { onDelete: "cascade" }),
	recipientName: text("recipient_name").notNull(),
	phone: text("phone").notNull(),
	address: text("address").notNull(),
	note: text("note"),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

// ───────────────────────────────────────────────────────────
// 稿件（含版本）
// ───────────────────────────────────────────────────────────

export const manuscript = pgTable("manuscript", {
	id: uuid("id").defaultRandom().primaryKey(),
	// 一个立项一份稿件主记录
	projectId: uuid("project_id")
		.notNull()
		.unique()
		.references(() => project.id, { onDelete: "cascade" }),
	status: manuscriptStatus("status").notNull().default("pending"),
	currentVersion: integer("current_version").notNull().default(0),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

// 稿件版本（重提子流程 T23 追加新版本）
export const manuscriptVersion = pgTable(
	"manuscript_version",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		manuscriptId: uuid("manuscript_id")
			.notNull()
			.references(() => manuscript.id, { onDelete: "cascade" }),
		version: integer("version").notNull(),
		// 稿件封面图（T19，存储 key，私有签名访问见 /files）
		coverImageUrl: text("cover_image_url"),
		// 网盘链接 + 提取码（读聚合时按角色剥离）
		driveLink: text("drive_link"),
		extractCode: text("extract_code"),
		note: text("note"),
		// 每版本独立审核状态（T20/T23：重提副本独立审核、版本可追溯）
		status: manuscriptStatus("status").notNull().default("pending"),
		reviewReason: text("review_reason"), // 拒绝 / 打回理由，对用户可见
		reviewedBy: text("reviewed_by").references(() => user.id),
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
		submittedBy: text("submitted_by").references(() => user.id),
		submittedAt: timestamp("submitted_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [unique("manuscript_version_uq").on(t.manuscriptId, t.version)],
);

// ───────────────────────────────────────────────────────────
// 收款码 & 稿酬（T01 ②）
// ───────────────────────────────────────────────────────────

// 项目级单一收款码（T01 ②）→ 一个项目至多一条
export const paymentCode = pgTable("payment_code", {
	id: uuid("id").defaultRandom().primaryKey(),
	projectId: uuid("project_id")
		.notNull()
		.unique()
		.references(() => project.id, { onDelete: "cascade" }),
	imageUrl: text("image_url").notNull(),
	payeeName: text("payee_name"),
	uploadedBy: text("uploaded_by").references(() => user.id),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

// 稿酬发放（T01 ②：只录总额 + 发放状态，不拆分到作者）
export const payment = pgTable("payment", {
	id: uuid("id").defaultRandom().primaryKey(),
	projectId: uuid("project_id")
		.notNull()
		.unique()
		.references(() => project.id, { onDelete: "cascade" }),
	amount: numeric("amount", { precision: 10, scale: 2 }).notNull(), // 稿酬总额
	status: paymentStatus("status").notNull().default("pending"),
	paidAt: timestamp("paid_at", { withTimezone: true }),
	operatedBy: text("operated_by").references(() => user.id),
	note: text("note"),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

// ───────────────────────────────────────────────────────────
// 问卷作答（统一引擎，T01 ③）& 邮件日志
// ───────────────────────────────────────────────────────────

// 问卷作答（立项答案不走这里，内联在 project.proposalAnswers）。
// 刻意不设 UNIQUE(form_id, respondent_id)：重复提交视为「修改」，多条按 submittedAt
// 累积构成审计日志，读取时取最新一条为当前答案。
export const formResponse = pgTable("form_response", {
	id: uuid("id").defaultRandom().primaryKey(),
	formId: uuid("form_id")
		.notNull()
		.references(() => form.id, { onDelete: "cascade" }),
	// 填写者（匿名问卷可空）
	respondentId: text("respondent_id").references(() => user.id),
	answers: jsonb("answers").$type<FormAnswers>().notNull().default({}),
	submittedAt: timestamp("submitted_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// 邮件模板覆盖（T28 管理员维护）：按 templateKey 覆盖内置注册表文案，
// 文案用 {placeholder} 占位，发送时按 data 插值；无覆盖则回退内置模板。
export const emailTemplate = pgTable("email_template", {
	id: uuid("id").defaultRandom().primaryKey(),
	templateKey: text("template_key").notNull().unique(),
	subject: text("subject").notNull(),
	body: text("body").notNull(),
	updatedBy: text("updated_by").references(() => user.id),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const emailLog = pgTable("email_log", {
	id: uuid("id").defaultRandom().primaryKey(),
	toEmail: text("to_email").notNull(),
	template: text("template").notNull(),
	subject: text("subject"),
	status: emailStatus("status").notNull().default("queued"),
	error: text("error"),
	activityId: uuid("activity_id").references(() => activity.id, {
		onDelete: "set null",
	}),
	projectId: uuid("project_id").references(() => project.id, {
		onDelete: "set null",
	}),
	sentAt: timestamp("sent_at", { withTimezone: true }),
	createdAt: createdAt(),
});
