import type { ReactNode } from "react";

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
	if (!open) {
		return null;
	}
	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
			<button
				type="button"
				aria-label="关闭"
				onClick={onClose}
				className="absolute inset-0 bg-black/40 backdrop-blur-sm"
			/>
			<div
				role="dialog"
				aria-modal="true"
				className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-xl"
			>
				{title && (
					<h2 className="m-0 mb-4 text-lg font-semibold text-[var(--sea-ink)]">
						{title}
					</h2>
				)}
				{children}
			</div>
		</div>
	);
}
