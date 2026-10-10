// Lanza la API (uvicorn). `--prod` sin autoreload y sirviendo frontend/dist si existe.
import { spawn } from "node:child_process";
import { BACKEND, VENV_PY, hasVenv } from "./_python.mjs";

if (!hasVenv()) {
  console.error("No existe backend/.venv. Ejecuta: node scripts/setup-backend.mjs");
  process.exit(1);
}
const prod = process.argv.includes("--prod");
const port = process.env.PORT || "8000";
const args = ["-m", "uvicorn", "app.main:app", "--host", prod ? "0.0.0.0" : "127.0.0.1", "--port", port];
if (!prod) args.push("--reload");
const p = spawn(VENV_PY, args, { cwd: BACKEND, stdio: "inherit" });
p.on("exit", (c) => process.exit(c ?? 0));
