import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog.tsx";

// 兼容层：旧 Modal 接口，内核改用 shadcn Dialog。
export function Modal({
	open,
	onClose,
	title,
	children,
}: {
	open: boolean;
	onClose: () => void;
	title?: string;
	children: ReactNode;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<DialogContent>
				{title && (
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>
				)}
				{children}
			</DialogContent>
		</Dialog>
	);
}
