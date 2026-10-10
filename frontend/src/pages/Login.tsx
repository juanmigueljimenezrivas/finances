import { Banknote } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { api } from "@/lib/api";

export default function Login({ onLogin, allowRegistration }: { onLogin: (token: string) => void; allowRegistration: boolean }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ email: "", password: "", name: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api.post(mode === "login" ? "/auth/login" : "/auth/register", f);
      onLogin(r.access_token);
    } catch (x: any) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground"><Banknote className="h-4 w-4" /></div>
          <span className="text-lg font-semibold">Finanzas</span>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && <Field label="Nombre"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>}
          <Field label="Email"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></Field>
          <Field label="Contraseña" hint={mode === "register" ? "Mínimo 8 caracteres" : undefined}>
            <Input type="password" required minLength={mode === "register" ? 8 : 1} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </Field>
          {err && <p className="text-sm text-danger">{err}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{mode === "login" ? "Entrar" : "Crear cuenta"}</Button>
        </form>
        {allowRegistration && (
          <button className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "¿No tienes cuenta? Regístrate" : "Ya tengo cuenta"}
          </button>
        )}
      </Card>
    </div>
  );
}
