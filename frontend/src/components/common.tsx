import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Info, Lightbulb, XCircle } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import type { Recommendation } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, delta, icon: Icon, tone, className }: { label: string; value: ReactNode; sub?: ReactNode; delta?: number | null; icon?: ComponentType<{ className?: string }>; tone?: "pos" | "neg"; className?: string }) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {Icon && <Icon className="h-4 w-4" />}
      </div>
      <div className={cn("tabular mt-2 text-2xl font-semibold tracking-tight", tone === "pos" && "text-success", tone === "neg" && "text-danger")}>{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {delta != null && delta !== 0 && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", delta > 0 ? "text-success" : "text-danger")}>
            {delta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(Math.abs(delta))} €
          </span>
        )}
        {sub}
      </div>
    </Card>
  );
}

export function Empty({ icon: Icon = Lightbulb, title, text, action }: { icon?: ComponentType<{ className?: string }>; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground" />
      <h3 className="font-medium">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const Loading = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-56" />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
    <Skeleton className="h-72" />
  </div>
);

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-md border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
      <b>No se pudo cargar:</b> {String((error as Error)?.message ?? error)}. ¿Está el backend en marcha (puerto 8000)?
    </div>
  );
}

export function ConfirmDialog({ open, onCancel, onConfirm, title, text, confirmLabel = "Eliminar" }: { open: boolean; onCancel: () => void; onConfirm: () => void; title: string; text?: string; confirmLabel?: string }) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onCancel()} title={title} description={text}>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

const SEV = {
  danger: { icon: XCircle, cls: "text-danger", bg: "bg-danger/10 border-danger/30" },
  warning: { icon: AlertTriangle, cls: "text-warning", bg: "bg-warning/10 border-warning/30" },
  info: { icon: Info, cls: "text-primary", bg: "bg-primary/10 border-primary/30" },
  success: { icon: CheckCircle2, cls: "text-success", bg: "bg-success/10 border-success/30" },
} as const;

export function Recommendations({ items }: { items: Recommendation[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Todo en orden: no hay recomendaciones pendientes. ✅</p>;
  return (
    <ul className="space-y-2">
      {items.map((r) => {
        const s = SEV[r.severity];
        const body = (
          <div className={cn("flex gap-3 rounded-md border p-3", s.bg)}>
            <s.icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.cls)} />
            <div className="text-sm">
              <div className="font-medium">{r.title}</div>
              <div className="text-muted-foreground">{r.message}</div>
            </div>
          </div>
        );
        return <li key={r.id}>{r.link ? <Link to={r.link} className="block transition hover:opacity-90">{body}</Link> : body}</li>;
      })}
    </ul>
  );
}

/** Importe con color por signo */
export const Amount = ({ value, type, className }: { value: string; type: "income" | "expense" | "transfer"; className?: string }) => (
  <span className={cn("tabular font-medium", type === "income" && "text-success", type === "expense" && "text-foreground", type === "transfer" && "text-muted-foreground", className)}>
    {type === "income" ? "+" : type === "expense" ? "−" : ""}
    {value}
  </span>
);
