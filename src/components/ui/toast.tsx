import type { ReactNode } from "react";
import { toast as sonnerToast } from "sonner";
import type { Tone } from "#/lib/celebration/labels";

// 兼容层：旧 useToast/ToastProvider 接口，内核改用 sonner。
// 全局 <Toaster /> 在 __root 挂载，ToastProvider 退化为透传。
type ToastContextValue = { notify: (message: string, tone?: Tone) => void };

export function ToastProvider({ children }: { children: ReactNode }) {
	return <>{children}</>;
}

export function useToast(): ToastContextValue {
	return {
		notify: (message, tone = "info") => {
			switch (tone) {
				case "success":
					sonnerToast.success(message);
					break;
				case "danger":
					sonnerToast.error(message);
					break;
				case "warning":
					sonnerToast.warning(message);
					break;
				default:
					sonnerToast(message);
			}
		},
	};
}
