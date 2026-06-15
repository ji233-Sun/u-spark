import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANT: Record<ButtonVariant, string> = {
	primary: "bg-[var(--lagoon-deep)] text-white hover:brightness-110",
	secondary:
		"border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]",
	danger: "bg-red-600 text-white hover:bg-red-700",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
};

export function Button({
	variant = "primary",
	className = "",
	type = "button",
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${className}`}
			{...props}
		/>
	);
}
