import { spawnSync } from "node:child_process";
import { BACKEND, VENV_PY } from "./_python.mjs";
const r = spawnSync(VENV_PY, ["-m", "pytest", "-q"], { cwd: BACKEND, stdio: "inherit" });
process.exit(r.status ?? 1);
