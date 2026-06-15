import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";
import type { Tone } from "#/lib/celebration/labels";

type ToastItem = { id: number; message: string; tone: Tone };
type ToastContextValue = { notify: (message: string, tone?: Tone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_BAR: Record<Tone, string> = {
	neutral: "bg-slate-800 text-white",
	info: "bg-sky-600 text-white",
	success: "bg-emerald-600 text-white",
	warning: "bg-amber-600 text-white",
	danger: "bg-red-600 text-white",
};

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<ToastItem[]>([]);
	const idRef = useRef(0);

	const notify = useCallback((message: string, tone: Tone = "info") => {
		const id = ++idRef.current;
		setItems((prev) => [...prev, { id, message, tone }]);
		setTimeout(() => {
			setItems((prev) => prev.filter((t) => t.id !== id));
		}, AUTO_DISMISS_MS);
	}, []);

	return (
		<ToastContext.Provider value={{ notify }}>
			{children}
			<div className="fixed right-4 bottom-4 z-[200] flex flex-col gap-2">
				{items.map((t) => (
					<output
						key={t.id}
						className={`rounded-xl px-4 py-2 text-sm font-medium shadow-lg ${TONE_BAR[t.tone]}`}
					>
						{t.message}
					</output>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast(): ToastContextValue {
	const ctx = useContext(ToastContext);
	if (!ctx) {
		throw new Error("useToast 必须在 ToastProvider 内使用");
	}
	return ctx;
}
