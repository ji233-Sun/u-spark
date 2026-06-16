import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	BadgeCheck,
	ClipboardList,
	FileText,
	Send,
	Wallet,
} from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";

export const Route = createFileRoute("/")({ component: HomePage });

const FEATURES = [
	{
		icon: ClipboardList,
		title: "立项申报",
		desc: "组织者配置表单与截止时间，作者在线提交立项，状态实时流转。",
	},
	{
		icon: Send,
		title: "投稿审核",
		desc: "稿件提交、审核、退回修改全程留痕，状态机守护每一步。",
	},
	{
		icon: FileText,
		title: "信息补充",
		desc: "通过后按需补充作者、收货与收款信息，结构化沉淀。",
	},
	{
		icon: Wallet,
		title: "稿酬发放",
		desc: "稿酬与奖品发放清单一目了然，导出对账无压力。",
	},
];

const STEPS = [
	["01", "立项", "提交企划立项，等待组织者审核。"],
	["02", "投稿", "立项通过后上传稿件，进入评审。"],
	["03", "补充", "审核通过后补全作者与收款信息。"],
	["04", "发放", "组织者完成稿酬与奖品发放。"],
];

function HomePage() {
	return (
		<div className="page-wrap px-4 pb-16 pt-12 sm:pt-16">
			<section className="rise-in relative overflow-hidden rounded-3xl border bg-card px-6 py-12 shadow-sm sm:px-12 sm:py-16">
				<div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
				<div className="relative max-w-2xl">
					<Badge variant="secondary" className="mb-4">
						视频庆典 · 征稿协作平台
					</Badge>
					<h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
						从立项到稿酬，
						<br />
						一条龙顺畅流转
					</h1>
					<p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
						U-Spark
						面向视频类庆典企划，覆盖立项、投稿、审核、信息补充、稿酬/奖品发放全流程，让组织者与作者高效协作。
					</p>
					<div className="mt-8 flex flex-wrap gap-3">
						<Button asChild size="lg">
							<Link to="/auth">
								立即开始
								<ArrowRight />
							</Link>
						</Button>
						<Button asChild size="lg" variant="outline">
							<Link to="/activities">浏览活动</Link>
						</Button>
					</div>
				</div>
			</section>

			<section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{FEATURES.map((f) => (
					<Card key={f.title} className="rise-in">
						<CardHeader>
							<div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<f.icon className="size-5" />
							</div>
							<CardTitle>{f.title}</CardTitle>
							<CardDescription>{f.desc}</CardDescription>
						</CardHeader>
					</Card>
				))}
			</section>

			<section className="mt-10 rounded-3xl border bg-card p-6 shadow-sm sm:p-10">
				<div className="mb-6 flex items-center gap-2 text-sm font-semibold text-primary">
					<BadgeCheck className="size-4" />
					四步流程
				</div>
				<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
					{STEPS.map(([num, title, desc]) => (
						<div key={num}>
							<div className="text-3xl font-bold text-primary/30">{num}</div>
							<h3 className="mt-1 text-base font-semibold text-foreground">
								{title}
							</h3>
							<p className="mt-1 text-sm text-muted-foreground">{desc}</p>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
