import { createFileRoute } from "@tanstack/react-router";
import { and, eq, isNull } from "drizzle-orm";
import { user } from "#/db/auth-schema";
import {
	activity,
	activityOrganizer,
	ddlReminder,
	project,
} from "#/db/celebration-schema";
import { db } from "#/db/index";
import { adminActor } from "#/lib/celebration/admin-guard";
import {
	DEADLINE_NAMES,
	dueDeadlineKinds,
} from "#/lib/celebration/ddl-reminder";
import type { DeadlineKind } from "#/lib/celebration/state-machine";
import { sendMail } from "#/lib/email";

// DDL 临近定时提醒（T29）：由外部 cron 周期调用（携带 CRON_SECRET），或管理员手动触发。
// 扫描进行中活动的三类 DDL，临近窗口内且未提醒过的 → 通知组织者 + 立项创建者，并记账幂等。
export const Route = createFileRoute("/api/cron/ddl-reminders")({
	server: {
		handlers: {
			GET: runReminders,
			POST: runReminders,
		},
	},
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

async function runReminders({ request }: { request: Request }) {
	const url = new URL(request.url);
	const provided =
		url.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
	const secret = process.env.CRON_SECRET;
	const authorized =
		(secret && provided === secret) || (await adminActor(request)) !== null;
	if (!authorized) {
		return Response.json({ ok: false, error: "未授权。" }, { status: 401 });
	}

	const now = new Date();
	// 进行中活动：已公开且未取消。
	const activities = await db
		.select({
			id: activity.id,
			title: activity.title,
			startAt: activity.startAt,
			proposalDeadline: activity.proposalDeadline,
			submissionDeadline: activity.submissionDeadline,
			infoSupplementDeadline: activity.infoSupplementDeadline,
		})
		.from(activity)
		.where(and(eq(activity.status, "published"), isNull(activity.canceledAt)));

	let remindersSent = 0;
	let recipientsNotified = 0;

	for (const act of activities) {
		const dueKinds = dueDeadlineKinds(act, now);
		if (dueKinds.length === 0) continue;

		const deadlines: Record<DeadlineKind, Date> = {
			proposal: act.proposalDeadline,
			submission: act.submissionDeadline,
			info_supplement: act.infoSupplementDeadline,
		};

		for (const kind of dueKinds) {
			// 幂等：插入提醒记录，冲突则说明已提醒过 → 跳过。
			const inserted = await db
				.insert(ddlReminder)
				.values({ activityId: act.id, deadlineKind: kind })
				.onConflictDoNothing()
				.returning({ id: ddlReminder.id });
			if (inserted.length === 0) continue;

			const recipients = await recipientEmails(act.id);
			for (const email of recipients) {
				await sendMail({
					to: email,
					template: "ddl_reminder",
					data: {
						activityTitle: act.title,
						deadlineName: DEADLINE_NAMES[kind],
						deadline: dateFormatter.format(deadlines[kind]),
					},
				});
				recipientsNotified += 1;
			}
			remindersSent += 1;
		}
	}

	return Response.json({
		ok: true,
		activitiesScanned: activities.length,
		remindersSent,
		recipientsNotified,
	});
}

// 提醒对象：活动组织者 + 该活动下立项创建者（去重邮箱）。
async function recipientEmails(activityId: string): Promise<string[]> {
	const organizers = await db
		.select({ email: user.email })
		.from(activityOrganizer)
		.innerJoin(user, eq(user.id, activityOrganizer.userId))
		.where(eq(activityOrganizer.activityId, activityId));
	const creators = await db
		.select({ email: user.email })
		.from(project)
		.innerJoin(user, eq(user.id, project.createdBy))
		.where(eq(project.activityId, activityId));
	return [
		...new Set(
			[...organizers, ...creators].map((r) => r.email).filter(Boolean),
		),
	];
}
