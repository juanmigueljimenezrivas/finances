import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Select } from "@/components/ui/form";
import { Badge, Table, Td, Th, Tr } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAccounts } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { dateEs, money } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

const NONE = "";
export default function ImportPage() {
  const accounts = useAccounts().data ?? [];
  const [file, setFile] = useState<File | null>(null);
  const [pv, setPv] = useState<any>(null);
  const [map, setMap] = useState<any>({});
  const [accountId, setAccountId] = useState("");
  const [opts, setOpts] = useState({ skip_duplicates: true, apply_rules: true, invert_sign: false, sync_balance: false });
  const [review, setReview] = useState<any>(null);
  const [done, setDone] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const qc = useQueryClient();
  const step = done ? 4 : review ? 3 : pv ? 2 : 1;

  const onFile = async (f: File) => {
    setFile(f); setErr(""); setBusy(true); setReview(null); setDone(null);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await api.upload("/import/preview", fd);
      setPv(r); setMap({ ...r.mapping, date_format: r.date_format, decimal: r.decimal });
    } catch (e: any) { setErr(e.message); setPv(null); } finally { setBusy(false); }
  };
  const commit = async (dry: boolean) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const body: any = { date: map.date, description: map.description || null, date_format: map.date_format, decimal: map.decimal, invert_sign: opts.invert_sign, balance: map.balance || null };
      if (map.amount) body.amount = map.amount; else { body.debit = map.debit; body.credit = map.credit; }
      const fd = new FormData();
      fd.append("file", file); fd.append("mapping", JSON.stringify(body)); fd.append("account_id", accountId); fd.append("header_row", String(pv.header_row));
      fd.append("dry_run", String(dry)); fd.append("skip_duplicates", String(opts.skip_duplicates)); fd.append("apply_rules", String(opts.apply_rules)); fd.append("sync_balance", String(opts.sync_balance && !!map.balance));
      const r = await api.upload("/import/commit", fd);
      if (dry) setReview(r); else { setDone(r); qc.invalidateQueries(); toast(`${r.created} movimientos importados`); }
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const colSelect = (key: string, label: string, optional = false) => (
    <Field label={label}><Select value={map[key] ?? NONE} onChange={(e) => setMap({ ...map, [key]: e.target.value || null })}>{optional && <option value={NONE}>— no usar —</option>}{!optional && !map[key] && <option value={NONE}>Selecciona…</option>}{pv.columns.filter(Boolean).map((c: string) => <option key={c} value={c}>{c}</option>)}</Select></Field>
  );
  const split = !map.amount && (map.debit || map.credit);
  const ready = pv && map.date && (map.amount || (map.debit && map.credit) || map.debit || map.credit) && accountId;
  const reset = () => { setFile(null); setPv(null); setReview(null); setDone(null); setErr(""); if (input.current) input.current.value = ""; };

  return (
    <>
      <PageHeader title="Importar movimientos" description="CSV bancarios o Excel (.xlsx). Detectamos columnas, formato de fecha y decimales; puedes ajustarlos antes de importar." />
      <div className="mb-4 flex gap-2 text-xs">{["1 · Archivo", "2 · Columnas", "3 · Revisión", "4 · Hecho"].map((s, i) => <Badge key={s} tone={step === i + 1 ? "info" : step > i + 1 ? "success" : "default"}>{s}</Badge>)}</div>
      {err && <div className="mb-4 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{err}</div>}

      {step === 1 && (
        <Card><CardContent className="pt-5">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center transition hover:bg-accent/40" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && onFile(e.dataTransfer.files[0]); }}>
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <span className="font-medium">{busy ? "Analizando…" : "Arrastra tu archivo aquí o haz clic para elegirlo"}</span>
            <span className="mt-1 text-sm text-muted-foreground">.csv, .xlsx · máx. 10 MB</span>
            <input ref={input} type="file" accept=".csv,.xlsx,.xlsm,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        </CardContent></Card>
      )}

      {step === 2 && pv && (
        <>
          <Card><CardHeader><div><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />{file?.name}</CardTitle><CardDescription>{pv.total_rows} filas detectadas · revisa el mapeo automático</CardDescription></div><Button variant="outline" size="sm" onClick={reset}>Cambiar archivo</Button></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {colSelect("date", "Columna de fecha")}
              {colSelect("description", "Columna de concepto", true)}
              {colSelect("amount", "Columna de importe (con signo)", true)}
              {colSelect("balance", "Columna de saldo (opcional)", true)}
              {!map.amount && <>{colSelect("debit", "Columna de cargos (gastos)", true)}{colSelect("credit", "Columna de abonos (ingresos)", true)}</>}
              <Field label="Formato de fecha"><Select value={map.date_format ?? ""} onChange={(e) => setMap({ ...map, date_format: e.target.value || null })}><option value="">Automático</option>{["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%y", "%d.%m.%Y", "%m/%d/%Y"].map((f) => <option key={f} value={f}>{f.replace("%d", "dd").replace("%m", "mm").replace("%Y", "aaaa").replace("%y", "aa")}</option>)}</Select></Field>
              <Field label="Separador decimal"><Select value={map.decimal ?? ","} onChange={(e) => setMap({ ...map, decimal: e.target.value })}><option value=",">Coma (1.234,56)</option><option value=".">Punto (1,234.56)</option></Select></Field>
              <Field label="Cuenta destino"><Select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">Selecciona…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
              <div className="flex flex-col justify-end gap-2 sm:col-span-2">
                <Checkbox checked={opts.apply_rules} onChange={(v) => setOpts({ ...opts, apply_rules: v })} label="Categorizar automáticamente con mis reglas" />
                <Checkbox checked={opts.skip_duplicates} onChange={(v) => setOpts({ ...opts, skip_duplicates: v })} label="Omitir movimientos ya importados (duplicados)" />
                {map.balance && <Checkbox checked={opts.sync_balance} onChange={(v) => setOpts({ ...opts, sync_balance: v })} label="Cuadrar el saldo de la cuenta con el último saldo del archivo" />}
                <Checkbox checked={opts.invert_sign} onChange={(v) => setOpts({ ...opts, invert_sign: v })} label="Invertir signo (el banco muestra los gastos en positivo)" />
              </div>
            </CardContent></Card>
          <Card className="mt-4"><CardHeader><CardTitle>Vista previa del archivo</CardTitle></CardHeader><CardContent className="px-0"><Table><thead><tr className="border-b">{pv.columns.map((c: string, i: number) => <Th key={i} className={[map.date, map.description, map.amount, map.debit, map.credit, map.balance].includes(c) ? "text-primary" : ""}>{c}</Th>)}</tr></thead><tbody>{pv.sample.map((r: string[], i: number) => <Tr key={i}>{pv.columns.map((_: any, j: number) => <Td key={j} className="max-w-[220px] truncate">{r[j]}</Td>)}</Tr>)}</tbody></Table></CardContent></Card>
          <div className="mt-4 flex justify-end"><Button disabled={!ready || busy} onClick={() => commit(true)}>{busy ? "Procesando…" : "Revisar importación"}</Button></div>
          {split && null}
        </>
      )}

      {step === 3 && review && (
        <Card>
          <CardHeader><div><CardTitle>Revisión</CardTitle><CardDescription>{review.total} movimientos · {review.categorized} categorizados · <b>{review.duplicates}</b> duplicados {opts.skip_duplicates ? "(se omitirán)" : ""} · {review.error_count} filas con error</CardDescription></div>
            <div className="text-right text-sm">{review.closing_balance != null && <div className="text-muted-foreground">Saldo final: {money(review.closing_balance)}</div>}<div className="text-success">+{money(review.income)}</div><div>−{money(review.expenses)}</div></div></CardHeader>
          <CardContent className="px-0">
            <div className="max-h-[420px] overflow-y-auto"><Table><thead className="sticky top-0 bg-card"><tr className="border-b"><Th>Fecha</Th><Th>Concepto</Th><Th>Categoría</Th><Th className="text-right">Importe</Th><Th /></tr></thead><tbody>{review.rows.map((r: any, i: number) => <Tr key={i} className={r.duplicate ? "opacity-50" : ""}><Td>{dateEs(r.date)}</Td><Td className="max-w-[320px] truncate">{r.description}</Td><Td>{r.category ?? <Badge tone="warning">Sin categoría</Badge>}</Td><Td className={`tabular text-right ${r.type === "income" ? "text-success" : ""}`}>{r.type === "income" ? "+" : "−"}{money(r.amount)}</Td><Td>{r.duplicate && <Badge>Duplicado</Badge>}</Td></Tr>)}</tbody></Table></div>
            {review.total > review.rows.length && <p className="px-4 pt-2 text-xs text-muted-foreground">Mostrando las primeras {review.rows.length} filas.</p>}
            {review.errors.length > 0 && <details className="px-4 pt-2 text-xs text-warning"><summary>Ver errores ({review.error_count})</summary>{review.errors.map((e: string) => <div key={e}>{e}</div>)}</details>}
            <div className="flex justify-between px-4 pt-4"><Button variant="outline" onClick={() => setReview(null)}>Volver al mapeo</Button><Button disabled={busy} onClick={() => commit(false)}>Importar {opts.skip_duplicates ? review.total - review.duplicates : review.total} movimientos</Button></div>
          </CardContent>
        </Card>
      )}

      {step === 4 && done && (
        <Card><CardContent className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
          <h3 className="text-lg font-semibold">{done.created} movimientos importados</h3>
          <p className="mt-1 text-sm text-muted-foreground">{done.duplicates} duplicados omitidos · {done.categorized} categorizados automáticamente{done.balance_synced != null && ` · saldo de la cuenta cuadrado a ${money(done.balance_synced)}`}</p>
          <div className="mt-6 flex gap-2"><Button onClick={reset} variant="outline">Importar otro archivo</Button><Link to="/movimientos"><Button>Ver movimientos</Button></Link></div>
        </CardContent></Card>
      )}
    </>
  );
}
