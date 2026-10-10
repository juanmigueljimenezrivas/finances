import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog, Empty, ErrorBox, Loading, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, NumberInput, Select } from "@/components/ui/form";
import { Badge, Progress } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useGet, useSave } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { dateEs, money, pct, yearsMonths } from "@/lib/format";
import { GOAL_KINDS } from "@/lib/types";

const blank = { name: "", kind: "other", target_amount: null as number | null, current_amount: 0, target_date: "" };

export default function Goals() {
  const { data, isLoading, error } = useGet<any[]>("/goals");
  const [form, setForm] = useState<any>(null);
  const [f, setF] = useState<any>(blank);
  const [del, setDel] = useState<any>(null);
  const [contrib, setContrib] = useState<{ goal: any; amount: number | null } | null>(null);
  const toast = useToast();
  useEffect(() => { if (form !== null) setF(form === "new" ? blank : { ...form, target_date: form.target_date ?? "" }); }, [form]);
  const save = useSave(() => { const b = { ...f, target_date: f.target_date || null }; return form === "new" ? api.post("/goals", b) : api.put(`/goals/${form.id}`, b); }, () => { toast("Objetivo guardado"); setForm(null); });
  const remove = useSave((id: number) => api.del(`/goals/${id}`), () => { toast("Objetivo eliminado"); setDel(null); });
  const add = useSave(() => api.post(`/goals/${contrib!.goal.id}/contribute?amount=${contrib!.amount}`), () => { toast("Aportación registrada"); setContrib(null); });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  return (
    <>
      <PageHeader title="Objetivos financieros" description="Viajes, coche, entrada de vivienda, inversión… con seguimiento del ahorro necesario." actions={<Button onClick={() => setForm("new")}><Plus className="h-4 w-4" />Nuevo objetivo</Button>} />
      {!data.length ? <Empty icon={Target} title="Sin objetivos" text="Define un objetivo con importe y fecha para saber cuánto debes ahorrar al mes." action={<Button onClick={() => setForm("new")}><Plus className="h-4 w-4" />Crear objetivo</Button>} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((g) => (
            <Card key={g.id}>
              <CardHeader>
                <div><CardTitle className="text-base">{g.name}</CardTitle><div className="mt-1 text-xs text-muted-foreground">{GOAL_KINDS[g.kind]}</div></div>
                {g.pct >= 100 ? <Badge tone="success">Completado</Badge> : g.on_track === true ? <Badge tone="success">En camino</Badge> : g.on_track === false ? <Badge tone="warning">En riesgo</Badge> : null}
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between"><span className="tabular text-xl font-semibold">{money(g.current_amount, false)}</span><span className="text-sm text-muted-foreground">de {money(g.target_amount, false)}</span></div>
                <Progress value={g.pct} tone={g.pct >= 100 ? "success" : "primary"} className="mt-2" />
                <div className="mt-1 text-xs text-muted-foreground">{pct(g.pct, 0)} completado · faltan {money(g.remaining, false)}</div>
                <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {g.target_date && <div className="flex justify-between"><dt>Fecha objetivo</dt><dd>{dateEs(g.target_date)}</dd></div>}
                  {g.monthly_needed != null && <div className="flex justify-between"><dt>Ahorro necesario</dt><dd className="font-medium text-foreground">{money(g.monthly_needed, false)}/mes</dd></div>}
                  {g.eta_months != null && g.remaining > 0 && <div className="flex justify-between"><dt>Al ritmo actual de ahorro</dt><dd>{yearsMonths(Math.ceil(g.eta_months))}</dd></div>}
                </dl>
                <div className="mt-3 flex gap-1"><Button size="sm" variant="outline" onClick={() => setContrib({ goal: g, amount: null })}>Aportar</Button><Button size="icon" variant="ghost" onClick={() => setForm(g)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => setDel(g)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Modal open={form !== null} onOpenChange={(o) => !o && setForm(null)} title={form === "new" ? "Nuevo objetivo" : "Editar objetivo"}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <Field label="Nombre" className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
          <Field label="Tipo"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(GOAL_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Fecha objetivo"><Input type="date" value={f.target_date} onChange={(e) => setF({ ...f, target_date: e.target.value })} /></Field>
          <Field label="Objetivo económico (€)"><NumberInput value={f.target_amount} onChange={(v) => setF({ ...f, target_amount: v })} min={1} required /></Field>
          <Field label="Ahorro actual (€)"><NumberInput value={f.current_amount} onChange={(v) => setF({ ...f, current_amount: v ?? 0 })} min={0} /></Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
          {save.error && <p className="text-sm text-danger sm:col-span-2">{(save.error as Error).message}</p>}
        </form>
      </Modal>
      <Modal open={!!contrib} onOpenChange={(o) => !o && setContrib(null)} title={`Aportar a ${contrib?.goal.name ?? ""}`} description="Usa un importe negativo para retirar.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (contrib?.amount) add.mutate(undefined); }}>
          <Field label="Importe (€)"><NumberInput value={contrib?.amount ?? null} onChange={(v) => setContrib(contrib && { ...contrib, amount: v })} autoFocus /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setContrib(null)}>Cancelar</Button><Button type="submit">Aportar</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} title={`¿Eliminar "${del?.name}"?`} />
    </>
  );
}
