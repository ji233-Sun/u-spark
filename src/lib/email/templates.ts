// 邮件模板注册表（T05 #5）：template key → 文案渲染。实现「模板与触发点解耦」——
// 触发点（状态机 / 认证流程）只给 key + data，文案集中在此维护。
// 状态流转类 key 与 src/lib/celebration/state-machine.ts 的 *_NOTIFICATIONS 对齐。
export type EmailTemplateData = Record<string, string | number | undefined>;
export type RenderedEmail = { subject: string; body: string };
type TemplateFn = (data: EmailTemplateData) => RenderedEmail;

const TEMPLATES = {
	// ── 认证类 ──
	verify_otp: (d) => ({
		subject: "【U-Spark】邮箱验证码",
		body: `你的验证码是 ${d.code}，5 分钟内有效。若非本人操作请忽略。`,
	}),
	reset_password: (d) => ({
		subject: "【U-Spark】重置密码",
		body: `点击链接重置密码（24 小时内有效）：${d.url}`,
	}),
	magic_link: (d) => ({
		subject: "【U-Spark】登录链接",
		body: `点击登录（5 分钟内有效）：${d.url}`,
	}),
	// ── 状态流转类（对齐 state-machine 的 template key）──
	proposal_submitted: (d) => ({
		subject: "【U-Spark】新立项待审核",
		body: `项目「${d.projectTitle}」已提交立项，请前往后台审核。`,
	}),
	proposal_receipt: (d) => ({
		subject: "【U-Spark】立项提交回执",
		body: `你已完成「${d.activityTitle}」的立项填写，项目「${d.projectTitle}」已进入审核队列。`,
	}),
	proposal_approved: (d) => ({
		subject: "【U-Spark】立项通过",
		body: `你的项目「${d.projectTitle}」立项已通过，可开始投稿。`,
	}),
	proposal_rejected: (d) => ({
		subject: "【U-Spark】立项未通过",
		body: `你的项目「${d.projectTitle}」立项被退回：${d.reason ?? "（无说明）"}。可修改后重新提交。`,
	}),
	manuscript_submitted: (d) => ({
		subject: "【U-Spark】新稿件待审核",
		body: `项目「${d.projectTitle}」已提交稿件，请前往后台审核。`,
	}),
	manuscript_approved: (d) => ({
		subject: "【U-Spark】稿件通过",
		body: `你的项目「${d.projectTitle}」稿件已通过。`,
	}),
	manuscript_rejected: (d) => ({
		subject: "【U-Spark】稿件被拒",
		body: `你的项目「${d.projectTitle}」稿件被拒：${d.reason ?? "（无说明）"}。`,
	}),
	manuscript_revision_requested: (d) => ({
		subject: "【U-Spark】稿件需修改",
		body: `你的项目「${d.projectTitle}」稿件被打回，请修改后重新提交：${d.reason ?? ""}`,
	}),
	info_supplement_requested: (d) => ({
		subject: "【U-Spark】请补充信息",
		body: `请为项目「${d.projectTitle}」补充收款码 / 收件信息。`,
	}),
	project_completed: (d) => ({
		subject: "【U-Spark】流程完成",
		body: `恭喜！项目「${d.projectTitle}」全流程已完成。`,
	}),
	// ── 稿酬类（T25 稿酬分配）──
	remuneration_assigned: (d) => ({
		subject: "【U-Spark】稿酬已核定",
		body: `你的项目「${d.projectTitle}」已核定稿酬 ${d.amount} 元，请在信息补充阶段上传收款码。`,
	}),
	// ── 提醒类（T29 DDL 提醒）──
	ddl_reminder: (d) => ({
		subject: "【U-Spark】截止提醒",
		body: `「${d.activityTitle}」的${d.deadlineName}将于 ${d.deadline} 截止，请及时处理。`,
	}),
} satisfies Record<string, TemplateFn>;

export type EmailTemplate = keyof typeof TEMPLATES;

export function renderTemplate(
	template: EmailTemplate,
	data: EmailTemplateData,
): RenderedEmail {
	return TEMPLATES[template](data);
}

export function isKnownTemplate(key: string): key is EmailTemplate {
	return key in TEMPLATES;
}
