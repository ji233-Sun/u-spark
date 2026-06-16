import { Link, useRouterState } from "@tanstack/react-router";
import {
	CalendarRange,
	ClipboardCheck,
	ClipboardList,
	Download,
	Files,
	FileText,
	LayoutDashboard,
	type LucideIcon,
	ShieldCheck,
	SlidersHorizontal,
	Sparkles,
	Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "#/components/ui/sidebar";
import { authClient } from "#/lib/auth-client";

type NavItem = { to: string; label: string; icon: LucideIcon };

const MAIN: NavItem[] = [
	{ to: "/dashboard", label: "概览", icon: LayoutDashboard },
	{ to: "/activities", label: "浏览活动", icon: CalendarRange },
	{ to: "/my/proposals", label: "我的投稿", icon: FileText },
];

const ORGANIZER: NavItem[] = [
	{ to: "/organizer/activities", label: "活动管理", icon: SlidersHorizontal },
	{ to: "/organizer/proposals", label: "立项审核", icon: ClipboardCheck },
	{ to: "/organizer/manuscripts", label: "稿件管理", icon: Files },
	{ to: "/organizer/payments", label: "收款管理", icon: Wallet },
	{ to: "/organizer/surveys", label: "问卷管理", icon: ClipboardList },
	{ to: "/organizer/export", label: "数据导出", icon: Download },
];

const ADMIN: NavItem[] = [
	{ to: "/admin", label: "管理后台", icon: ShieldCheck },
];

function useActivePath() {
	return useRouterState({ select: (s) => s.location.pathname });
}

function NavGroup({
	label,
	items,
	pathname,
}: {
	label: string;
	items: NavItem[];
	pathname: string;
}) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>{label}</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{items.map((item) => {
						const active =
							pathname === item.to || pathname.startsWith(`${item.to}/`);
						return (
							<SidebarMenuItem key={item.to}>
								<SidebarMenuButton
									asChild
									isActive={active}
									tooltip={item.label}
								>
									<Link to={item.to}>
										<item.icon />
										<span>{item.label}</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

export function AppSidebar() {
	const pathname = useActivePath();
	const { data: session, isPending } = authClient.useSession();
	const role = (session?.user as { role?: string } | undefined)?.role;
	const isAdmin = role === "admin";
	const [showOrganizer, setShowOrganizer] = useState(false);

	useEffect(() => {
		if (isPending || !session?.user) return;
		if (isAdmin) {
			setShowOrganizer(true);
			return;
		}
		let cancelled = false;
		void fetch("/api/organizer/activities")
			.then(async (res) => {
				if (!res.ok) return;
				const json = (await res.json()) as {
					ok?: boolean;
					activities?: unknown[];
				};
				if (
					!cancelled &&
					json?.ok &&
					Array.isArray(json.activities) &&
					json.activities.length > 0
				) {
					setShowOrganizer(true);
				}
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [isPending, session?.user, isAdmin]);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild size="lg" tooltip="U-Spark">
							<Link to="/dashboard">
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
									<Sparkles className="size-4" />
								</div>
								<div className="grid flex-1 text-left leading-tight">
									<span className="truncate font-semibold">U-Spark</span>
									<span className="truncate text-xs text-muted-foreground">
										征稿协作平台
									</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<NavGroup label="主菜单" items={MAIN} pathname={pathname} />
				{showOrganizer && (
					<NavGroup label="组织者" items={ORGANIZER} pathname={pathname} />
				)}
				{isAdmin && <NavGroup label="管理" items={ADMIN} pathname={pathname} />}
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							isActive={pathname === "/account"}
							tooltip={session?.user?.name ?? "账号"}
						>
							<Link to="/account">
								<div className="flex aspect-square size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
									{session?.user?.name?.charAt(0).toUpperCase() ?? "U"}
								</div>
								<span className="truncate">
									{session?.user?.name ?? "账号设置"}
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
