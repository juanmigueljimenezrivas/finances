import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, NumberInput, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useAccounts, useCategories, useSave } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { today } from "@/lib/format";
import type { Tx } from "@/lib/types";

type Form = { date: string; amount: number | null; type: Tx["type"]; account_id: number | ""; to_account_id: number | ""; category_id: number | ""; description: string; notes: string };
const blank = (type: Tx["type"]): Form => ({ date: today(), amount: null, type, account_id: "", to_account_id: "", category_id: "", description: "", notes: "" });

export function TransactionForm({ open, onClose, initial, type = "expense", lockType }: { open: boolean; onClose: () => void; initial?: Tx | null; type?: Tx["type"]; lockType?: boolean }) {
  const accounts = useAccounts().data ?? [];
  const cats = useCategories().data ?? [];
  const toast = useToast();
  const [f, setF] = useState<Form>(blank(type));
  useEffect(() => {
    if (!open) return;
    setF(initial ? { ...initial, account_id: initial.account_id, to_account_id: initial.to_account_id ?? "", category_id: initial.category_id ?? "" } : { ...blank(type), account_id: accounts[0]?.id ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, type]);
  const save = useSave(
    () => {
      const body = { ...f, account_id: Number(f.account_id), to_account_id: f.type === "transfer" ? Number(f.to_account_id) : null, category_id: f.type === "transfer" || f.category_id === "" ? null : Number(f.category_id) };
      return initial ? api.put(`/transactions/${initial.id}`, body) : api.post("/transactions", body);
    },
    () => { toast(initial ? "Movimiento actualizado" : "Movimiento guardado"); onClose(); }
  );
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const kinds = cats.filter((c) => c.kind === f.type);
  const title = f.type === "transfer" ? "Transferencia" : f.type === "income" ? "Ingreso" : "Gasto";
  const valid = f.amount && f.amount > 0 && f.account_id !== "" && (f.type !== "transfer" || (f.to_account_id !== "" && f.to_account_id !== f.account_id));
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={`${initial ? "Editar" : "Nuevo"} ${title.toLowerCase()}`}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(undefined); }}>
        {!lockType && (
          <Field label="Tipo" className="sm:col-span-2">
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Tx["type"], category_id: "" })}>
              <option value="expense">Gasto</option><option value="income">Ingreso</option><option value="transfer">Transferencia entre cuentas</option>
            </Select>
          </Field>
        )}
        <Field label="Fecha"><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} required /></Field>
        <Field label="Importe (€)"><NumberInput value={f.amount} onChange={(v) => set("amount", v)} min={0.01} required autoFocus /></Field>
        <Field label={f.type === "income" ? "Cuenta destino" : f.type === "transfer" ? "Cuenta origen" : "Cuenta"}>
          <Select value={f.account_id} onChange={(e) => set("account_id", e.target.value === "" ? "" : Number(e.target.value))} required>
            <option value="">Selecciona…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        {f.type === "transfer" ? (
          <Field label="Cuenta destino">
            <Select value={f.to_account_id} onChange={(e) => set("to_account_id", e.target.value === "" ? "" : Number(e.target.value))} required>
              <option value="">Selecciona…</option>{accounts.filter((a) => a.id !== f.account_id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label="Categoría" hint={!f.category_id && f.description ? "Si la dejas vacía se asignará automáticamente por reglas" : undefined}>
            <Select value={f.category_id} onChange={(e) => set("category_id", e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">Automática / sin categoría</option>{kinds.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Concepto" className="sm:col-span-2"><Input value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Ej. MERCADONA" maxLength={500} /></Field>
        <Field label="Notas" className="sm:col-span-2"><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!valid || save.isPending}>Guardar</Button>
        </div>
        {save.error && <p className="text-sm text-danger sm:col-span-2">{(save.error as Error).message}</p>}
      </form>
    </Modal>
  );
}
