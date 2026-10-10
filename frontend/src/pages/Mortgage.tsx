import { Home, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AreaTrend, Bars, S } from "@/components/charts/charts";
import { Empty, ErrorBox, Loading, PageHeader, Stat } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, NumberInput, Select } from "@/components/ui/form";
import { Badge, Progress, Table, Td, Th, Tabs, Tr } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useGet, useSave } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { dateEs, money, number, pct, today, yearsMonths } from "@/lib/format";

const blank = { name: "Hipoteca", initial_principal: null as number | null, annual_rate: null as number | null, monthly_payment: null as number | null, start_date: today(), end_date: "", balance_override: null as number | null, override_date: null as string | null, property_value: null as number | null };

function MortgageForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: any }) {
  const [f, setF] = useState<any>(blank);
  const toast = useToast();
  useEffect(() => { if (open) setF(initial ? { ...initial } : blank); }, [open, initial]);
  const save = useSave(() => api.put("/mortgage", { ...f, override_date: f.balance_override != null ? f.override_date || today() : null }), () => { toast("Hipoteca guardada"); onClose(); });
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Datos de la hipoteca" wide>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <Field label="Nombre"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Capital inicial (€)"><NumberInput value={f.initial_principal} onChange={(v) => setF({ ...f, initial_principal: v })} required min={1} /></Field>
        <Field label="Tipo de interés anual (%)"><NumberInput value={f.annual_rate} onChange={(v) => setF({ ...f, annual_rate: v })} required min={0} /></Field>
        <Field label="Cuota mensual (€)" hint="Déjala vacía para calcularla (sistema francés)."><NumberInput value={f.monthly_payment} onChange={(v) => setF({ ...f, monthly_payment: v })} min={0} /></Field>
        <Field label="Fecha de inicio"><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} required /></Field>
        <Field label="Fecha de fin"><Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} required /></Field>
        <Field label="Capital pendiente real (opcional)" hint="Si tu banco te indica el capital pendiente exacto, el cuadro se re-ancla a ese valor."><NumberInput value={f.balance_override} onChange={(v) => setF({ ...f, balance_override: v })} min={0} /></Field>
        <Field label="…a fecha"><Input type="date" value={f.override_date ?? ""} onChange={(e) => setF({ ...f, override_date: e.target.value })} disabled={f.balance_override == null} /></Field>
        <Field label="Valor de la vivienda (opcional)" hint="Para calcular el LTV. Para sumarla al patrimonio añádela en Patrimonio › Otros activos."><NumberInput value={f.property_value} onChange={(v) => setF({ ...f, property_value: v })} min={0} /></Field>
        <div className="flex items-end justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={save.isPending}>Guardar</Button></div>
        {save.error && <p className="text-sm text-danger sm:col-span-2">{(save.error as Error).message}</p>}
      </form>
    </Modal>
  );
}

function Simulator() {
  const [mode, setMode] = useState<"once" | "monthly">("once");
  const [strategy, setStrategy] = useState<"term" | "payment">("term");
  const [custom, setCustom] = useState<number | null>(1000);
  const amounts = [50, 100, 200, ...(custom ? [custom] : [])];
  const scenarios = amounts.map((extra) => ({ extra, mode, strategy: mode === "monthly" ? "term" : strategy }));
  const [res, setRes] = useState<any[] | null>(null);
  useEffect(() => {
    let live = true;
    api.post("/mortgage/simulate", { scenarios }).then((r) => live && setRes(r)).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, strategy, custom]);
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>Simulador de amortización anticipada</CardTitle><CardDescription>¿Cuánto ahorrarías en intereses si amortizas más?</CardDescription></div>
        <div className="flex flex-wrap items-end gap-3">
          <Tabs value={mode} onChange={setMode} items={[{ value: "once", label: "Una sola vez" }, { value: "monthly", label: "Cada mes" }]} />
          {mode === "once" && <Tabs value={strategy} onChange={setStrategy} items={[{ value: "term", label: "Reducir plazo" }, { value: "payment", label: "Reducir cuota" }]} />}
          <Field label="Importe personalizado (€)"><NumberInput value={custom} onChange={setCustom} min={0} className="w-36" /></Field>
        </div>
      </CardHeader>
      <CardContent>
        {res && (
          <Table>
            <thead><tr className="border-b"><Th>Amortización</Th><Th className="text-right">Nueva cuota</Th><Th className="text-right">Plazo ahorrado</Th><Th>Nueva fecha fin</Th><Th className="text-right">Intereses totales</Th><Th className="text-right">Ahorro total</Th></tr></thead>
            <tbody>
              {res.map((r, i) => (
                <Tr key={i}>
                  <Td className="font-medium">{money(r.extra, false)}{mode === "monthly" ? "/mes" : ""}{i === 3 && <Badge className="ml-2">personalizada</Badge>}</Td>
                  <Td className="tabular text-right">{money(r.new_payment)}</Td>
                  <Td className="tabular text-right">{r.months_saved > 0 ? yearsMonths(r.months_saved) : "—"}</Td>
                  <Td>{dateEs(r.new_end_date)}</Td>
                  <Td className="tabular text-right">{money(r.interest, false)}</Td>
                  <Td className="tabular text-right font-semibold text-success">{money(r.interest_saved, false)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Comparado con seguir pagando el cuadro actual. {mode === "once" ? "Una sola amortización parcial hoy." : "Una cantidad extra cada mes sobre la cuota (reduce el plazo)."} No incluye comisiones de amortización anticipada.</p>
      </CardContent>
    </Card>
  );
}

export default function Mortgage() {
  const { data, isLoading, error } = useGet<any>("/mortgage");
  const sched = useGet<any[]>("/mortgage/schedule", undefined, !!data?.mortgage);
  const [edit, setEdit] = useState(false);
  const [filter, setFilter] = useState<"all" | "paid" | "pending">("pending");
  const [page, setPage] = useState(0);
  const rows = useMemo(() => (sched.data ?? []).filter((r) => filter === "all" || (filter === "paid") === r.paid), [sched.data, filter]);
  const yearly = useMemo(() => {
    const m = new Map<number, { year: number; interest: number; principal: number }>();
    (sched.data ?? []).forEach((r) => { const y = +r.date.slice(0, 4); const e = m.get(y) ?? { year: y, interest: 0, principal: 0 }; e.interest += r.interest; e.principal += r.principal; m.set(y, e); });
    return [...m.values()].map((e) => ({ ...e, interest: Math.round(e.interest), principal: Math.round(e.principal) }));
  }, [sched.data]);
  const balanceSeries = useMemo(() => (sched.data ?? []).filter((_, i) => i % 3 === 0).map((r) => ({ date: r.date.slice(0, 7), balance: r.balance })), [sched.data]);
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const m = data.mortgage, s = data.summary;
  if (!m) return (<><PageHeader title="Hipoteca" /><Empty icon={Home} title="Aún no has configurado tu hipoteca" text="Introduce capital, interés y fechas para ver el cuadro de amortización y simular amortizaciones anticipadas." action={<Button onClick={() => setEdit(true)}>Configurar hipoteca</Button>} /><MortgageForm open={edit} onClose={() => setEdit(false)} initial={null} /></>);
  const pageSize = 24, pages = Math.max(Math.ceil(rows.length / pageSize), 1);
  return (
    <>
      <PageHeader title={m.name} description={`${m.annual_rate} % · capital inicial ${money(m.initial_principal, false)} · ${dateEs(m.start_date)} → ${dateEs(m.end_date)}`} actions={<Button variant="outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Editar</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Capital pendiente" value={money(s.pending_balance, false)} sub={m.property_value ? `LTV ${pct(s.ltv_pct)}` : undefined} />
        <Stat label="Cuota mensual" value={money(s.monthly_payment)} sub={`${s.payments_remaining} cuotas restantes (${yearsMonths(s.payments_remaining)})`} />
        <Stat label="Intereses pagados" value={money(s.interest_paid, false)} sub={`${s.payments_made} cuotas pagadas`} />
        <Stat label="Intereses futuros" value={money(s.interest_future, false)} sub={`Coste restante total ${money(s.total_remaining_cost, false)}`} />
      </div>
      <Card className="mt-4 p-5">
        <div className="mb-2 flex justify-between text-sm"><span className="font-medium">Capital amortizado {money(s.amortized_capital, false)}</span><span className="text-muted-foreground">{pct(s.progress_pct)} · fin previsto {dateEs(s.end_date_effective)}</span></div>
        <Progress value={s.progress_pct} tone="success" />
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><div><CardTitle>Capital pendiente</CardTitle><CardDescription>Según el cuadro de amortización</CardDescription></div></CardHeader><CardContent><AreaTrend data={balanceSeries} xKey="date" series={[{ key: "balance", label: "Capital pendiente", color: S(1) }]} xFmt={(v) => String(v).slice(0, 4)} /></CardContent></Card>
        <Card><CardHeader><div><CardTitle>Capital vs. intereses por año</CardTitle><CardDescription>Cómo se reparte lo que pagas</CardDescription></div></CardHeader><CardContent><Bars stacked data={yearly} xKey="year" series={[{ key: "principal", label: "Capital", color: S(3) }, { key: "interest", label: "Intereses", color: S(2) }]} /></CardContent></Card>
      </div>
      <div className="mt-4"><Simulator /></div>
      <Card className="mt-4">
        <CardHeader>
          <div><CardTitle>Tabla de amortización</CardTitle><CardDescription>{rows.length} cuotas · calculada teóricamente{m.balance_override != null ? " con re-anclaje al capital real indicado" : ""}</CardDescription></div>
          <Tabs value={filter} onChange={(v) => { setFilter(v); setPage(0); }} items={[{ value: "pending", label: "Pendientes" }, { value: "paid", label: "Pagadas" }, { value: "all", label: "Todas" }]} />
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <thead><tr className="border-b"><Th>Nº</Th><Th>Fecha</Th><Th className="text-right">Cuota</Th><Th className="text-right">Intereses</Th><Th className="text-right">Capital</Th><Th className="text-right">Pendiente</Th></tr></thead>
            <tbody>{rows.slice(page * pageSize, (page + 1) * pageSize).map((r) => (
              <Tr key={r.n} className={r.paid ? "text-muted-foreground" : ""}><Td>{r.n}</Td><Td>{dateEs(r.date)}</Td><Td className="tabular text-right">{money(r.payment)}</Td><Td className="tabular text-right">{money(r.interest)}</Td><Td className="tabular text-right">{money(r.principal)}</Td><Td className="tabular text-right">{money(r.balance)}</Td></Tr>
            ))}</tbody>
          </Table>
          <div className="flex items-center justify-between px-4 pt-3 text-sm text-muted-foreground"><span>Página {page + 1} de {pages}</span><span className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Siguiente</Button></span></div>
        </CardContent>
      </Card>
      <MortgageForm open={edit} onClose={() => setEdit(false)} initial={m} />
    </>
  );
}
