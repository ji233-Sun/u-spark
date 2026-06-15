# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

U-Spark 是面向视频类庆典企划的征稿平台（立项 → 投稿 → 审核 → 信息补充 → 稿酬/奖品发放全流程）。技术栈：TanStack Start（全栈 React）+ TanStack Router（文件式路由）+ Drizzle ORM（PostgreSQL）+ Better Auth + Vite + Biome + Vitest + pnpm。

## 常用命令

```bash
pnpm dev                 # 开发服务器（:3000）
pnpm build               # 生产构建（Nitro，输出自包含 Node server 到 dist/）
pnpm check               # Biome lint + format 一把过（提交前跑）
pnpm lint / pnpm format  # 仅 lint / 仅 format

# 测试（Vitest）
pnpm test                          # 全部测试一次
pnpm exec vitest                   # watch 模式
pnpm exec vitest run <路径>         # 单文件/目录
pnpm exec vitest run -t "<用例名>"  # 按 it/describe 名过滤

# 数据库（Drizzle）—— 改了 src/db/*.ts 后：
docker compose up -d --wait        # 起本地 Postgres（postgres:17，见 docker-compose.yml）
pnpm db:generate                   # 据 schema 生成迁移到 drizzle/
pnpm db:migrate                    # 应用迁移（读 .env.local 的 DATABASE_URL）
pnpm db:studio                     # 可视化浏览

pnpm generate-routes               # 手动重生成 src/routeTree.gen.ts（通常 dev 自动）
```

类型检查用 `pnpm exec tsc --noEmit`（注意：`src/router.tsx` 等脚手架文件可能有预存的 unused-import 报错，与新代码无关）。

## 架构

### 数据库 schema 是分层 re-export 的
`src/db/schema.ts` 是唯一入口（`drizzle.config.ts` 与 `src/db/index.ts` 都指向它），它 re-export 三个文件：
- `enums.ts` — 所有 `pgEnum`（状态机/题型的**枚举值 SSOT**）。
- `auth-schema.ts` — Better Auth 的 user/session/account/verification。**由 CLI 生成，勿手写**：改了 `src/lib/auth.ts` 的插件/additionalFields 后，跑 `pnpm dlx @better-auth/cli generate --output src/db/auth-schema.ts -y` 重新生成。`user.role` 是 text 列（非 enum）。
- `celebration-schema.ts` — 业务表（activity/project/manuscript/form/payment 等），外键引用 `auth-schema` 的 `user`。

迁移基线在 `drizzle/`。schema 变更必须走 `db:generate` 生成增量迁移，不要手改已提交的迁移文件。

### 领域逻辑是「纯函数 SSOT + 薄集成层」
`src/lib/celebration/` 是核心领域层，刻意把**可单测的纯逻辑**与**框架/DB 集成**分开：
- `state-machine.ts` — 立项/稿件状态机 SSOT：转换表 `PROJECT_TRANSITIONS`/`MANUSCRIPT_TRANSITIONS`、`canTransition`/`assertTransition`、状态→邮件映射、DDL 守卫（`effectiveDeadline` = max(活动级, 项目级特批)）。状态类型用 `satisfies Record<...>` 绑定到 `enums.ts` 的 `.enumValues`，新增状态忘了更新转换表会编译报错。
- `access.ts` — RBAC 纯逻辑（`Actor`/`requireUser`/`requireAdmin`/`canManageActivity`）。**「组织者」不是全局角色**，而是 `user × activity` 的数据级关系（查 `activity_organizer`）；全局角色只有 `user`/`admin`。
- `server-guards.ts` — TanStack 集成层：`actorMiddleware`/`authedMiddleware`/`adminMiddleware` + 数据级 `requireActivityManager`。
- `labels.ts` — 状态→中文标签 + 语义色调（纯映射，UI 层用）。

新功能优先把判定逻辑写成 `lib/celebration/` 的纯函数并单测，DB/请求只在集成层碰。

### 基础设施走 provider 抽象（DIP）
`src/lib/email/` 和 `src/lib/storage/` 都是「接口 + dev 默认实现 + 可注入生产实现」：dev 用 `consoleProvider`/`MemoryStorageProvider`，生产用 `setMailProvider`/`setStorageProvider` 换 SMTP/S3。`email/index.ts` 的 `sendMail` 与 `storage/index.ts` 的 `uploadImage` 是统一入口；校验/限频/签名都是纯函数。

### Server function 鉴权约定
Server function 必须**自己挂** middleware —— 路由 `beforeLoad` 重定向**不**保护对 server function 的直接 POST。模式：
```ts
createServerFn().middleware([authedMiddleware]).handler(async ({ context, data }) => {
  await requireActivityManager(context.actor, data.activityId) // 数据级越权防护
})
```

## 关键约定（非显然，容易踩坑）

- **相对 import 必须带 `.ts`/`.tsx` 后缀**（`tsconfig` 开了 `verbatimModuleSyntax` + `allowImportingTsExtensions`）。跨目录引用用路径别名 `#/*`（= `src/*`，`@/*` 同义）；目录内用相对路径 + 后缀。
- **Biome 用 tab 缩进 + 双引号**，只处理 `src/**` 和 `vite.config.ts`（忽略 `routeTree.gen.ts`/`styles.css`）。写完跑 `pnpm check`，让 Biome 修格式，不要手抠缩进。
- **测试配置 `vitest.config.ts` 故意独立于 `vite.config.ts`**：绝不能让单测继承 `tanstackStart`/`nitro`/`viteReact` 这些全栈插件——它们会导致 `react/index.js` 报 `module is not defined` 且 Vite server 无法退出。默认 `node` 环境（纯函数测试，**不需要起 docker/db**）；需要 DOM 的组件测试在文件首行加 `// @vitest-environment jsdom`，用 `@testing-library/react`（已开 `globals: true` 自动 cleanup）。
- **UI 复用现有设计系统**：`src/styles.css` 定义了一套 CSS 变量（`--sea-ink`/`--lagoon`/`--line`/`--surface` 等，含 dark mode）。新组件用这些变量 + Tailwind，别引入新色板。`src/components/ui/` 是组件库，`StatusBadge`/`Timeline` 直接对接状态机枚举。
- **业务相关注释用中文**（与代码库一致），commit message 用 `feat:`/`fix:` 前缀 + 中文要点。
- `.env.local` 被 `.gitignore`（`*.local`）忽略，含 `DATABASE_URL`/`BETTER_AUTH_SECRET`，不入库。
