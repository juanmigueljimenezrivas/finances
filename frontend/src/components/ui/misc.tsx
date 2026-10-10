import { useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, tone = "default", ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "success" | "warning" | "danger" | "info" }) {
  const tones = {
    default: "bg-secondary text-secondary-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
    info: "bg-primary/15 text-primary",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone], className)} {...p} />;
}

export function Progress({ value, tone, className }: { value: number; tone?: "success" | "warning" | "danger" | "primary"; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const t = tone ?? (value > 100 ? "danger" : value >= 80 ? "warning" : "primary");
  const color = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", primary: "bg-primary" }[t];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${v}%` }} />
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-md bg-secondary", className)} />;

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-secondary p-1" role="tablist">
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          onClick={() => onChange(i.value)}
          className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition", value === i.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Table({ className, ...p }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...p} />
    </div>
  );
}
export const Th = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn("h-9 whitespace-nowrap px-3 text-left align-middle text-xs font-medium text-muted-foreground", className)} {...p} />
);
export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("px-3 py-2.5 align-middle", className)} {...p} />;
export const Tr = ({ className, ...p }: HTMLAttributes<HTMLTableRowElement>) => <tr className={cn("border-b transition-colors last:border-0 hover:bg-accent/50", className)} {...p} />;

export function useConfirm() {
  const [pending, setPending] = useState<null | (() => void)>(null);
  return { pending, ask: (fn: () => void) => setPending(() => fn), close: () => setPending(null) };
}
