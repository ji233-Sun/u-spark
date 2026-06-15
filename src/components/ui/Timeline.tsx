// 状态时间轴（T07 #7，服务 T17）：多节点 + 每节点状态展示。
export type TimelineNodeStatus = "done" | "current" | "pending" | "rejected";

export type TimelineNode = {
	label: string;
	status: TimelineNodeStatus;
	description?: string;
};

const DOT_CLASS: Record<TimelineNodeStatus, string> = {
	done: "border-emerald-500 bg-emerald-500",
	current:
		"border-[var(--lagoon)] bg-[var(--lagoon)] ring-4 ring-[var(--hero-a)]",
	pending: "border-[var(--line)] bg-transparent",
	rejected: "border-red-500 bg-red-500",
};

export function Timeline({ nodes }: { nodes: TimelineNode[] }) {
	return (
		<ol className="relative flex flex-col">
			{nodes.map((node, i) => (
				<li
					key={node.label}
					data-status={node.status}
					className="relative flex gap-3 pb-6 last:pb-0"
				>
					{i < nodes.length - 1 && (
						<span
							aria-hidden
							className="absolute left-[7px] top-4 h-full w-px bg-[var(--line)]"
						/>
					)}
					<span
						className={`relative mt-1 h-4 w-4 flex-shrink-0 rounded-full border-2 ${DOT_CLASS[node.status]}`}
					/>
					<div className="min-w-0">
						<p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
							{node.label}
						</p>
						{node.description && (
							<p className="m-0 mt-0.5 text-xs text-[var(--sea-ink-soft)]">
								{node.description}
							</p>
						)}
					</div>
				</li>
			))}
		</ol>
	);
}
