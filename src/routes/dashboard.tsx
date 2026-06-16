import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarRange, FileText, Settings } from "lucide-react";
import { useEffect } from "react";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
});

const QUICK_LINKS = [
	{
		to: "/activities",
		icon: CalendarRange,
		title: "浏览活动",
		desc: "查看正在征稿的庆典活动并发起立项。",
	},
	{
		to: "/my/proposals",
		icon: FileText,
		title: "我的投稿",
		desc: "跟踪你提交的立项与稿件状态。",
	},
	{
		to: "/account",
		icon: Settings,
		title: "账号设置",
		desc: "管理你的账号信息与登录方式。",
	},
] as const;

function DashboardPage() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	useEffect(() => {
		if (!isPending && !session?.user) {
			void navigate({ to: "/auth", replace: true });
		}
	}, [isPending, navigate, session?.user]);

	if (isPending || !session?.user) {
		return (
			<div className="space-y-4 p-4 md:p-6">
				<Skeleton className="h-9 w-48" />
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6 p-4 md:p-6">
			<header>
				<h2 className="text-2xl font-bold tracking-tight">
					欢迎回来，{session.user.name} 👋
				</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					这里是你的用户中心，左侧可访问所有可用功能。
				</p>
			</header>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{QUICK_LINKS.map((item) => (
					<Link key={item.to} to={item.to} className="group no-underline">
						<Card className="h-full transition-colors group-hover:border-primary/40">
							<CardHeader>
								<div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
									<item.icon className="size-5" />
								</div>
								<CardTitle className="flex items-center justify-between">
									{item.title}
									<ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
								</CardTitle>
								<CardDescription>{item.desc}</CardDescription>
							</CardHeader>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
