// Utilidades compartidas: localizar python del sistema y del venv (Windows/Linux/macOS)
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BACKEND = join(ROOT, "backend");
export const VENV = join(BACKEND, ".venv");
const isWin = process.platform === "win32";
export const VENV_PY = join(VENV, isWin ? "Scripts" : "bin", isWin ? "python.exe" : "python");

export function findSystemPython() {
  for (const cmd of isWin ? ["py", "python", "python3"] : ["python3", "python"]) {
    const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
    if (r.status === 0) return cmd;
  }
  return null;
}
export const hasVenv = () => existsSync(VENV_PY);
