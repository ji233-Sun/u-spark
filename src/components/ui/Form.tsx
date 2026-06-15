import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const FIELD_CLASS =
  "w-full rounded-xl border border-[var(--chip-line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none focus:border-[var(--lagoon)]";

// label 包裹 control 隐式关联；可选 htmlFor 做显式关联。
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
      <span className="text-sm font-medium text-[var(--sea-ink)]">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASS} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASS} ${className}`} {...props} />;
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD_CLASS} ${className}`} {...props}>
      {children}
    </select>
  );
}
