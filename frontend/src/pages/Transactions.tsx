import { ArrowLeftRight, ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bars, Legend } from "@/components/charts/charts";
import { Amount, ConfirmDialog, Empty, ErrorBox, Loading, PageHeader, Stat } from "@/components/common";
import { TransactionForm } from "@/components/TransactionForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Badge, Table, Td, Th, Tr } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAccounts, useCategories, useGet, useSave } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { dateEs, money, monthLabel } from "@/lib/format";
import type { Tx } from "@/lib/types";

const PAGE = 25;
const TITLES = { all: "Movimientos", income: "Ingresos", expense: "Gastos" };
const DESC = { all: "Todo tu libro de movimientos: ingresos, gastos y transferencias.", income: "Registra y analiza todos tus ingresos.", expense: "Registra y analiza tus gastos por categoría y periodo." };

export default function Transactions({ kind }: { kind: "all" | "income" | "expense" }) {
  const accounts = useAccounts(true).data ?? [];
  const cats = useCategories().data ?? [];
  const toast = useToast();
  const [sp] = useSearchParams();
  const [filters, setFilters] = useState({ q: "", account_id: sp.get("account") ?? "", category_id: "", date_from: "", date_to: "", type: "", uncategorized: false });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [creating, setCreating] = useState<Tx["type"] | null>(null);
  const [toDelete, setToDelete] = useState<Tx | null>(null);
  const type = kind === "all" ? filters.type : kind;
  const params = { ...filters, type, uncategorized: filters.uncategorized || undefined, limit: PAGE, offset: page * PAGE };
  const { data, isLoading, error } = useGet<{ items: Tx[]; total: number; sum_income: number; sum_expense: number }>("/transactions", params);
  const flows = useGet<any>("/stats/flows", { kind, months: 12 }, kind !== "all");
  const del = useSave((id: number) => api.del(`/transactions/${id}`), () => { toast("Movimiento eliminado"); setToDelete(null); });
  const accName = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a.name])), [accounts]);
  const catMap = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c])), [cats]);
  const setF = (k: string, v: any) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };
  const pages = data ? Math.max(Math.ceil(data.total / PAGE), 1) : 1;
  const visibleCats = cats.filter((c) => kind === "all" || c.kind === kind);

  const fl = flows.data;
  const chartSeries = fl?.by_category.series.slice(0, 8) ?? [];
  const stackData = fl ? fl.by_category.months.map((m: string, i: number) => Object.fromEntries([["label", monthLabel(m, true)], ...chartSeries.map((s: any) => [`c${s.category_id}`, s.values[i]])])) : [];
  const word = kind === "income" ? "Ingresos" : "Gastos";

  return (
    <>
      <PageHeader title={TITLES[kind]} description={DESC[kind]} actions={
        <>
          <Button variant="outline" onClick={() => api.download("/export/transactions.csv", "movimientos.csv")}><Download className="h-4 w-4" />CSV</Button>
          {kind === "all" && <Button variant="outline" onClick={() => setCreating("transfer")}><ArrowLeftRight className="h-4 w-4" />Transferir</Button>}
          {kind === "all" && <Button variant="outline" onClick={() => setCreating("income")}><Plus className="h-4 w-4" />Ingreso</Button>}
          <Button onClick={() => setCreating(kind === "income" ? "income" : "expense")}><Plus className="h-4 w-4" />{kind === "income" ? "Nuevo ingreso" : kind === "expense" ? "Nuevo gasto" : "Gasto"}</Button>
        </>
      } />

      {fl && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={`${word} este mes`} value={money(fl.current_month, false)} sub={`Media mensual ${money(fl.average_month, false)}`} />
            <Stat label={`${word} ${fl.year} (acumulado)`} value={money(fl.year_to_date, false)} sub="Año natural en curso" />
            <Stat label="Mes anterior" value={money(fl.months[fl.months.length - 2]?.total ?? 0, false)} />
            <Stat label={`${word} por año`} value={fl.yearly.length ? money(fl.yearly[fl.yearly.length - 1].total, false) : "—"} sub={fl.yearly.map((y: any) => `${y.year}: ${money(y.total, false)}`).join(" · ")} />
          </div>
          {chartSeries.length > 0 && (
            <Card className="mb-4">
              <CardHeader><div><CardTitle>Evolución por categoría</CardTitle><CardDescription>Últimos 12 meses · principales categorías</CardDescription></div></CardHeader>
              <CardContent>
                <Bars data={stackData} xKey="label" stacked height={280} series={chartSeries.map((s: any) => ({ key: `c${s.category_id}`, label: `${s.icon} ${s.name}`, color: s.color }))} />
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar concepto…" value={filters.q} onChange={(e) => setF("q", e.target.value)} /></div>
          {kind === "all" && <Select value={filters.type} onChange={(e) => setF("type", e.target.value)}><option value="">Todos los tipos</option><option value="income">Ingresos</option><option value="expense">Gastos</option><option value="transfer">Transferencias</option></Select>}
          <Select value={filters.account_id} onChange={(e) => setF("account_id", e.target.value)}><option value="">Todas las cuentas</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          <Select value={filters.category_id} onChange={(e) => setF("category_id", e.target.value)}><option value="">Todas las categorías</option>{visibleCats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</Select>
          <Input type="date" value={filters.date_from} onChange={(e) => setF("date_from", e.target.value)} aria-label="Desde" />
          <Input type="date" value={filters.date_to} onChange={(e) => setF("date_to", e.target.value)} aria-label="Hasta" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={filters.uncategorized} onChange={(e) => setF("uncategorized", e.target.checked)} />Solo sin categoría</label>
        </div>
        {isLoading ? <div className="p-6"><Loading /></div> : error ? <div className="p-4"><ErrorBox error={error} /></div> : !data?.items.length ? (
          <div className="p-6"><Empty title="Sin movimientos" text="Registra el primero o importa el CSV de tu banco." action={<Button onClick={() => setCreating(kind === "income" ? "income" : "expense")}><Plus className="h-4 w-4" />Añadir</Button>} /></div>
        ) : (
          <>
            <Table>
              <thead><tr className="border-b"><Th>Fecha</Th><Th>Concepto</Th><Th>Categoría</Th><Th>Cuenta</Th><Th className="text-right">Importe</Th><Th className="w-20" /></tr></thead>
              <tbody>
                {data.items.map((t) => {
                  const c = t.category_id ? catMap[t.category_id] : null;
                  return (
                    <Tr key={t.id}>
                      <Td className="whitespace-nowrap text-muted-foreground">{dateEs(t.date)}</Td>
                      <Td className="max-w-[320px]"><div className="truncate">{t.description || <span className="text-muted-foreground">—</span>}</div>{t.notes && <div className="truncate text-xs text-muted-foreground">{t.notes}</div>}</Td>
                      <Td>{t.type === "transfer" ? <Badge>↔ Transferencia</Badge> : c ? <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.icon} {c.name}</span> : <Badge tone="warning">Sin categoría</Badge>}</Td>
                      <Td className="whitespace-nowrap text-muted-foreground">{t.type === "transfer" ? `${accName[t.account_id]} → ${accName[t.to_account_id!]}` : accName[t.account_id]}</Td>
                      <Td className="text-right"><Amount type={t.type} value={money(t.amount)} /></Td>
                      <Td className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(t)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setToDelete(t)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-sm text-muted-foreground">
              <span>{data.total} movimientos · <span className="text-success">+{money(data.sum_income)}</span> · <span>−{money(data.sum_expense)}</span> (filtro actual)</span>
              <span className="inline-flex items-center gap-1">
                <Button size="icon" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
                {page + 1} / {pages}
                <Button size="icon" variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} aria-label="Siguiente"><ChevronRight className="h-4 w-4" /></Button>
              </span>
            </div>
          </>
        )}
      </Card>
      <TransactionForm open={!!creating || !!editing} initial={editing} type={creating ?? "expense"} onClose={() => { setCreating(null); setEditing(null); }} />
      <ConfirmDialog open={!!toDelete} onCancel={() => setToDelete(null)} onConfirm={() => toDelete && del.mutate(toDelete.id)} title="¿Eliminar movimiento?" text={toDelete ? `${toDelete.description || "Sin concepto"} · ${money(toDelete.amount)}. El saldo de la cuenta se recalculará.` : ""} />
    </>
  );
}
