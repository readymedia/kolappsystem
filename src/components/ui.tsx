// Små felles UI-byggeklosser. Holdt bevisst enkle – Tailwind direkte i JSX.

import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[2rem] border border-slate-200 bg-white ${className}`}>{children}</div>;
}

export function CenteredMessage({
  icon,
  title,
  text,
  tone = "paper",
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  tone?: "paper" | "soft";
}) {
  return (
    <main className={`flex min-h-[100dvh] items-center justify-center px-6 ${tone === "paper" ? "bg-paper" : ""}`}>
      <Card className="w-full max-w-sm p-8 text-center shadow-[0_25px_60px_-40px_rgba(15,23,42,0.4)]">
        {icon && <div className="flex justify-center">{icon}</div>}
        <p className="mt-4 font-display text-xl text-slate-900">{title}</p>
        {text && <p className="mt-2 text-sm text-slate-500">{text}</p>}
      </Card>
    </main>
  );
}

export function Spinner({ className = "h-8 w-8 text-slate-400" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-label="Laster">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const BTN = {
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  outline: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-slate-600 hover:bg-slate-100",
} as const;

export function buttonClass(variant: keyof typeof BTN = "primary", size: "sm" | "md" | "lg" = "md"): string {
  const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-5 text-sm", lg: "h-12 px-6 text-base" };
  return `inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${sizes[size]} ${BTN[variant]}`;
}
