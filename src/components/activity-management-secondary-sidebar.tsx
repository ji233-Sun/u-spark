import { Link } from "@tanstack/react-router";
import {
	ClipboardList,
	FileCog,
	type LucideIcon,
	Settings2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "#/lib/utils";

type ActivityNavItem = {
	href: string;
	label: string;
	description: string;
	icon: LucideIcon;
};

const ACTIVITY_NAV: ActivityNavItem[] = [
	{
		href: "#activity-projects",
		label: "项目总览",
		description: "立项与稿件状态",
		icon: ClipboardList,
	},
	{
		href: "#activity-basics",
		label: "基础信息",
		description: "活动信息与截止时间",
		icon: Settings2,
	},
	{
		href: "#activity-form",
		label: "立项表单",
		description: "自定义立项题目",
		icon: FileCog,
	},
];

export function ActivityManagementSecondarySidebar() {
	const [activeHref, setActiveHref] = useState("#activity-projects");

	useEffect(() => {
		const syncHash = () => {
			setActiveHref(window.location.hash || "#activity-projects");
		};
		syncHash();
		window.addEventListener("hashchange", syncHash);
		return () => window.removeEventListener("hashchange", syncHash);
	}, []);

	return (
		<aside className="hidden w-60 shrink-0 self-stretch border-r bg-background/95 xl:w-64 lg:block">
			<div className="sticky top-0 flex max-h-svh min-h-0 flex-col">
				<div className="border-b px-5 py-4">
					<p className="m-0 text-xs font-medium text-muted-foreground">
						活动管理
					</p>
					<h2 className="m-0 mt-1 text-base font-semibold text-foreground">
						活动导航
					</h2>
				</div>
				<nav className="flex-1 space-y-1 overflow-y-auto p-3">
					{ACTIVITY_NAV.map((item) => (
						<a
							key={item.href}
							href={item.href}
							aria-current={activeHref === item.href ? "page" : undefined}
							className={cn(
								"group flex items-start gap-3 rounded-md px-3 py-2.5 text-sm text-foreground no-underline transition hover:bg-muted",
								activeHref === item.href && "bg-muted font-medium",
							)}
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
				<div className="border-t p-3">
					<Link
						to="/organizer/activities"
						className="block rounded-md px-3 py-2 text-sm text-muted-foreground no-underline transition hover:bg-muted hover:text-foreground"
					>
						返回活动列表
					</Link>
				</div>
			</div>
		</aside>
	);
}
