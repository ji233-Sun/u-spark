# U-Spark

U-Spark 是面向视频类庆典企划的征稿协作平台，覆盖「立项 → 投稿 → 审核 → 信息补充 → 稿酬/奖品发放」全流程。它同时服务组织者和作者：组织者配置活动、审核立项/稿件、导出数据；作者在线提交立项、上传稿件、补充作者/收货/收款信息。

## 功能概览

- 活动管理：管理员创建活动，配置立项表单、投稿规则、截止时间和组织者。
- 立项申报：作者提交企划立项，组织者审核通过或退回，并保留状态流转记录。
- 稿件管理：立项通过后上传稿件，组织者审核、退回修改或确认通过。
- 信息补充：稿件通过后收集作者信息、收货信息、收款码等后续发放资料。
- 稿酬发放：组织者核定稿酬/奖品信息，生成导出清单。
- 问卷系统：组织者可配置活动问卷，用户提交后支持导出。
- 邮件通知：验证码、魔法链接、密码重置、状态通知、DDL 提醒统一走邮件模板与日志。
- 鉴权与权限：Better Auth 登录体系；全局角色只有 `user` / `admin`，活动组织者是 `user × activity` 的数据级关系。

## 技术栈

- TanStack Start + TanStack Router 文件式路由
- React 19 + Tailwind CSS + shadcn/ui 风格组件
- Drizzle ORM + PostgreSQL
- Better Auth
- Vite + Nitro Node server
- Biome + Vitest + pnpm
- Nodemailer SMTP 邮件外发

## 快速开始

```bash
pnpm install
docker compose up -d --wait
# 按下方“环境变量”小节创建 .env.local
pnpm db:migrate
pnpm dev
```

开发服务器默认运行在 `http://localhost:3000`。如果端口被占用，Vite 会自动尝试下一个端口。

## 环境变量

本地配置放在 `.env.local`，该文件被 `.gitignore` 忽略，不要提交真实密钥。

```bash
# PostgreSQL
DATABASE_URL="postgresql://uspark:uspark@localhost:5432/uspark"

# Better Auth
BETTER_AUTH_SECRET="replace-with-generated-secret"
BETTER_AUTH_URL="http://localhost:3000"

# SMTP 邮件外发（不配置时邮件只打印到服务端控制台）
SMTP_HOST="smtp.example.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="your@email.com"
SMTP_PASS="your-smtp-app-password"
SMTP_FROM="U-Spark <your@email.com>"
SMTP_REPLY_TO="reply-to@email.com"
```

生成 `BETTER_AUTH_SECRET`：

```bash
pnpm dlx @better-auth/cli secret
```

`SMTP_PASS` 通常是邮箱服务商提供的 SMTP 授权码或应用专用密码，不是邮箱登录密码。

## 常用命令

```bash
pnpm dev                 # 开发服务器
pnpm build               # 生产构建，输出到 dist/
pnpm preview             # 预览生产构建
pnpm check               # Biome lint + format 检查
pnpm lint                # Biome lint
pnpm format              # Biome format 检查
pnpm test                # Vitest 全量测试一次
pnpm generate-routes     # 手动生成 src/routeTree.gen.ts
```

类型检查：

```bash
pnpm exec tsc --noEmit
```

当前脚手架相关文件可能仍有既有 unused-import 报错，修业务代码时请区分是否由本次改动引入。

## 数据库

本地 PostgreSQL 由 `docker-compose.yml` 提供：

```bash
docker compose up -d --wait
docker compose down
docker compose down -v # 清空本地数据库卷
```

Drizzle 命令：

```bash
pnpm db:generate # 根据 src/db/*.ts 生成迁移
pnpm db:migrate  # 应用 drizzle/ 下的迁移
pnpm db:push     # 开发期直接推 schema，谨慎使用
pnpm db:pull     # 从数据库反向拉取 schema
pnpm db:studio   # 打开 Drizzle Studio
```

Schema 入口是 `src/db/schema.ts`，它统一 re-export：

- `src/db/enums.ts`：业务状态、题型、邮件状态等枚举。
- `src/db/auth-schema.ts`：Better Auth 用户/会话/账号/验证表，由 CLI 生成，不手写维护。
- `src/db/celebration-schema.ts`：活动、立项、稿件、问卷、作者、付款、邮件模板/日志等业务表。

修改数据库 schema 后，优先使用 `pnpm db:generate` 生成增量迁移，不要手改已提交迁移。

## 邮件

邮件统一入口是 `src/lib/email/index.ts`。默认使用 `consoleProvider`，适合本地开发；配置 `SMTP_HOST`、`SMTP_USER`、`SMTP_PASS` 后会自动启用 SMTP 外发。

邮件模板在 `src/lib/email/templates.ts`，管理员也可以通过数据库里的 `email_template` 覆盖模板。所有发送都会写入 `email_log`，并经过同一收件人的限频保护。

当前接入的发送场景包括：

- 注册/验证邮箱验证码
- 魔法链接登录
- 密码重置
- 立项提交回执与审核结果
- 稿件审核结果
- 稿酬核定通知
- DDL 提醒

## 文件与图片上传

上传入口在 `src/routes/api/uploads.ts`，底层抽象在 `src/lib/storage/`：

- `provider.ts`：存储 Provider 抽象，默认内存实现用于开发。
- `validation.ts`：图片类型、大小等校验。
- `signing.ts`：文件访问签名。
- `server-url.ts`：服务端 URL 生成。

资源级越权防护由具体业务接口负责，例如稿件提交、收款码上传等。

## 架构约定

核心业务逻辑位于 `src/lib/celebration/`，尽量保持为可单测的纯函数：

- `state-machine.ts`：立项/稿件状态机 SSOT，包含状态转换、邮件映射、DDL 判断。
- `access.ts`：RBAC 与活动级权限纯逻辑。
- `server-guards.ts`：TanStack Start middleware 与数据级权限集成。
- `labels.ts`：状态中文标签与语义色调。
- `form-engine.ts`、`proposal.ts`、`manuscript.ts`、`payment.ts`、`survey.ts` 等：各业务域纯逻辑。

Server function 和 API route 必须自己挂鉴权/权限检查。路由 `beforeLoad` 只保护页面跳转，不保护直接请求。

推荐模式：

```ts
createServerFn()
	.middleware([authedMiddleware])
	.handler(async ({ context, data }) => {
		await requireActivityManager(context.actor, data.activityId);
		// 业务逻辑
	});
```

## 路由与页面

路由文件位于 `src/routes/`：

- `/`：首页
- `/auth`：登录、注册、魔法链接、验证码
- `/activities`、`/activities/$activityId`：活动列表与详情
- `/activities/$activityId/proposal`：立项申报
- `/my/proposals`：我的立项/投稿进度
- `/projects/$projectId/manuscript`：稿件提交
- `/projects/$projectId/authors`：作者信息补充
- `/projects/$projectId/payment`：收款码上传
- `/organizer/*`：组织者活动、立项、稿件、问卷、付款、导出管理
- `/admin`：管理员后台
- `/api/*`：业务 API

`src/routeTree.gen.ts` 由 TanStack Router 生成，通常不手动编辑。

## UI 与样式

- 全局样式在 `src/styles.css`。
- 组件库在 `src/components/ui/`。
- 页面布局在 `src/components/app-frame.tsx` 和 `src/components/app-sidebar.tsx`。
- 业务状态组件包括 `StatusBadge`、`Timeline` 等。

新页面优先复用现有 CSS 变量和 UI 组件。项目仍有一层 `.demo-*` 旧样式兼容层，逐页重写后可清理。

## 测试

```bash
pnpm test
pnpm exec vitest
pnpm exec vitest run src/lib/celebration
pnpm exec vitest run -t "状态机"
```

Vitest 配置在 `vitest.config.ts`，刻意不继承 `vite.config.ts`，避免 TanStack Start/Nitro/Vite React 插件污染纯函数测试环境。默认测试环境是 `node`；组件测试需要在文件顶部声明：

```ts
// @vitest-environment jsdom
```

## 构建与部署

生产构建：

```bash
pnpm build
```

构建结果输出到 `dist/`，Nitro 会生成可运行的 Node server。部署时需要提供生产环境变量：

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- SMTP 相关变量（如果需要真实发信）

运行方式取决于目标平台；普通 Node 环境可使用构建产物中的 server 入口。

## 代码规范

- 包管理器使用 pnpm。
- 相对 import 必须带 `.ts` / `.tsx` 后缀；跨目录引用优先用 `#/*`。
- Biome 使用 tab 缩进和双引号。
- 业务相关注释使用中文。
- 数据库迁移只追加新增迁移，不修改已提交迁移。
- `src/db/auth-schema.ts` 由 Better Auth CLI 生成，修改 auth 插件或 additionalFields 后重新生成。
- 新业务判断优先写成 `src/lib/celebration/` 下的纯函数并补测试。

## 常见问题

### 邮件没有发出去

先确认 `.env.local` 是否配置了 `SMTP_HOST`、`SMTP_USER`、`SMTP_PASS`。缺少任一项时系统会回退到 console provider，只在服务端控制台打印邮件内容。

### 数据库连接失败

确认本地容器已启动：

```bash
docker compose up -d --wait
```

并确认 `.env.local` 的 `DATABASE_URL` 与 `docker-compose.yml` 中的账号、密码、库名一致。

### 路由类型不更新

运行：

```bash
pnpm generate-routes
```

或重启 `pnpm dev`。
