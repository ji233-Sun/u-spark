// UI Kit 兼容出口：保持旧导出名不变，内核已全部替换为 shadcn（radix-maia 主题）。
// 新页面请直接从 ./button、./card 等 shadcn 原语导入；本兼容层逐页重写后清理。

export type { Column } from "./data-table.tsx";
export { Table } from "./data-table.tsx";
export { Button, Field, Input, Select, Textarea } from "./legacy.tsx";
export { Modal } from "./modal.tsx";
export {
	ManuscriptStatusBadge,
	ProjectStatusBadge,
	StatusBadge,
} from "./status-badge.tsx";
export type { TimelineNode, TimelineNodeStatus } from "./timeline.tsx";
export { Timeline } from "./timeline.tsx";
export { ToastProvider, useToast } from "./toast.tsx";
