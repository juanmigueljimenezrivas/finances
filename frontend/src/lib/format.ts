const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const eur0 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

export const money = (v: number | null | undefined, decimals = true) => (v == null ? "—" : (decimals ? eur : eur0).format(v));
export const compactMoney = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : a >= 1e3 ? `${+(v / 1e3).toFixed(1)}k` : String(Math.round(v));
  return `${s.replace(".", ",")} €`;
};
export const number = (v: number | null | undefined, max = 2) => (v == null ? "—" : new Intl.NumberFormat("es-ES", { maximumFractionDigits: max }).format(v));
export const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: d, minimumFractionDigits: d }).format(v)} %`);
export const signed = (v: number) => (v > 0 ? "+" : "") + eur.format(v);
export const plain = (v: number) => num.format(v);

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const monthLabel = (ym: string, withYear = false) => {
  const [y, m] = ym.split("-");
  return `${MONTHS[+m - 1]}${withYear ? ` ${y.slice(2)}` : ""}`;
};
export const dateEs = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
export const today = () => new Date().toISOString().slice(0, 10);
export const monthNow = () => new Date().toISOString().slice(0, 7);
export const yearsMonths = (months: number | null | undefined) => {
  if (months == null) return "—";
  const y = Math.floor(months / 12), m = Math.round(months % 12);
  return [y ? `${y} a` : "", m ? `${m} m` : ""].filter(Boolean).join(" ") || "0 m";
};
