import { LineChart as LineIcon, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AreaTrend, Donut, S } from "@/components/charts/charts";
import { ConfirmDialog, Empty, ErrorBox, Loading, PageHeader, Stat } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, NumberInput, Select } from "@/components/ui/form";
import { Badge, Table, Td, Th, Tr } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useGet, useSave } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { dateEs, money, monthLabel, number, pct, today } from "@/lib/format";
import { INVESTMENT_TYPES } from "@/lib/types";

const TYPE_COLOR: Record<string, string> = { etf: S(1), index_fund: S(3), stock: S(2), crypto: S(4), bond: S(5) };
const blank = { name: "", ticker: "", type: "etf", quantity: null as number | null, buy_price: null as number | null, current_price: null as number | null, fees: 0, purchase_date: today(), currency: "EUR", provider: "manual" };

function Form({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: any }) {
  const [f, setF] = useState<any>(blank);
  const toast = useToast();
  useEffect(() => { if (open) setF(initial ? { ...initial } : blank); }, [open, initial]);
  const save = useSave(() => (initial ? api.put(`/investments/${initial.id}`, f) : api.post("/investments", f)), () => { toast("Inversión guardada"); onClose(); });
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={initial ? "Editar inversión" : "Nueva inversión"} wide>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <Field label="Activo"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Vanguard FTSE All-World" required autoFocus /></Field>
        <Field label="Ticker / ISIN" hint="Para futuras integraciones con APIs de precios"><Input value={f.ticker} onChange={(e) => setF({ ...f, ticker: e.target.value })} /></Field>
        <Field label="Tipo"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{Object.entries(INVESTMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Cantidad"><NumberInput value={f.quantity} onChange={(v) => setF({ ...f, quantity: v })} min={0} required /></Field>
        <Field label="Precio de compra (€)"><NumberInput value={f.buy_price} onChange={(v) => setF({ ...f, buy_price: v })} min={0} required /></Field>
        <Field label="Valor actual por unidad (€)" hint="Vacío = igual al precio de compra"><NumberInput value={f.current_price} onChange={(v) => setF({ ...f, current_price: v })} min={0} /></Field>
        <Field label="Comisiones (€)"><NumberInput value={f.fees} onChange={(v) => setF({ ...f, fees: v ?? 0 })} min={0} /></Field>
        <Field label="Fecha de compra"><Input type="date" value={f.purchase_date} onChange={(e) => setF({ ...f, purchase_date: e.target.value })} required /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={save.isPending}>Guardar</Button></div>
        {save.error && <p className="text-sm text-danger sm:col-span-2">{(save.error as Error).message}</p>}
      </form>
    </Modal>
  );
}

export default function Investments() {
  const { data, isLoading, error } = useGet<any>("/investments");
  const [edit, setEdit] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [del, setDel] = useState<any>(null);
  const [priceFor, setPriceFor] = useState<any>(null);
  const [price, setPrice] = useState<number | null>(null);
  const toast = useToast();
  const remove = useSave((id: number) => api.del(`/investments/${id}`), () => { toast("Inversión eliminada"); setDel(null); });
  const setP = useSave(() => api.post(`/investments/${priceFor.id}/price`, { price }), () => { toast("Precio actualizado"); setPriceFor(null); });
  const refresh = useSave(() => api.post("/investments/refresh-prices"), (r: any) => toast(r.updated ? `${r.updated} precios actualizados` : "Sin proveedores externos configurados: actualiza los precios manualmente"));
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const t = data.totals;
  const pnlTone = t.pnl >= 0 ? "pos" : "neg";
  return (
    <>
      <PageHeader title="Inversiones" description="ETFs, fondos indexados, acciones, criptomonedas y bonos. Actualiza el precio actual para seguir tu rentabilidad." actions={<><Button variant="outline" onClick={() => refresh.mutate(undefined)}><RefreshCw className="h-4 w-4" />Actualizar precios</Button><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Nueva inversión</Button></>} />
      {!data.items.length ? <Empty icon={LineIcon} title="Aún no tienes inversiones" text="Registra tus posiciones actuales o futuras para seguir su rentabilidad y distribución." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Añadir inversión</Button>} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Valor actual" value={money(t.value)} />
            <Stat label="Invertido (con comisiones)" value={money(t.cost)} sub={`Comisiones ${money(t.fees)}`} />
            <Stat label="Rentabilidad" value={`${t.pnl >= 0 ? "+" : ""}${money(t.pnl)}`} tone={pnlTone} sub={pct(t.pnl_pct, 2)} />
            <Stat label="Plusvalías / minusvalías" value={money(t.gains, false)} sub={<span className="text-danger">{money(t.losses, false)}</span>} tone="pos" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2"><CardHeader><div><CardTitle>Evolución histórica</CardTitle><CardDescription>Valor de la cartera frente a lo invertido</CardDescription></div></CardHeader><CardContent>
              <AreaTrend data={data.history.map((h: any) => ({ ...h, label: monthLabel(h.month, true) }))} xKey="label" series={[{ key: "value", label: "Valor", color: S(1) }, { key: "invested", label: "Invertido", color: S(2), dashed: true }]} zero={false} />
            </CardContent></Card>
            <Card><CardHeader><div><CardTitle>Distribución</CardTitle><CardDescription>Por tipo de activo</CardDescription></div></CardHeader><CardContent>
              <Donut data={data.allocation.map((a: any) => ({ name: INVESTMENT_TYPES[a.type], value: a.value, color: TYPE_COLOR[a.type] }))} center={{ label: "Cartera", value: money(t.value, false) }} />
              <ul className="mt-2 space-y-1 text-xs">{data.allocation.map((a: any) => <li key={a.type} className="flex justify-between"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: TYPE_COLOR[a.type] }} />{INVESTMENT_TYPES[a.type]}</span><span className="tabular">{pct(a.pct)}</span></li>)}</ul>
            </CardContent></Card>
          </div>
          <Card className="mt-4"><CardContent className="px-0 pb-2">
            <Table>
              <thead><tr className="border-b"><Th>Activo</Th><Th>Tipo</Th><Th className="text-right">Cantidad</Th><Th className="text-right">P. compra</Th><Th className="text-right">P. actual</Th><Th className="text-right">Valor</Th><Th className="text-right">Rentab.</Th><Th /></tr></thead>
              <tbody>{data.items.map((i: any) => (
                <Tr key={i.id}>
                  <Td><div className="font-medium">{i.name}</div><div className="text-xs text-muted-foreground">{i.ticker} · compra {dateEs(i.purchase_date)}</div></Td>
                  <Td><Badge>{INVESTMENT_TYPES[i.type]}</Badge></Td>
                  <Td className="tabular text-right">{number(i.quantity, 6)}</Td>
                  <Td className="tabular text-right">{money(i.buy_price)}</Td>
                  <Td className="tabular text-right">{money(i.current_price)}</Td>
                  <Td className="tabular text-right font-medium">{money(i.value)}</Td>
                  <Td className={`tabular text-right font-medium ${i.pnl >= 0 ? "text-success" : "text-danger"}`}>{i.pnl >= 0 ? "+" : ""}{money(i.pnl)}<div className="text-xs">{pct(i.pnl_pct, 2)}</div></Td>
                  <Td className="whitespace-nowrap text-right"><Button size="sm" variant="outline" onClick={() => { setPriceFor(i); setPrice(i.current_price); }}>Precio</Button><Button size="icon" variant="ghost" onClick={() => setEdit(i)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => setDel(i)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button></Td>
                </Tr>
              ))}</tbody>
            </Table>
          </CardContent></Card>
        </>
      )}
      <Form open={creating || !!edit} initial={edit} onClose={() => { setCreating(false); setEdit(null); }} />
      <Modal open={!!priceFor} onOpenChange={(o) => !o && setPriceFor(null)} title={`Actualizar precio · ${priceFor?.name ?? ""}`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setP.mutate(undefined); }}>
          <Field label="Precio actual por unidad (€)" hint="Se guarda en el histórico para la gráfica de evolución."><NumberInput value={price} onChange={setPrice} min={0} required autoFocus /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPriceFor(null)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} title={`¿Eliminar ${del?.name}?`} />
    </>
  );
}
