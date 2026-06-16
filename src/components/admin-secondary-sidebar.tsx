import {
	AlarmClock,
	CalendarRange,
	FileQuestion,
	type LucideIcon,
	Mail,
	Users,
} from "lucide-react";

type AdminNavItem = {
	href: string;
	label: string;
	description: string;
	icon: LucideIcon;
};

const ADMIN_NAV: AdminNavItem[] = [
	{
		href: "#admin-activities",
		label: "活动与组织者",
		description: "活动创建、组织者指派",
		icon: CalendarRange,
	},
	{
		href: "#admin-presets",
		label: "预设问题库",
		description: "表单题目模板",
		icon: FileQuestion,
	},
	{
		href: "#admin-email-templates",
		label: "邮件模板",
		description: "系统邮件文案",
		icon: Mail,
	},
	{
		href: "#admin-users",
		label: "用户管理",
		description: "角色与权限",
		icon: Users,
	},
	{
		href: "#admin-reminders",
		label: "DDL 提醒",
		description: "手动触发提醒任务",
		icon: AlarmClock,
	},
];

export function AdminSecondarySidebar() {
	return (
		<aside className="hidden h-svh w-64 shrink-0 border-r bg-background/95 lg:block">
			<div className="sticky top-0 flex h-svh flex-col">
				<div className="border-b px-5 py-4">
					<p className="m-0 text-xs font-medium text-muted-foreground">
						管理后台
					</p>
					<h2 className="m-0 mt-1 text-base font-semibold text-foreground">
						后台导航
					</h2>
				</div>
				<nav className="flex-1 space-y-1 overflow-y-auto p-3">
					{ADMIN_NAV.map((item) => (
						<a
							key={item.href}
							href={item.href}
							className="group flex items-start gap-3 rounded-md px-3 py-2.5 text-sm text-foreground no-underline transition hover:bg-muted"
						>
							<item.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
							<span className="min-w-0">
								<span className="block font-medium leading-5">
									{item.label}
								</span>
								<span className="block truncate text-xs leading-5 text-muted-foreground">
									{item.description}
								</span>
							</span>
						</a>
					))}
				</nav>
			</div>
		</aside>
	);
}
