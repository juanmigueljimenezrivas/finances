export type AccountType = "checking" | "remunerated" | "savings" | "cash" | "other";
export const ACCOUNT_TYPES: Record<AccountType, string> = { checking: "Cuenta corriente", remunerated: "Cuenta remunerada", savings: "Cuenta ahorro", cash: "Efectivo", other: "Otros" };
export const INVESTMENT_TYPES: Record<string, string> = { etf: "ETF", index_fund: "Fondo indexado", stock: "Acción", crypto: "Criptomoneda", bond: "Bono" };
export const GOAL_KINDS: Record<string, string> = { trip: "✈️ Viaje", car: "🚗 Coche", emergency: "🛟 Fondo emergencia", house: "🏡 Entrada vivienda", investment: "📈 Inversión", other: "🎯 Otro" };

export interface Account { id: number; name: string; bank: string; type: AccountType; initial_balance: number; opened_on: string; interest_rate: number | null; include_in_emergency: boolean; is_archived: boolean; color: string | null; balance: number }
export interface Category { id: number; name: string; kind: "income" | "expense"; color: string; icon: string; is_system: boolean }
export interface Tx { id: number; date: string; amount: number; type: "income" | "expense" | "transfer"; account_id: number; to_account_id: number | null; category_id: number | null; description: string; notes: string }
export interface Rule { id: number; pattern: string; category_id: number; match_type: "contains" | "startswith" | "regex"; priority: number; is_active: boolean }
export interface Recommendation { id: string; severity: "danger" | "warning" | "info" | "success"; title: string; message: string; link?: string }
export interface Settings { currency: string; emergency_months_target: number; return_conservative: number; return_realistic: number; return_optimistic: number; inflation: number; monthly_saving_override: number | null; fire_withdrawal_rate: number; fire_annual_expenses_override: number | null }
