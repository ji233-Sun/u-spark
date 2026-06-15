import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// 统一出口：枚举 + Better Auth 表 + 庆典投稿业务表
// （drizzle.config.ts 与 db/index.ts 均以本文件为 schema 入口）
export * from "./enums.ts";
export * from "./auth-schema.ts";
export * from "./celebration-schema.ts";

// demo 用表（src/routes/demo/drizzle.tsx），可随 demo 一并删除
export const todos = pgTable("todos", {
	id: serial().primaryKey(),
	title: text().notNull(),
	createdAt: timestamp("created_at").defaultNow(),
});
