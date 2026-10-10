import { ArrowLeftRight, Archive, History, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog, Empty, ErrorBox, Loading, PageHeader, Stat } from "@/components/common";
import { TransactionForm } from "@/components/TransactionForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Checkbox, Field, Input, NumberInput, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAccounts, useSave } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { dateEs, money, pct, today } from "@/lib/format";
import { ACCOUNT_TYPES, type Account } from "@/lib/types";

const blank = { name: "", bank: "", type: "checking", initial_balance: 0, opened_on: today(), interest_rate: null as number | null, include_in_emergency: false, is_archived: false, color: null };

function AccountForm({ account, open, onClose }: { account: Account | null; open: boolean; onClose: () => void }) {
  const [f, setF] = useState<any>(blank);
  const toast = useToast();
  useEffect(() => { if (open) setF(account ? { ...account } : blank); }, [open, account]);
  const save = useSave(() => (account ? api.put(`/accounts/${account.id}`, f) : api.post("/accounts", f)), () => { toast("Cuenta guardada"); onClose(); });
  const interest = f.type === "remunerated" || f.type === "savings";
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={account ? "Editar cuenta" : "Nueva cuenta"}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <Field label="Nombre"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></Field>
        <Field label="Banco"><Input value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></Field>
        <Field label="Tipo"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Fecha de alta"><Input type="date" value={f.opened_on} onChange={(e) => setF({ ...f, opened_on: e.target.value })} required /></Field>
        <Field label="Saldo a fecha de alta (€)" hint="Saldo al INICIO de esa fecha. Los movimientos posteriores lo modifican; importar movimientos anteriores no altera el saldo actual y permite reconstruir el histórico." className="sm:col-span-2">
          <NumberInput value={f.initial_balance} onChange={(v) => setF({ ...f, initial_balance: v ?? 0 })} />
        </Field>
        {interest && <Field label="Rentabilidad anual (TAE %)"><NumberInput value={f.interest_rate} onChange={(v) => setF({ ...f, interest_rate: v })} min={0} /></Field>}
        <div className="flex flex-col justify-end gap-2 sm:col-span-2">
          <Checkbox checked={f.include_in_emergency} onChange={(v) => setF({ ...f, include_in_emergency: v })} label="Cuenta para el fondo de emergencia" />
          {account && <Checkbox checked={f.is_archived} onChange={(v) => setF({ ...f, is_archived: v })} label="Archivada (oculta, conserva el histórico)" />}
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={save.isPending}>Guardar</Button></div>
        {save.error && <p className="text-sm text-danger sm:col-span-2">{(save.error as Error).message}</p>}
      </form>
    </Modal>
  );
}

export default function Accounts() {
  const nav = useNavigate();
  const { data, isLoading, error } = useAccounts(true);
  const [edit, setEdit] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [del, setDel] = useState<Account | null>(null);
  const toast = useToast();
  const remove = useSave((id: number) => api.del(`/accounts/${id}`), () => { toast("Cuenta eliminada"); setDel(null); });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const active = data.filter((a) => !a.is_archived), archived = data.filter((a) => a.is_archived);
  const total = active.reduce((s, a) => s + a.balance, 0);
  const card = (a: Account) => (
    <Card key={a.id} className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{a.name}</div>
          <div className="text-xs text-muted-foreground">{a.bank || "—"} · alta {dateEs(a.opened_on)}</div>
        </div>
        <Badge tone={a.type === "remunerated" ? "success" : "default"}>{ACCOUNT_TYPES[a.type]}</Badge>
      </div>
      <div className={`tabular mt-3 text-2xl font-semibold ${a.balance < 0 ? "text-danger" : ""}`}>{money(a.balance)}</div>
      <div className="mt-1 h-4 text-xs text-muted-foreground">{a.interest_rate ? `TAE ${pct(a.interest_rate, 2)}` : ""}{a.include_in_emergency ? " · fondo de emergencia" : ""}</div>
      <div className="mt-3 flex gap-1">
        <Button size="sm" variant="outline" onClick={() => nav(`/movimientos?account=${a.id}`)}><History className="h-3.5 w-3.5" />Histórico</Button>
        <Button size="icon" variant="ghost" onClick={() => setEdit(a)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={() => setDel(a)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
  return (
    <>
      <PageHeader title="Cuentas" description="Cuentas corrientes, remuneradas, ahorro y efectivo. Los saldos se calculan desde tus movimientos." actions={<><Button variant="outline" onClick={() => setTransfer(true)} disabled={active.length < 2}><ArrowLeftRight className="h-4 w-4" />Transferir</Button><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Nueva cuenta</Button></>} />
      {!data.length ? <Empty title="Sin cuentas" text="Crea tu primera cuenta para empezar a registrar movimientos." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Nueva cuenta</Button>} /> : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Stat label="Saldo total" value={money(total)} sub={`${active.length} cuentas activas`} />
            <Stat label="Corrientes y efectivo" value={money(active.filter((a) => ["checking", "cash", "other"].includes(a.type)).reduce((s, a) => s + a.balance, 0))} />
            <Stat label="Remuneradas y ahorro" value={money(active.filter((a) => ["remunerated", "savings"].includes(a.type)).reduce((s, a) => s + a.balance, 0))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{active.map(card)}</div>
          {archived.length > 0 && (<><h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Archive className="h-4 w-4" />Archivadas</h2><div className="grid gap-4 opacity-70 sm:grid-cols-2 xl:grid-cols-3">{archived.map(card)}</div></>)}
        </>
      )}
      <AccountForm open={creating || !!edit} account={edit} onClose={() => { setCreating(false); setEdit(null); }} />
      <TransactionForm open={transfer} type="transfer" lockType onClose={() => setTransfer(false)} />
      <ConfirmDialog open={!!del} onCancel={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} title={`¿Eliminar "${del?.name}"?`} text="Solo se puede eliminar si no tiene movimientos; si los tiene, archívala." />
      {remove.error && <p className="mt-2 text-sm text-danger">{(remove.error as Error).message}</p>}
    </>
  );
}
