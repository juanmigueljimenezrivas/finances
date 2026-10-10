// Se ejecuta tras `npm install`: crea backend/.venv e instala requirements.txt
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { BACKEND, VENV, VENV_PY, findSystemPython, hasVenv } from "./_python.mjs";

if (process.env.SKIP_BACKEND_SETUP) process.exit(0);
const run = (cmd, args) => spawnSync(cmd, args, { stdio: "inherit", cwd: BACKEND });

if (!hasVenv()) {
  const py = findSystemPython();
  if (!py) {
    console.warn("⚠  No se encontró Python 3.10+. Instálalo y ejecuta: node scripts/setup-backend.mjs");
    process.exit(0);
  }
  console.log("› Creando entorno virtual del backend…");
  let r = run(py, ["-m", "venv", VENV]);
  if (r.status !== 0) {
    console.warn("⚠  No se pudo crear el venv (¿falta python3-venv?).");
    process.exit(0);
  }
}
console.log("› Instalando dependencias Python…");
const r = run(VENV_PY, ["-m", "pip", "install", "-q", "--disable-pip-version-check", "-r", join(BACKEND, "requirements.txt")]);
if (r.status !== 0) console.warn("⚠  Falló la instalación de dependencias Python.");
else console.log("✔ Backend listo.");
