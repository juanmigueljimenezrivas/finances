import { BarChart3, Banknote, CalendarClock, Flame, Gauge, Home, Landmark, LayoutDashboard, LineChart, LogOut, Menu, Moon, PiggyBank, Receipt, Settings, ShieldCheck, Sparkles, Sun, Target, TrendingDown, TrendingUp, Upload, Wallet, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const NAV = [
  { group: "Resumen", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { to: "/recomendaciones", label: "Recomendaciones", icon: Sparkles }] },
  { group: "Día a día", items: [
    { to: "/movimientos", label: "Movimientos", icon: Receipt }, { to: "/ingresos", label: "Ingresos", icon: TrendingUp }, { to: "/gastos", label: "Gastos", icon: TrendingDown },
    { to: "/presupuestos", label: "Presupuestos", icon: Gauge }, { to: "/importar", label: "Importar", icon: Upload } ] },
  { group: "Patrimonio", items: [
    { to: "/cuentas", label: "Cuentas", icon: Wallet }, { to: "/remunerada", label: "Cuenta remunerada", icon: PiggyBank }, { to: "/hipoteca", label: "Hipoteca", icon: Home },
    { to: "/inversiones", label: "Inversiones", icon: LineChart }, { to: "/patrimonio", label: "Patrimonio neto", icon: Landmark } ] },
  { group: "Planificación", items: [
    { to: "/emergencia", label: "Fondo emergencia", icon: ShieldCheck }, { to: "/objetivos", label: "Objetivos", icon: Target },
    { to: "/proyecciones", label: "Proyecciones", icon: BarChart3 }, { to: "/fire", label: "Simulador FIRE", icon: Flame } ] },
  { group: "Sistema", items: [{ to: "/ajustes", label: "Ajustes y datos", icon: Settings }] },
];

export function Layout({ onLogout, authEnabled }: { onLogout?: () => void; authEnabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const { dark, setTheme } = useTheme();
  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</div>
          {g.items.map((i) => (
            <NavLink key={i.to} to={i.to} onClick={() => setOpen(false)} className={({ isActive }) => cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors", isActive ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              <i.icon className="h-4 w-4" />
              {i.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
  const brand = (
    <div className="flex h-14 items-center gap-2 px-5">
      <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground"><Banknote className="h-4 w-4" /></div>
      <span className="font-semibold tracking-tight">Finanzas</span>
    </div>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-card lg:flex">{brand}{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[260px] flex-col bg-card shadow-xl">
            <button className="absolute right-3 top-3 rounded p-1 hover:bg-accent" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X className="h-4 w-4" /></button>
            {brand}{nav}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur lg:px-8">
          <button className="rounded p-2 hover:bg-accent lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu className="h-5 w-5" /></button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex"><CalendarClock className="h-3.5 w-3.5" />{new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          <div className="flex items-center gap-1">
            <button className="rounded-md p-2 hover:bg-accent" onClick={() => setTheme(dark ? "light" : "dark")} aria-label="Cambiar tema" title="Cambiar tema">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {authEnabled && <button className="rounded-md p-2 hover:bg-accent" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut className="h-4 w-4" /></button>}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] p-4 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
