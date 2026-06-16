import type {
	ButtonHTMLAttributes,
	InputHTMLAttributes,
	ReactNode,
	SelectHTMLAttributes,
	TextareaHTMLAttributes,
} from "react";
import { cn } from "#/lib/utils";
import { Button as ShButton } from "./button.tsx";
import { Input as ShInput } from "./input.tsx";
import { Textarea as ShTextarea } from "./textarea.tsx";

// 兼容层：旧 UI Kit 接口（primary/secondary/danger 等），内核改用 shadcn。
// 逐页重写后将直接使用 shadcn 原语，本文件随后删除。

const VARIANT_MAP = {
	primary: "default",
	secondary: "secondary",
	danger: "destructive",
} as const;

export function Button({
	variant = "primary",
	type = "button",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "danger";
}) {
	return <ShButton type={type} variant={VARIANT_MAP[variant]} {...props} />;
}

export function Field({
	label,
	htmlFor,
	error,
	children,
}: {
	label: string;
	htmlFor?: string;
	error?: string;
	children: ReactNode;
}) {
	return (
		<label htmlFor={htmlFor} className="grid gap-1.5">
			<span className="text-sm font-medium text-foreground">{label}</span>
			{children}
			{error && <span className="text-xs text-destructive">{error}</span>}
		</label>
	);
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
	return <ShInput {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return <ShTextarea {...props} />;
}

export function Select({
	className,
	children,
	...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select
			className={cn(
				"flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		>
			{children}
		</select>
	);
}
