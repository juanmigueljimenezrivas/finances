import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void; dark: boolean }>({ theme: "system", setTheme: () => {}, dark: false });

function resolve(t: Theme) {
  return t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "system");
  const [dark, setDark] = useState(() => resolve(theme));
  useEffect(() => {
    const apply = () => {
      const d = resolve(theme);
      setDark(d);
      document.documentElement.classList.toggle("dark", d);
      document.documentElement.setAttribute("data-theme", d ? "dark" : "light");
    };
    apply();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  const setTheme = (t: Theme) => {
    localStorage.setItem("theme", t);
    setThemeState(t);
  };
  return <Ctx.Provider value={{ theme, setTheme, dark }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
