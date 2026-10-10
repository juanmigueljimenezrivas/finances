import { Flame } from "lucide-react";
import { useState } from "react";
import { Lines, S } from "@/components/charts/charts";
import { ErrorBox, Loading, PageHeader, Stat } from "@/components/common";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, NumberInput } from "@/components/ui/form";
import { Progress, Table, Td, Th, Tr } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { dateEs, money, pct } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";

export default function Fire() {
  const [f, setF] = useState<Record<string, number | null>>({ annual_expenses: null, savings_rate: null, expected_return: null, inflation: null, withdrawal_rate: null });
  const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v != null));
  const { data, isLoading, error } = useQuery({ queryKey: ["/fire", body], queryFn: () => api.post<any>("/fire", body), placeholderData: (p) => p });
  if (isLoading || !data) return error ? <ErrorBox error={error} /> : <Loading />;
  const set = (k: string) => (v: number | null) => setF({ ...f, [k]: v });
  return (
    <>
      <PageHeader title="Simulador FIRE" description="Independencia financiera: cuánto patrimonio necesitas para vivir de tus inversiones y cuándo lo alcanzarás." />
      <Card className="mb-4"><CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Gasto anual (€)" hint={`Vacío = media real (${money(data.annual_expenses, false)})`}><NumberInput value={f.annual_expenses} onChange={set("annual_expenses")} placeholder={String(data.annual_expenses)} /></Field>
        <Field label="Tasa de ahorro (%)" hint={`Vacío = real (${data.savings_rate_pct ?? "—"} %)`}><NumberInput value={f.savings_rate} onChange={set("savings_rate")} min={0} placeholder={String(data.savings_rate_pct ?? "")} /></Field>
        <Field label="Rentabilidad esperada (%)"><NumberInput value={f.expected_return} onChange={set("expected_return")} placeholder="ajustes" /></Field>
        <Field label="Inflación (%)"><NumberInput value={f.inflation} onChange={set("inflation")} placeholder="ajustes" /></Field>
        <Field label="Tasa de retirada (%)" hint="Regla del 4 %"><NumberInput value={f.withdrawal_rate} onChange={set("withdrawal_rate")} placeholder={String(data.withdrawal_rate)} min={0.5} /></Field>
      </CardContent></Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Gasto anual" value={money(data.annual_expenses, false)} sub={`Ahorro actual ${money(data.monthly_saving, false)}/mes`} />
        <Stat label="Patrimonio necesario (FIRE)" value={money(data.fire_number, false)} icon={Flame} sub={`Renta pasiva ${money(data.passive_income_monthly_at_fire, false)}/mes`} />
        <Stat label="Patrimonio actual" value={money(data.current_assets, false)} sub={pct(data.progress_pct, 1) + " del objetivo"} />
        <Stat label="Fecha estimada FIRE" value={data.reachable ? dateEs(data.fire_date) : "No alcanzable"} tone={data.reachable ? undefined : "neg"} sub={data.reachable ? `En ${data.years_to_fire} años` : "Aumenta tu ahorro o rentabilidad"} />
      </div>
      <Card className="mt-4 p-5"><div className="mb-2 text-sm font-medium">Progreso hacia FIRE</div><Progress value={data.progress_pct} tone="success" className="h-3" /></Card>
      <Card className="mt-4"><CardHeader><div><CardTitle>Camino hacia FIRE</CardTitle><CardDescription>En euros de hoy (rentabilidad real {pct(data.real_return, 2)}). Cuando el patrimonio cruza la línea objetivo, alcanzas FIRE.</CardDescription></div></CardHeader><CardContent>
        <Lines data={data.series.map((s: any) => ({ ...s, label: `Año ${s.year}` }))} xKey="label" series={[{ key: "wealth", label: "Patrimonio proyectado", color: S(1) }, { key: "target", label: "Objetivo FIRE", color: S(2), dashed: true }]} height={300} />
      </CardContent></Card>
      {data.by_savings_rate.length > 0 && (
        <Card className="mt-4"><CardHeader><div><CardTitle>Sensibilidad a la tasa de ahorro</CardTitle><CardDescription>Con tu ingreso medio ({money(data.avg_monthly_income, false)}/mes)</CardDescription></div></CardHeader><CardContent className="px-0">
          <Table><thead><tr className="border-b"><Th>Tasa de ahorro</Th><Th className="text-right">Años hasta FIRE</Th><Th className="text-right">Fecha</Th></tr></thead>
            <tbody>{data.by_savings_rate.map((r: any) => <Tr key={r.savings_rate}><Td>{r.savings_rate} %</Td><Td className="tabular text-right">{r.years ?? "—"}</Td><Td className="text-right">{dateEs(r.date)}</Td></Tr>)}</tbody></Table>
        </CardContent></Card>
      )}
    </>
  );
}
