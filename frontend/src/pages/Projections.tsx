import { useEffect, useState } from "react";
import { Lines, S } from "@/components/charts/charts";
import { ErrorBox, Loading, PageHeader } from "@/components/common";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, NumberInput } from "@/components/ui/form";
import { Table, Td, Th, Tabs, Tr } from "@/components/ui/misc";
import { useGet } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { money, pct } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";

const COLORS: Record<string, string> = { conservative: S(2), realistic: S(1), optimistic: S(3) };

export default function Projections() {
  const settings = useGet<any>("/settings").data;
  const [monthly, setMonthly] = useState<number | null>(null);
  const [initial, setInitial] = useState<number | null>(null);
  const [years, setYears] = useState<number | null>(20);
  const [real, setReal] = useState(false);
  const [rates, setRates] = useState<Record<string, number | null>>({});
  const [metric, setMetric] = useState<"net_worth" | "financial_assets">("net_worth");
  useEffect(() => { if (settings) setRates({ conservative: settings.return_conservative, realistic: settings.return_realistic, optimistic: settings.return_optimistic }); }, [settings]);
  const body = { monthly_saving: monthly, initial_assets: initial, years: years ?? 20, real_terms: real, returns: Object.fromEntries(Object.entries(rates).filter(([, v]) => v != null)) };
  const { data, isLoading, error } = useQuery({ queryKey: ["/projections", body], queryFn: () => api.post<any>("/projections", body), enabled: !!settings, placeholderData: (p) => p });
  if (isLoading || !data) return error ? <ErrorBox error={error} /> : <Loading />;
  const names: Record<string, string> = { conservative: "Conservador", realistic: "Realista", optimistic: "Optimista" };
  const chart = data.scenarios[0].points.map((_: any, i: number) => ({ year: `Año ${i}`, ...Object.fromEntries(data.scenarios.map((s: any) => [s.key, s.points[i][metric]])) }));
  const hs = Object.keys(data.scenarios[0].horizons);
  return (
    <>
      <PageHeader title="Proyecciones" description="Cómo evolucionará tu patrimonio según ahorro mensual, interés compuesto, rentabilidad esperada y amortización de la hipoteca." />
      <Card className="mb-4"><CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Ahorro mensual (€)" hint={`Vacío = tu media real (${money(data.monthly_saving, false)})`}><NumberInput value={monthly} onChange={setMonthly} placeholder={String(data.monthly_saving)} /></Field>
        <Field label="Activos financieros iniciales (€)" hint={`Vacío = actuales (${money(data.initial_assets, false)})`}><NumberInput value={initial} onChange={setInitial} placeholder={String(data.initial_assets)} /></Field>
        <Field label="Horizonte (años)"><NumberInput value={years} onChange={setYears} min={1} /></Field>
        <div className="flex items-end"><Checkbox checked={real} onChange={setReal} label={`Valores reales (descontar inflación ${pct(data.inflation)})`} /></div>
        {data.scenarios.map((s: any) => <Field key={s.key} label={`Rentabilidad ${names[s.key].toLowerCase()} (% anual)`}><NumberInput value={rates[s.key] ?? null} onChange={(v) => setRates({ ...rates, [s.key]: v })} /></Field>)}
      </CardContent></Card>
      <Card><CardHeader><div><CardTitle>Evolución proyectada</CardTitle><CardDescription>{metric === "net_worth" ? "Patrimonio neto (activos − hipoteca y deudas)" : "Activos financieros (cuentas + inversiones)"}{real ? " · en euros de hoy" : ""}</CardDescription></div><Tabs value={metric} onChange={setMetric} items={[{ value: "net_worth", label: "Patrimonio neto" }, { value: "financial_assets", label: "Activos financieros" }]} /></CardHeader><CardContent>
        <Lines data={chart} xKey="year" height={320} series={data.scenarios.map((s: any) => ({ key: s.key, label: `${names[s.key]} (${pct(s.annual_return, 1)})`, color: COLORS[s.key] }))} />
      </CardContent></Card>
      <Card className="mt-4"><CardHeader><CardTitle>Resultados por horizonte</CardTitle></CardHeader><CardContent className="px-0">
        <Table>
          <thead><tr className="border-b"><Th>Escenario</Th>{hs.map((h) => <Th key={h} className="text-right">{h} {h === "1" ? "año" : "años"}</Th>)}</tr></thead>
          <tbody>{data.scenarios.map((s: any) => (
            <Tr key={s.key}>
              <Td><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[s.key] }} />{names[s.key]}</span></Td>
              {hs.map((h) => <Td key={h} className="text-right"><div className="tabular font-semibold">{money(s.horizons[h].net_worth, false)}</div><div className="tabular text-xs text-muted-foreground">fin. {money(s.horizons[h].financial_assets, false)} · hip. {money(s.horizons[h].mortgage, false)}</div><div className="tabular text-xs text-success">+{money(s.horizons[h].growth, false)} rentab.</div></Td>)}
            </Tr>
          ))}</tbody>
        </Table>
        <p className="px-4 pt-3 text-xs text-muted-foreground">Rentabilidad con interés compuesto mensual. «fin.» = activos financieros; «hip.» = hipoteca pendiente según su cuadro de amortización; los otros activos y deudas se mantienen constantes. Son estimaciones, no garantías.</p>
      </CardContent></Card>
    </>
  );
}
