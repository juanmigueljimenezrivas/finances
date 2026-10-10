import { ShieldCheck } from "lucide-react";
import { ErrorBox, Loading, PageHeader, Stat } from "@/components/common";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, Tabs } from "@/components/ui/misc";
import { useGet, useSave } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { money, pct, yearsMonths } from "@/lib/format";
import { Link } from "react-router-dom";

export default function Emergency() {
  const { data, isLoading, error } = useGet<any>("/emergency");
  const setTarget = useSave((m: number) => api.put(`/emergency/target?months=${m}`));
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const done = data.progress_pct >= 100;
  return (
    <>
      <PageHeader title="Fondo de emergencia" description="Cuántos meses de gastos puedes cubrir con tu dinero líquido de reserva." actions={<Tabs value={String(data.target_months)} onChange={(v) => setTarget.mutate(Number(v))} items={data.options.map((o: number) => ({ value: String(o), label: `${o} meses` }))} />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Gasto medio mensual" value={money(data.avg_monthly_expense, false)} sub="Últimos 6 meses completos" />
        <Stat label="Fondo actual" value={money(data.fund, false)} icon={ShieldCheck} />
        <Stat label="Meses cubiertos" value={data.months_covered ?? "—"} tone={done ? "pos" : undefined} sub={`Objetivo ${data.target_months} meses`} />
        <Stat label="Objetivo" value={money(data.target_amount, false)} sub={done ? "¡Objetivo cumplido!" : `Faltan ${money(data.missing, false)}`} />
      </div>
      <Card className="mt-4"><CardHeader><div><CardTitle>Progreso</CardTitle><CardDescription>{pct(data.progress_pct, 0)} del objetivo de {data.target_months} meses</CardDescription></div></CardHeader><CardContent>
        <Progress value={data.progress_pct} tone={done ? "success" : "primary"} className="h-4" />
        <div className="relative mt-1 h-4 text-[11px] text-muted-foreground">{data.options.map((o: number) => <span key={o} className="absolute -translate-x-1/2" style={{ left: `${Math.min((o / data.target_months) * 100, 100)}%` }}>{o} m</span>)}</div>
        {!done && data.months_to_target != null && <p className="mt-3 text-sm">Con tu ahorro mensual actual lo alcanzarás en <b>{yearsMonths(Math.ceil(data.months_to_target))}</b>.</p>}
        {!done && data.months_to_target == null && <p className="mt-3 text-sm text-warning">Tu ahorro mensual medio es cero o negativo: no se puede estimar cuándo lo alcanzarás.</p>}
      </CardContent></Card>
      <Card className="mt-4"><CardHeader><CardTitle>Cuentas que forman el fondo</CardTitle></CardHeader><CardContent>
        {data.accounts.length ? <ul className="divide-y text-sm">{data.accounts.map((a: any) => <li key={a.id} className="flex justify-between py-2"><span>{a.name}</span><span className="tabular">{money(a.balance)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Ninguna cuenta está marcada. Edita una cuenta en <Link className="text-primary underline" to="/cuentas">Cuentas</Link> y activa «Cuenta para el fondo de emergencia».</p>}
      </CardContent></Card>
    </>
  );
}
