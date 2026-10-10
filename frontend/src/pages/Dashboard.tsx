import { Banknote, Coins, Landmark, PiggyBank, Plus, Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AreaTrend, Bars, Donut, S } from "@/components/charts/charts";
import { Empty, ErrorBox, Loading, PageHeader, Recommendations, Stat } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useGet, useSave } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { compactMoney, money, monthLabel, pct } from "@/lib/format";

export default function Dashboard() {
  const nav = useNavigate();
  const { data: d, isLoading, error } = useGet<any>("/dashboard");
  const [view, setView] = useState<"monthly" | "yearly">("monthly");
  const toast = useToast();
  const demo = useSave(() => api.post("/data/demo"), () => toast("Datos de ejemplo cargados"));
  if (isLoading) return <Loading />;
  if (error || !d) return <ErrorBox error={error} />;
  if (d.empty)
    return (
      <>
        <PageHeader title="Bienvenido 👋" description="Empieza creando tu primera cuenta, o explora la app con datos de ejemplo." />
        <Empty icon={Wallet} title="Aún no hay datos" text="Crea tus cuentas, registra ingresos y gastos o importa el CSV de tu banco. Puedes cargar datos de ejemplo y borrarlos después desde Ajustes."
          action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => nav("/cuentas")}><Plus className="h-4 w-4" />Crear cuenta</Button><Button variant="outline" onClick={() => demo.mutate(undefined)} disabled={demo.isPending}>Cargar datos de ejemplo</Button></div>} />
      </>
    );
  const k = d.kpis, b = d.breakdown;
  const series = d.series.map((r: any) => ({ ...r, label: monthLabel(r.month, true) }));
  const savingsRate = k.income_prev_month ? ((k.income_prev_month - k.expenses_prev_month) / k.income_prev_month) * 100 : null;
  const assetsDonut = [
    { name: "Cuentas y efectivo", value: b.cash, color: S(1) }, { name: "Remunerada / ahorro", value: b.savings, color: S(3) },
    { name: "Inversiones", value: b.investments, color: S(2) }, { name: "Otros activos", value: b.other_assets, color: S(4) },
  ].filter((x) => x.value > 0);
  return (
    <>
      <PageHeader title="Dashboard" description="Tu situación financiera de un vistazo." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Patrimonio neto" value={money(k.net_worth, false)} delta={k.net_worth_change_month} sub="vs mes anterior" icon={Landmark} className="sm:col-span-2 xl:col-span-1" />
        <Stat label="Activos totales" value={money(k.assets, false)} icon={TrendingUp} sub={`Año: ${k.net_worth_change_year >= 0 ? "+" : ""}${money(k.net_worth_change_year, false)} patrimonio`} />
        <Stat label="Pasivos totales" value={money(k.liabilities, false)} icon={Scale} sub="Hipoteca y deudas" />
        <Stat label="Saldo disponible" value={money(k.available, false)} icon={Wallet} sub="Cuentas corrientes y efectivo" />
        <Stat label="Ahorro acumulado" value={money(k.accumulated_savings, false)} icon={PiggyBank} sub={`Remunerada ${compactMoney(k.savings_accounts)} · Inversión ${compactMoney(k.investments)}`} />
        <Stat label="Capacidad de ahorro mensual" value={money(k.monthly_saving_capacity, false)} icon={Coins} tone={k.monthly_saving_capacity >= 0 ? "pos" : "neg"} sub={savingsRate != null ? `Tasa de ahorro mes anterior: ${pct(savingsRate, 0)}` : "Media de los últimos 3 meses"} />
        <Stat label="Ingresos este mes" value={money(k.income_month, false)} icon={TrendingUp} sub={`Mes anterior ${money(k.income_prev_month, false)}`} />
        <Stat label="Gastos este mes" value={money(k.expenses_month, false)} icon={TrendingDown} sub={`Mes anterior ${money(k.expenses_prev_month, false)}`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Evolución del patrimonio neto</CardTitle><CardDescription>Últimos 12 meses · activos − pasivos</CardDescription></div></CardHeader>
          <CardContent><AreaTrend data={series} xKey="label" series={[{ key: "net_worth", label: "Patrimonio neto", color: S(1) }]} zero={false} /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Composición de activos</CardTitle><CardDescription>Dónde está tu dinero</CardDescription></div></CardHeader>
          <CardContent>
            <Donut data={assetsDonut} center={{ label: "Activos", value: compactMoney(k.assets) }} />
            <ul className="mt-2 space-y-1 text-xs">
              {assetsDonut.map((x) => (
                <li key={x.name} className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: x.color }} />{x.name}</span><span className="tabular">{money(x.value, false)}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div><CardTitle>Ingresos y gastos</CardTitle><CardDescription>{view === "monthly" ? "Por mes" : "Por año"}</CardDescription></div>
            <Tabs value={view} onChange={setView} items={[{ value: "monthly", label: "Mensual" }, { value: "yearly", label: "Anual" }]} />
          </CardHeader>
          <CardContent>
            {view === "monthly" ? (
              <Bars data={series} xKey="label" series={[{ key: "income", label: "Ingresos", color: S(1) }, { key: "expenses", label: "Gastos", color: S(2) }]} />
            ) : (
              <Bars data={d.yearly} xKey="year" series={[{ key: "income", label: "Ingresos", color: S(1) }, { key: "expenses", label: "Gastos", color: S(2) }]} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Evolución del ahorro</CardTitle><CardDescription>Ingresos − gastos {view === "monthly" ? "por mes" : "por año"}</CardDescription></div></CardHeader>
          <CardContent>
            {view === "monthly" ? (
              <Bars data={series} xKey="label" series={[{ key: "savings_flow", label: "Ahorro", color: S(3) }]} />
            ) : (
              <Bars data={d.yearly} xKey="year" series={[{ key: "savings", label: "Ahorro", color: S(3) }]} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Gasto del mes por categoría</CardTitle></div><Link className="text-xs text-primary hover:underline" to="/gastos">Ver gastos</Link></CardHeader>
          <CardContent>
            {d.top_categories.length ? (
              <ul className="space-y-3">
                {d.top_categories.map((c: any) => {
                  const max = d.top_categories[0].amount;
                  return (
                    <li key={c.name}>
                      <div className="flex justify-between text-sm"><span>{c.icon} {c.name}</span><span className="tabular font-medium">{money(c.amount)}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${(c.amount / max) * 100}%`, background: c.color }} /></div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Aún no hay gastos este mes.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Recomendaciones</CardTitle></div><Link className="text-xs text-primary hover:underline" to="/recomendaciones">Ver todas</Link></CardHeader>
          <CardContent><Recommendations items={d.recommendations} /></CardContent>
        </Card>
      </div>
    </>
  );
}
