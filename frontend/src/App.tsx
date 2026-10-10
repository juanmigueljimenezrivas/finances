import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Loading } from "./components/common";
import { getToken, setToken } from "./lib/api";
import { useGet } from "./hooks/useApi";
import Accounts from "./pages/Accounts";
import Budgets from "./pages/Budgets";
import Dashboard from "./pages/Dashboard";
import Emergency from "./pages/Emergency";
import Fire from "./pages/Fire";
import Goals from "./pages/Goals";
import ImportPage from "./pages/Import";
import Insights from "./pages/Insights";
import Investments from "./pages/Investments";
import Login from "./pages/Login";
import Mortgage from "./pages/Mortgage";
import NetWorth from "./pages/NetWorth";
import Projections from "./pages/Projections";
import SettingsPage from "./pages/Settings";
import Savings from "./pages/Savings";
import Transactions from "./pages/Transactions";

export default function App() {
  const meta = useGet<{ auth_enabled: boolean; allow_registration: boolean }>("/auth/meta");
  const [token, setTok] = useState(getToken());
  const qc = useQueryClient();
  useEffect(() => {
    const h = () => setTok(null);
    window.addEventListener("auth:logout", h);
    return () => window.removeEventListener("auth:logout", h);
  }, []);
  if (meta.isLoading) return <div className="p-8"><Loading /></div>;
  const authEnabled = !!meta.data?.auth_enabled;
  if (authEnabled && !token) return <Login allowRegistration={!!meta.data?.allow_registration} onLogin={(t) => { setToken(t); setTok(t); qc.clear(); }} />;
  return (
    <Routes>
      <Route element={<Layout authEnabled={authEnabled} onLogout={() => { setToken(null); setTok(null); qc.clear(); }} />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/recomendaciones" element={<Insights />} />
        <Route path="/movimientos" element={<Transactions kind="all" />} />
        <Route path="/ingresos" element={<Transactions kind="income" />} />
        <Route path="/gastos" element={<Transactions kind="expense" />} />
        <Route path="/presupuestos" element={<Budgets />} />
        <Route path="/importar" element={<ImportPage />} />
        <Route path="/cuentas" element={<Accounts />} />
        <Route path="/remunerada" element={<Savings />} />
        <Route path="/hipoteca" element={<Mortgage />} />
        <Route path="/inversiones" element={<Investments />} />
        <Route path="/patrimonio" element={<NetWorth />} />
        <Route path="/emergencia" element={<Emergency />} />
        <Route path="/objetivos" element={<Goals />} />
        <Route path="/proyecciones" element={<Projections />} />
        <Route path="/fire" element={<Fire />} />
        <Route path="/ajustes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
