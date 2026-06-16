import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { ActivityManagementSecondarySidebar } from "#/components/activity-management-secondary-sidebar";
import { AdminSecondarySidebar } from "#/components/admin-secondary-sidebar";
import { AppSidebar } from "#/components/app-sidebar";
import ThemeToggle from "#/components/ThemeToggle";
import { Separator } from "#/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "#/components/ui/sidebar";
import BetterAuthHeader from "#/integrations/better-auth/header-user";

// 公开区（顶栏布局，无需登录）：首页 / 登录注册 / 关于 / 问卷填写。
// 其余进入「用户中心」侧边栏布局。
const PUBLIC_PREFIXES = [
	"/auth",
	"/forgot-password",
	"/reset-password",
	"/about",
	"/surveys",
];

function isPublicPath(pathname: string): boolean {
	if (pathname === "/") return true;
	return PUBLIC_PREFIXES.some(
		(p) => pathname === p || pathname.startsWith(`${p}/`),
	);
}

function isAdminPath(pathname: string): boolean {
	return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isOrganizerActivityDetailPath(pathname: string): boolean {
	return /^\/organizer\/activities\/[^/]+$/.test(pathname);
}

const TITLES: Record<string, string> = {
	"/dashboard": "概览",
	"/activities": "浏览活动",
	"/my/proposals": "我的投稿",
	"/account": "账号设置",
	"/projects": "我的立项",
	"/organizer/activities": "活动管理",
	"/organizer/proposals": "立项审核",
	"/organizer/manuscripts": "稿件管理",
	"/organizer/payments": "收款管理",
	"/organizer/surveys": "问卷管理",
	"/organizer/export": "数据导出",
	"/admin": "管理后台",
};

function titleFor(pathname: string): string {
	const hit = Object.keys(TITLES)
		.filter((k) => pathname === k || pathname.startsWith(`${k}/`))
		.sort((a, b) => b.length - a.length)[0];
	return hit ? TITLES[hit] : "U-Spark";
}

function PublicHeader() {
	return (
		<header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
			<div className="page-wrap flex h-14 items-center gap-4">
				<Link
					to="/"
					className="flex items-center gap-2 font-semibold text-foreground no-underline"
				>
					<span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<Sparkles className="size-4" />
					</span>
					U-Spark
				</Link>
				<nav className="ml-2 hidden items-center gap-5 text-sm font-medium sm:flex">
					<Link to="/" className="nav-link">
						首页
					</Link>
					<Link to="/activities" className="nav-link">
						浏览活动
					</Link>
					<Link to="/about" className="nav-link">
						关于
					</Link>
				</nav>
				<div className="ml-auto flex items-center gap-1.5">
					<BetterAuthHeader />
				</div>
			</div>
		</header>
	);
}

function SiteFooter() {
	const year = new Date().getFullYear();
	return (
		<footer className="site-footer mt-auto">
			<div className="page-wrap flex flex-col items-center justify-between gap-2 py-8 text-sm text-muted-foreground sm:flex-row">
				<p className="m-0">© {year} U-Spark · 视频庆典征稿平台</p>
				<p className="m-0">Built with TanStack Start + shadcn/ui</p>
			</div>
		</footer>
	);
}

function DashboardTopbar() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return (
		<header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
			<SidebarTrigger className="-ml-1" />
			<Separator orientation="vertical" className="mr-1 !h-5" />
			<h1 className="text-sm font-semibold">{titleFor(pathname)}</h1>
			<div className="ml-auto flex items-center gap-1.5">
				<ThemeToggle />
				<BetterAuthHeader />
			</div>
		</header>
	);
}

export function AppFrame({ children }: { children: ReactNode }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	if (isPublicPath(pathname)) {
		return (
			<div className="flex min-h-screen flex-col">
				<PublicHeader />
				<main className="flex-1">{children}</main>
				<SiteFooter />
			</div>
		);
	}

	return (
		<SidebarProvider>
			<AppSidebar />
			{isAdminPath(pathname) && <AdminSecondarySidebar />}
			{isOrganizerActivityDetailPath(pathname) && (
				<ActivityManagementSecondarySidebar />
			)}
			<SidebarInset className="min-w-0 flex-1 basis-0 overflow-x-hidden">
				<DashboardTopbar />
				<div className="min-w-0 flex-1">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
