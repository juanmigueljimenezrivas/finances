# Plan de migración SQLite → PostgreSQL

La app ya es agnóstica al motor: solo cambia `DATABASE_URL`.

1. **Backup**: *Ajustes › Datos › Copia de seguridad (JSON)* y copia de `data/finanzas.db`.
2. **Levantar PostgreSQL** (`docker compose --profile prod up -d db` o servicio gestionado RDS / Azure Database).
3. **Instalar driver**: `pip install -r backend/requirements-postgres.txt`.
4. **Copiar datos conservando ids** (BD destino vacía):
   ```bash
   cd backend
   .venv/bin/python ../scripts/sqlite_to_postgres.py sqlite:///../data/finanzas.db postgresql+psycopg://finanzas:PASS@host:5432/finanzas
   ```
   Crea el esquema, copia por orden de dependencias y reajusta las secuencias. Alternativa portable: restaurar el backup JSON desde la UI (remapea ids y asigna los datos al usuario que lo restaura).
5. **Configurar**: `DATABASE_URL=postgresql+psycopg://…`, `AUTH_ENABLED=true`, `SECRET_KEY` propio. Al activar auth, el usuario local de la Fase 1 (`local@localhost`) no tiene contraseña: registra tu usuario y restaura el backup JSON en él (o asigna una contraseña a `local@localhost` en la tabla `users` con `hash_password`).
6. **Verificar**: dashboard, saldos (`SELECT account_id, SUM(...)`) y `npm test` apuntando a una BD de prueba.
7. **Migraciones de esquema futuras**: introducir **Alembic** (`alembic init`, `target_metadata = Base.metadata`, `alembic revision --autogenerate`). Hoy `create_all` solo crea tablas nuevas, no altera existentes; antes de la primera modificación de modelos en producción, genera la revisión base con `alembic stamp head`.

Diferencias a vigilar: sensibilidad a mayúsculas en `LIKE` (la búsqueda usa `lower()`), tipos `Numeric` exactos (no más floats), y concurrencia (usa un pool; con varios workers `uvicorn --workers N`).

## Despliegue
- **VPS**: `docker compose --profile prod up -d` + Caddy/Traefik con HTTPS.
- **AWS**: ECS Fargate (imagen `backend`) + RDS PostgreSQL + S3/CloudFront para `frontend/dist` (o la imagen `web`) + ALB con HTTPS.
- **Azure**: Container Apps + Azure Database for PostgreSQL + Static Web Apps.
- Secretos (`SECRET_KEY`, contraseñas) en el gestor de secretos del proveedor, nunca en el repo.
