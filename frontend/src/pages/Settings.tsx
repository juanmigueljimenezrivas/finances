import { Database, Download, FileSpreadsheet, FileText, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog, ErrorBox, Loading, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Checkbox, Field, Input, NumberInput, Select } from "@/components/ui/form";
import { Badge, Table, Td, Th, Tabs, Tr } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useCategories, useGet, useSave } from "@/hooks/useApi";
import { useTheme } from "@/hooks/useTheme";
import { api } from "@/lib/api";
import type { Category, Rule, Settings } from "@/lib/types";

function Preferences() {
  const { data } = useGet<Settings>("/settings");
  const [f, setF] = useState<Settings | null>(null);
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  useEffect(() => { if (data) setF(data); }, [data]);
  const save = useSave(() => api.put("/settings", f), () => toast("Ajustes guardados"));
  if (!f) return <Loading />;
  const n = (k: keyof Settings) => <NumberInput value={f[k] as number | null} onChange={(v) => setF({ ...f, [k]: v })} />;
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle>Apariencia</CardTitle></CardHeader><CardContent><Tabs value={theme} onChange={setTheme} items={[{ value: "light", label: "☀️ Claro" }, { value: "dark", label: "🌙 Oscuro" }, { value: "system", label: "💻 Sistema" }]} /></CardContent></Card>
      <Card><CardHeader><div><CardTitle>Parámetros financieros</CardTitle><CardDescription>Se usan en proyecciones, FIRE y fondo de emergencia.</CardDescription></div></CardHeader>
        <CardContent><form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <Field label="Rentabilidad conservadora (% anual)">{n("return_conservative")}</Field>
          <Field label="Rentabilidad realista (% anual)">{n("return_realistic")}</Field>
          <Field label="Rentabilidad optimista (% anual)">{n("return_optimistic")}</Field>
          <Field label="Inflación esperada (% anual)">{n("inflation")}</Field>
          <Field label="Tasa de retirada FIRE (%)">{n("fire_withdrawal_rate")}</Field>
          <Field label="Meses objetivo del fondo de emergencia">{n("emergency_months_target")}</Field>
          <Field label="Ahorro mensual para proyecciones (€)" hint="Vacío = media real de tus últimos 3 meses">{n("monthly_saving_override")}</Field>
          <Field label="Gasto anual para FIRE (€)" hint="Vacío = media real de 12 meses">{n("fire_annual_expenses_override")}</Field>
          <div className="flex items-end"><Button type="submit" disabled={save.isPending}>Guardar</Button></div>
        </form></CardContent></Card>
    </div>
  );
}

function Categories() {
  const { data } = useCategories();
  const [f, setF] = useState<any>(null);
  const [del, setDel] = useState<Category | null>(null);
  const toast = useToast();
  const save = useSave(() => (f.id ? api.put(`/categories/${f.id}`, f) : api.post("/categories", f)), () => { toast("Categoría guardada"); setF(null); });
  const remove = useSave((id: number) => api.del(`/categories/${id}`), () => { toast("Categoría eliminada"); setDel(null); });
  const list = (kind: "expense" | "income") => (
    <Card><CardHeader><CardTitle>{kind === "expense" ? "Categorías de gasto" : "Categorías de ingreso"}</CardTitle><Button size="sm" variant="outline" onClick={() => setF({ name: "", kind, color: "#6366f1", icon: "🏷️" })}><Plus className="h-4 w-4" />Nueva</Button></CardHeader>
      <CardContent><ul className="divide-y">{(data ?? []).filter((c) => c.kind === kind).map((c) => (
        <li key={c.id} className="flex items-center justify-between py-1.5 text-sm"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.icon} {c.name}</span>
          <span><Button size="icon" variant="ghost" onClick={() => setF({ ...c })} aria-label="Editar"><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => setDel(c)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button></span></li>
      ))}</ul></CardContent></Card>
  );
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">{list("expense")}{list("income")}</div>
      <Modal open={!!f} onOpenChange={(o) => !o && setF(null)} title={f?.id ? "Editar categoría" : "Nueva categoría"}>
        {f && <form className="grid gap-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <Field label="Nombre" className="sm:col-span-3"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
          <Field label="Icono (emoji)"><Input value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} maxLength={4} /></Field>
          <Field label="Color"><input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-9 w-full cursor-pointer rounded-md border border-input bg-transparent p-1" /></Field>
          <Field label="Tipo"><Select value={f.kind} disabled={!!f.id} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="expense">Gasto</option><option value="income">Ingreso</option></Select></Field>
          <div className="flex justify-end gap-2 sm:col-span-3"><Button variant="outline" onClick={() => setF(null)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
          {save.error && <p className="text-sm text-danger sm:col-span-3">{(save.error as Error).message}</p>}
        </form>}
      </Modal>
      <ConfirmDialog open={!!del} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} title={`¿Eliminar "${del?.name}"?`} text="Los movimientos de esta categoría quedarán «sin categoría»; sus presupuestos y reglas se eliminarán." />
    </>
  );
}

function Rules() {
  const rules = useGet<Rule[]>("/rules").data ?? [];
  const cats = useCategories().data ?? [];
  const [f, setF] = useState<any>(null);
  const toast = useToast();
  const save = useSave(() => (f.id ? api.put(`/rules/${f.id}`, f) : api.post("/rules", f)), () => { toast("Regla guardada"); setF(null); });
  const del = useSave((id: number) => api.del(`/rules/${id}`));
  const toggle = useSave((r: Rule) => api.put(`/rules/${r.id}`, { ...r, is_active: !r.is_active }));
  const apply = useSave((all: boolean) => api.post(`/rules/apply?only_uncategorized=${!all}`), (r: any) => toast(`${r.updated} movimientos actualizados`));
  const cm = Object.fromEntries(cats.map((c) => [c.id, c]));
  return (
    <Card>
      <CardHeader><div><CardTitle>Reglas de categorización automática</CardTitle><CardDescription>Si el concepto de un movimiento coincide con el texto, se asigna la categoría (ej. MERCADONA → Alimentación). Se aplican al crear e importar movimientos. Gana la de menor prioridad.</CardDescription></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => apply.mutate(false)}>Aplicar a «sin categoría»</Button><Button size="sm" onClick={() => setF({ pattern: "", category_id: cats[0]?.id, match_type: "contains", priority: 100, is_active: true })}><Plus className="h-4 w-4" />Nueva regla</Button></div></CardHeader>
      <CardContent className="px-0"><Table>
        <thead><tr className="border-b"><Th>Texto</Th><Th>Tipo</Th><Th>Categoría</Th><Th>Prioridad</Th><Th>Activa</Th><Th /></tr></thead>
        <tbody>{rules.map((r) => <Tr key={r.id} className={r.is_active ? "" : "opacity-50"}><Td className="font-mono text-xs">{r.pattern}</Td><Td><Badge>{{ contains: "contiene", startswith: "empieza por", regex: "regex" }[r.match_type]}</Badge></Td><Td>{cm[r.category_id]?.icon} {cm[r.category_id]?.name} <span className="text-xs text-muted-foreground">({cm[r.category_id]?.kind === "income" ? "ingreso" : "gasto"})</span></Td><Td>{r.priority}</Td>
          <Td><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={r.is_active} onChange={() => toggle.mutate(r)} aria-label="Activa" /></Td>
          <Td className="text-right whitespace-nowrap"><Button size="icon" variant="ghost" onClick={() => setF({ ...r })} aria-label="Editar"><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button></Td></Tr>)}</tbody></Table></CardContent>
      <Modal open={!!f} onOpenChange={(o) => !o && setF(null)} title={f?.id ? "Editar regla" : "Nueva regla"}>
        {f && <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <Field label="Texto a buscar" className="sm:col-span-2"><Input value={f.pattern} onChange={(e) => setF({ ...f, pattern: e.target.value })} placeholder="MERCADONA" required autoFocus /></Field>
          <Field label="Coincidencia"><Select value={f.match_type} onChange={(e) => setF({ ...f, match_type: e.target.value })}><option value="contains">Contiene</option><option value="startswith">Empieza por</option><option value="regex">Expresión regular</option></Select></Field>
          <Field label="Prioridad (menor = antes)"><NumberInput value={f.priority} onChange={(v) => setF({ ...f, priority: v ?? 100 })} /></Field>
          <Field label="Categoría" className="sm:col-span-2"><Select value={f.category_id} onChange={(e) => setF({ ...f, category_id: Number(e.target.value) })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.kind === "income" ? "↓ Ingreso" : "↑ Gasto"} · {c.icon} {c.name}</option>)}</Select></Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={() => setF(null)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
        </form>}
      </Modal>
    </Card>
  );
}

function DataTab() {
  const toast = useToast();
  const [confirm, setConfirm] = useState<"reset" | "restore" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const run = (path: string, name: string) => api.download(path, name).catch((e) => toast(e.message, "err"));
  const reset = useSave(() => api.post("/data/reset?confirm=true"), () => { toast("Datos borrados"); setConfirm(null); });
  const demo = useSave(() => api.post("/data/demo"), () => toast("Datos de ejemplo cargados"));
  const restore = useSave(() => { const fd = new FormData(); fd.append("file", file!); return api.upload("/export/restore", fd); }, () => { toast("Copia restaurada"); setConfirm(null); setFile(null); });
  const items = [
    { icon: FileSpreadsheet, t: "Excel completo", d: "Movimientos, cuentas, inversiones, presupuestos y amortización", fn: () => run("/export/full.xlsx", "finanzas-completo.xlsx") },
    { icon: FileSpreadsheet, t: "Movimientos (Excel)", d: "Todos los movimientos en .xlsx", fn: () => run("/export/transactions.xlsx", "movimientos.xlsx") },
    { icon: FileText, t: "Movimientos (CSV)", d: "Compatible con Excel (separador ;)", fn: () => run("/export/transactions.csv", "movimientos.csv") },
    { icon: FileText, t: "Informe PDF", d: "Resumen de patrimonio, flujo y recomendaciones", fn: () => run("/export/report.pdf", "informe-financiero.pdf") },
    { icon: Database, t: "Copia de seguridad (JSON)", d: "Todos tus datos; restaurable en cualquier instalación", fn: () => run("/export/backup.json", "backup-finanzas.json") },
  ];
  return (
    <div className="space-y-4">
      <Card><CardHeader><div><CardTitle>Exportar</CardTitle><CardDescription>Descarga tus datos y reportes.</CardDescription></div></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => <button key={i.t} onClick={i.fn} className="flex items-start gap-3 rounded-lg border p-3 text-left transition hover:bg-accent/50"><i.icon className="mt-0.5 h-5 w-5 text-primary" /><div><div className="flex items-center gap-1 text-sm font-medium">{i.t}<Download className="h-3 w-3" /></div><div className="text-xs text-muted-foreground">{i.d}</div></div></button>)}
      </CardContent></Card>
      <Card><CardHeader><div><CardTitle>Restaurar copia de seguridad</CardTitle><CardDescription>Reemplaza TODOS tus datos actuales por los del archivo .json.</CardDescription></div></CardHeader><CardContent className="flex flex-wrap items-center gap-3">
        <Input type="file" accept=".json" className="max-w-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button variant="outline" disabled={!file} onClick={() => setConfirm("restore")}><Upload className="h-4 w-4" />Restaurar</Button>
      </CardContent></Card>
      <Card><CardHeader><div><CardTitle>Zona de datos</CardTitle><CardDescription>Datos de ejemplo para explorar (solo si no tienes datos) o empezar de cero.</CardDescription></div></CardHeader><CardContent className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => demo.mutate(undefined)} disabled={demo.isPending}>Cargar datos de ejemplo</Button>
        <Button variant="danger" onClick={() => setConfirm("reset")}>Borrar todos mis datos</Button>
        {demo.error && <p className="w-full text-sm text-danger">{(demo.error as Error).message}</p>}
      </CardContent></Card>
      <ConfirmDialog open={confirm === "reset"} onCancel={() => setConfirm(null)} onConfirm={() => reset.mutate(undefined)} title="¿Borrar todos los datos?" text="Se eliminarán cuentas, movimientos, inversiones, objetivos… Esta acción no se puede deshacer. Descarga antes una copia de seguridad." confirmLabel="Borrar todo" />
      <ConfirmDialog open={confirm === "restore"} onCancel={() => setConfirm(null)} onConfirm={() => restore.mutate(undefined)} title="¿Restaurar copia?" text="Tus datos actuales serán reemplazados." confirmLabel="Restaurar" />
      {restore.error && <p className="text-sm text-danger">{(restore.error as Error).message}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<"prefs" | "cats" | "rules" | "data">("prefs");
  const meta = useGet<any>("/auth/meta");
  if (meta.error) return <ErrorBox error={meta.error} />;
  return (
    <>
      <PageHeader title="Ajustes y datos" description={`Base de datos: ${meta.data?.database ?? "…"} · ${meta.data?.auth_enabled ? "modo multiusuario" : "modo local (usuario único)"}`} actions={<Tabs value={tab} onChange={setTab} items={[{ value: "prefs", label: "Preferencias" }, { value: "cats", label: "Categorías" }, { value: "rules", label: "Reglas" }, { value: "data", label: "Datos" }]} />} />
      {tab === "prefs" && <Preferences />}
      {tab === "cats" && <Categories />}
      {tab === "rules" && <Rules />}
      {tab === "data" && <DataTab />}
    </>
  );
}
