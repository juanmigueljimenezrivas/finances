import { Coins, PiggyBank } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AreaTrend, S } from "@/components/charts/charts";
import { Empty, ErrorBox, Loading, PageHeader, Stat } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, NumberInput } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useGet, useSave } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { money, pct } from "@/lib/format";

export default function Savings() {
  const [contribution, setContribution] = useState<number | null>(0);
  const [years, setYears] = useState<number | null>(10);
  const { data, isLoading, error } = useGet<any>("/savings", { contribution: contribution ?? 0, years: years ?? 10 });
  const toast = useToast();
  const apply = useSave((id: number) => api.post(`/accounts/${id}/apply-interest`), (r: any) => toast(`Registrado ingreso de intereses: ${money(r.amount)}`));
  const combined = useMemo(() => {
    if (!data?.accounts.length) return [];
    const n = data.accounts[0].projection.length;
    return Array.from({ length: n }, (_, i) => ({
      year: `Año ${i}`,
      balance: data.accounts.reduce((s: number, a: any) => s + a.projection[i].balance, 0),
      contributions: data.accounts.reduce((s: number, a: any) => s + a.projection[i].contributions, 0),
    }));
  }, [data]);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  if (!data.accounts.length) return (<><PageHeader title="Cuenta remunerada" /><Empty icon={PiggyBank} title="No tienes cuentas remuneradas ni de ahorro" text="Crea una cuenta de tipo «Cuenta remunerada» e indica su TAE para calcular intereses y proyecciones." action={<Link to="/cuentas"><Button>Ir a cuentas</Button></Link>} /></>);
  const t = data.totals;
  return (
    <>
      <PageHeader title="Cuenta remunerada" description="Intereses estimados con la TAE de cada cuenta (capitalización mensual equivalente)." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Saldo remunerado" value={money(t.balance)} icon={PiggyBank} />
        <Stat label="Intereses mensuales" value={money(t.monthly_interest)} icon={Coins} />
        <Stat label="Intereses anuales" value={money(t.annual_interest)} sub="al saldo actual" />
        <Stat label="Intereses acumulados" value={money(t.accumulated_interest)} sub="ingresos categoría «Intereses»" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {data.accounts.map((a: any) => (
          <Card key={a.account_id} className="p-5">
            <div className="flex items-start justify-between"><div><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{a.bank} · TAE {pct(a.tae, 2)}</div></div><div className="tabular text-xl font-semibold">{money(a.balance)}</div></div>
            <div className="mt-3 grid grid-cols-3 text-sm"><div><div className="text-xs text-muted-foreground">Mensual</div>{money(a.monthly_interest)}</div><div><div className="text-xs text-muted-foreground">Anual</div>{money(a.annual_interest)}</div><div><div className="text-xs text-muted-foreground">Acumulado</div>{money(a.accumulated_interest)}</div></div>
            <Button className="mt-4" size="sm" variant="outline" disabled={!a.tae || apply.isPending} onClick={() => apply.mutate(a.account_id)}>Registrar intereses del mes</Button>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <CardHeader>
          <div><CardTitle>Proyección</CardTitle><CardDescription>Saldo futuro con interés compuesto</CardDescription></div>
          <div className="flex gap-3"><Field label="Aportación mensual (€)"><NumberInput value={contribution} onChange={setContribution} min={0} className="w-36" /></Field><Field label="Años"><NumberInput value={years} onChange={setYears} min={1} className="w-24" /></Field></div>
        </CardHeader>
        <CardContent>
          <AreaTrend data={combined} xKey="year" series={[{ key: "balance", label: "Saldo proyectado", color: S(3) }, { key: "contributions", label: "Aportado (capital)", color: S(1), dashed: true }]} />
          <Table className="mt-4">
            <thead><tr className="border-b"><Th>Horizonte</Th><Th className="text-right">Saldo</Th><Th className="text-right">Aportado</Th><Th className="text-right">Intereses</Th></tr></thead>
            <tbody>{combined.map((r, i) => [1, 3, 5, 10, 20].includes(i) && (<Tr key={i}><Td>{i} {i === 1 ? "año" : "años"}</Td><Td className="tabular text-right">{money(r.balance, false)}</Td><Td className="tabular text-right">{money(r.contributions, false)}</Td><Td className="tabular text-right text-success">{money(r.balance - r.contributions, false)}</Td></Tr>))}</tbody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
