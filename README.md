# Finanzas — sistema de control patrimonial personal

Ingresos, gastos, cuentas, presupuestos, hipoteca, cuenta remunerada, inversiones, patrimonio neto, fondo de emergencia, objetivos, proyecciones, FIRE, importación de CSV/Excel, categorización automática, exportación y recomendaciones. Funciona 100 % en local (SQLite) y está preparado para desplegarse con multiusuario + PostgreSQL sin reescribir nada.

## Arranque rápido (Fase 1 · local)

Requisitos: **Node 18+** y **Python 3.10+**.

```bash
npm install     # instala el frontend y crea backend/.venv con las dependencias Python
npm run dev     # API en http://127.0.0.1:8000  ·  App en http://localhost:5173
```

Abre <http://localhost:5173>. En el Dashboard puedes pulsar **«Cargar datos de ejemplo»** para explorar (y borrarlos luego en *Ajustes › Datos*). La base de datos es `data/finanzas.db`; haz copia de ese archivo o usa *Ajustes › Datos › Copia de seguridad*.

> Instala y ejecuta siempre desde el mismo sistema operativo (no mezcles Windows y WSL sobre la misma carpeta: `node_modules` y `.venv` son específicos de cada uno).

Otros comandos: `npm test` (tests backend) · `npm run build` y `npm start` (todo en un solo proceso en :8000, sirviendo el frontend compilado) · `npm run docker:up` (Docker, app en :8080).

## Arquitectura

```
React + TS + Vite + Tailwind + Recharts ──/api──▶ FastAPI ──▶ SQLAlchemy 2 ──▶ SQLite (F1) | PostgreSQL (F2)
```

- **Dominio en servicios puros** (`backend/app/services/`): hipoteca (cuadro francés + simulador), patrimonio histórico, proyecciones, FIRE, recomendaciones, importación… Los routers son finos.
- **Multiusuario desde el día 1**: todas las tablas llevan `user_id` y todas las consultas filtran por él. En local, `deps.current_user` devuelve un usuario único; con `AUTH_ENABLED=true` exige JWT (`/api/auth/register|login`) y el frontend muestra el login. Sin cambios de código.
- **Libro mayor**: los saldos no se guardan, se calculan (`saldo inicial + movimientos`). Una transferencia es un único movimiento. Importar histórico anterior a la fecha de alta reconstruye hacia atrás el patrimonio sin alterar el saldo actual.
- **Portabilidad SQLite/PostgreSQL**: agregados en Python/ORM estándar, importes `Numeric(14,2)`, sin SQL específico del motor.
- **Extensible a precios externos**: `services/prices.py` define `PriceProvider`; `Investment.provider` elige el proveedor.

### Estructura

```
backend/app/   main.py · deps.py · models.py · schemas.py · core/{config,db,security}.py
               routers/   accounts categories transactions budgets mortgage investments patrimonio goals planning importing exports data auth
               services/  mortgage networth stats ledger planning savings emergency insights importer categorizer bootstrap demo prices
backend/tests  pytest (hipoteca, flujo completo, importación, backup/restore)
frontend/src/  pages/ (16 pantallas) · components/{ui,charts} · hooks/ · lib/
docs/          schema.sql · MIGRACION_POSTGRES.md · ROADMAP.md
scripts/       arranque cross-platform · sqlite_to_postgres.py
```

La API completa es explorable en <http://127.0.0.1:8000/docs>.

## Fase 2 · despliegue

```bash
cp .env.example .env            # AUTH_ENABLED=true, SECRET_KEY, POSTGRES_PASSWORD, DATABASE_URL
docker compose --profile prod up --build -d
```
Pon delante un proxy con HTTPS (Caddy/Traefik/ALB). Detalles y migración de datos: `docs/MIGRACION_POSTGRES.md`. Hoja de ruta: `docs/ROADMAP.md`.

## Decisiones y límites a tener en cuenta

- **Vivienda**: no se suma automáticamente al patrimonio; añádela en *Patrimonio › Otros activos* (si no, tu patrimonio neto solo verá la hipoteca como pasivo).
- **Hipoteca**: el cuadro es teórico (sistema francés, tipo fijo). Si tu banco te da el capital pendiente real, indícalo y el cuadro se re-ancla. Hipotecas variables/revisiones de tipo: ver roadmap.
- **Intereses de la remunerada**: se estiman con la TAE; «Registrar intereses del mes» crea el ingreso. Ajusta si tu banco liquida distinto.
- **Proyecciones/FIRE**: estimaciones con rentabilidad constante, no garantías. No es asesoramiento financiero.
- **Seguridad en local**: sin autenticación, cualquiera con acceso a `localhost:8000` ve tus datos; no expongas el puerto a Internet sin `AUTH_ENABLED=true` y HTTPS.
