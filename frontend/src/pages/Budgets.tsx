import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Empty, ErrorBox, Loading, PageHeader, Stat } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, NumberInput, Select } from "@/components/ui/form";
import { Badge, Progress } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useCategories, useGet, useSave } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { money, monthNow, pct } from "@/lib/format";

export default function Budgets() {
  const [month, setMonth] = useState(monthNow());
  const { data, isLoading, error } = useGet<any>("/budgets", { month });
  const cats = (useCategories().data ?? []).filter((c) => c.kind === "expense");
  const [edit, setEdit] = useState<{ category_id: number | ""; amount: number | null } | null>(null);
  const toast = useToast();
  const save = useSave(() => api.put("/budgets", { category_id: Number(edit!.category_id), amount: edit!.amount ?? 0 }), () => { toast("Presupuesto guardado"); setEdit(null); });
  const remove = useSave((id: number) => api.del(`/budgets/${id}`), () => toast("Presupuesto eliminado"));
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const over = data.items.filter((i: any) => i.over);
  return (
    <>
      <PageHeader title="Presupuestos" description="Define un límite mensual por categoría y controla cuánto llevas gastado." actions={<><Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-40" /><Button onClick={() => setEdit({ category_id: "", amount: null })}><Plus className="h-4 w-4" />Presupuesto</Button></>} />
      {data.items.length === 0 ? <Empty title="Sin presupuestos" text="Ejemplo: Alimentación 400 €, Ocio 150 €, Tecnología 50 €." action={<Button onClick={() => setEdit({ category_id: "", amount: null })}><Plus className="h-4 w-4" />Crear presupuesto</Button>} /> : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Stat label="Presupuestado" value={money(data.total_budget, false)} />
            <Stat label="Gastado (categorías con presupuesto)" value={money(data.total_spent, false)} sub={pct(data.total_pct, 0) + " consumido"} tone={data.total_spent > data.total_budget ? "neg" : undefined} />
            <Stat label="Restante" value={money(data.total_budget - data.total_spent, false)} tone={data.total_budget - data.total_spent < 0 ? "neg" : "pos"} sub={over.length ? `${over.length} categoría(s) superada(s)` : "Todo dentro del límite"} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.items.map((i: any) => (
              <Card key={i.category_id} className={i.over ? "border-danger/50" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">{i.icon} {i.name}{i.over && <Badge tone="danger"><AlertTriangle className="h-3 w-3" />Superado</Badge>}{!i.over && i.pct >= 80 && <Badge tone="warning">Casi al límite</Badge>}</CardTitle>
                  <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEdit({ category_id: i.category_id, amount: i.budget })}>Editar</Button><Button size="icon" variant="ghost" onClick={() => remove.mutate(i.category_id)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button></div>
                </CardHeader>
                <CardContent>
                  <Progress value={i.pct} />
                  <div className="mt-3 grid grid-cols-3 text-sm">
                    <div><div className="text-xs text-muted-foreground">Gastado</div><div className="tabular font-medium">{money(i.spent)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Restante</div><div className={`tabular font-medium ${i.remaining < 0 ? "text-danger" : ""}`}>{money(i.remaining)}</div></div>
                    <div className="text-right"><div className="text-xs text-muted-foreground">Consumido</div><div className="tabular font-medium">{pct(i.pct, 0)}</div></div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Límite {money(i.budget)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
      {data.unbudgeted.length > 0 && (
        <Card className="mt-6"><CardHeader><CardTitle>Gasto sin presupuesto este mes</CardTitle></CardHeader><CardContent>
          <ul className="divide-y text-sm">{data.unbudgeted.map((u: any) => <li key={u.category_id ?? "x"} className="flex items-center justify-between py-2"><span>{u.name}</span><span className="flex items-center gap-3"><span className="tabular">{money(u.spent)}</span>{u.category_id && <Button size="sm" variant="outline" onClick={() => setEdit({ category_id: u.category_id, amount: Math.ceil(u.spent / 10) * 10 })}>Fijar límite</Button>}</span></li>)}</ul>
        </CardContent></Card>
      )}
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title="Presupuesto mensual">
        {edit && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
            <Field label="Categoría"><Select value={edit.category_id} onChange={(e) => setEdit({ ...edit, category_id: e.target.value === "" ? "" : Number(e.target.value) })} required><option value="">Selecciona…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</Select></Field>
            <Field label="Límite mensual (€)"><NumberInput value={edit.amount} onChange={(v) => setEdit({ ...edit, amount: v })} min={0} required /></Field>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button type="submit" disabled={edit.category_id === "" || edit.amount == null}>Guardar</Button></div>
          </form>
        )}
      </Modal>
    </>
  );
}
