import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bars, Lines, S } from "@/components/charts/charts";
import { ErrorBox, Loading, PageHeader, Stat } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, NumberInput, Select } from "@/components/ui/form";
import { Tabs } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useGet, useSave } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { money, monthLabel } from "@/lib/format";

const ASSET_KINDS: Record<string, string> = { property: "Vivienda / inmueble", vehicle: "Vehículo", other: "Otro" };
const LIAB_KINDS: Record<string, string> = { loan: "Préstamo", debt: "Deuda", other: "Otra" };

function ItemList({ title, desc, path, kinds, valueKey, items }: { title: string; desc: string; path: string; kinds: Record<string, string>; valueKey: "value" | "balance"; items: any[] }) {
  const [f, setF] = useState<any>(null);
  const toast = useToast();
  useEffect(() => {}, []);
  const save = useSave(() => (f.id ? api.put(`${path}/${f.id}`, f) : api.post(path, f)), () => { toast("Guardado"); setF(null); });
  const del = useSave((id: number) => api.del(`${path}/${id}`), () => toast("Eliminado"));
  return (
    <Card>
      <CardHeader><div><CardTitle>{title}</CardTitle><CardDescription>{desc}</CardDescription></div><Button size="sm" variant="outline" onClick={() => setF({ name: "", kind: Object.keys(kinds)[0], [valueKey]: null })}><Plus className="h-4 w-4" />Añadir</Button></CardHeader>
      <CardContent>
        {items.length ? <ul className="divide-y text-sm">{items.map((i) => <li key={i.id} className="flex items-center justify-between gap-2 py-2"><div><div>{i.name}</div><div className="text-xs text-muted-foreground">{kinds[i.kind]}</div></div><div className="flex items-center gap-1"><span className="tabular font-medium">{money(i[valueKey], false)}</span><Button size="icon" variant="ghost" onClick={() => setF({ ...i })} aria-label="Editar"><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button></div></li>)}</ul> : <p className="text-sm text-muted-foreground">Nada registrado.</p>}
      </CardContent>
      <Modal open={!!f} onOpenChange={(o) => !o && setF(null)} title={title}>
        {f && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
            <Field label="Nombre"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
            <Field label="Tipo"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label={valueKey === "value" ? "Valor actual (€)" : "Importe pendiente (€)"}><NumberInput value={f[valueKey]} onChange={(v) => setF({ ...f, [valueKey]: v })} min={0} required /></Field>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setF(null)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

export default function NetWorth() {
  const [months, setMonths] = useState("24");
  const { data, isLoading, error } = useGet<any>("/networth", { months: Number(months) });
  const assets = useGet<any[]>("/other-assets").data ?? [];
  const liabs = useGet<any[]>("/liabilities").data ?? [];
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const c = data.current;
  const series = data.series.map((r: any) => ({ ...r, label: monthLabel(r.month, true) }));
  const row = (label: string, v: number, color?: string) => <li className="flex items-center justify-between py-1.5 text-sm"><span className="inline-flex items-center gap-2">{color && <span className="h-2 w-2 rounded-sm" style={{ background: color }} />}{label}</span><span className="tabular">{money(v)}</span></li>;
  return (
    <>
      <PageHeader title="Patrimonio neto" description="Patrimonio neto = activos − pasivos. El histórico se reconstruye desde tus movimientos, precios de inversión y cuadro de la hipoteca." actions={<Tabs value={months} onChange={setMonths} items={[{ value: "12", label: "12 m" }, { value: "24", label: "24 m" }, { value: "60", label: "5 años" }]} />} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Patrimonio neto" value={money(c.net_worth, false)} tone={c.net_worth >= 0 ? "pos" : "neg"} />
        <Stat label="Activos" value={money(c.assets, false)} />
        <Stat label="Pasivos" value={money(c.liabilities, false)} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Evolución histórica</CardTitle></CardHeader><CardContent>
          <Lines data={series} xKey="label" series={[{ key: "net_worth", label: "Patrimonio neto", color: S(1) }, { key: "assets", label: "Activos", color: S(3) }, { key: "liabilities", label: "Pasivos", color: S(2) }]} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Detalle</CardTitle></CardHeader><CardContent>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activos</div>
          <ul className="divide-y">{row("Cuentas y efectivo", c.cash, S(1))}{row("Remunerada / ahorro", c.savings, S(3))}{row("Inversiones", c.investments, S(2))}{row("Otros activos", c.other_assets, S(4))}</ul>
          <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pasivos</div>
          <ul className="divide-y">{row("Hipoteca", c.mortgage)}{row("Préstamos y otras deudas", c.other_liabilities)}</ul>
          <p className="mt-3 text-xs text-muted-foreground">La hipoteca se configura en <Link className="text-primary underline" to="/hipoteca">Hipoteca</Link>.</p>
        </CardContent></Card>
      </div>
      <Card className="mt-4"><CardHeader><div><CardTitle>Composición de activos</CardTitle><CardDescription>Evolución mensual por tipo</CardDescription></div></CardHeader><CardContent>
        <Bars stacked data={series} xKey="label" series={[{ key: "cash", label: "Cuentas y efectivo", color: S(1) }, { key: "savings", label: "Remunerada / ahorro", color: S(3) }, { key: "investments", label: "Inversiones", color: S(2) }, { key: "other_assets", label: "Otros", color: S(4) }]} />
      </CardContent></Card>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ItemList title="Otros activos" desc="Vivienda, vehículo… (no están en cuentas ni inversiones)" path="/other-assets" kinds={ASSET_KINDS} valueKey="value" items={assets} />
        <ItemList title="Préstamos y otras deudas" desc="Pasivos distintos de la hipoteca" path="/liabilities" kinds={LIAB_KINDS} valueKey="balance" items={liabs} />
      </div>
    </>
  );
}
