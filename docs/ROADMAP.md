# Roadmap

**v1.0 (hecho)** Cuentas, ingresos/gastos, transferencias, categorías y reglas, presupuestos, hipoteca (cuadro + simulador), remunerada, inversiones manuales, patrimonio (histórico reconstruido), fondo de emergencia, objetivos, proyecciones por escenarios, FIRE, importación CSV/XLSX con asistente, exportación Excel/CSV/PDF, backup/restore JSON, recomendaciones, modo claro/oscuro, JWT opcional.

**v1.1 — Calidad de vida**
- Movimientos recurrentes (nómina, hipoteca, suscripciones) y calendario de próximos cargos.
- Alembic para migraciones de esquema; tests E2E (Playwright).
- Divisas por cuenta/inversión con tipos de cambio.
- Edición masiva de movimientos y reglas aprendidas desde correcciones manuales.

**v1.2 — Inversiones avanzadas**
- Operaciones de compra/venta (lotes FIFO), dividendos, TWR/XIRR, plusvalías fiscales realizadas.
- Proveedores de precios (`PriceProvider`): Yahoo Finance, CoinGecko, Alpha Vantage; actualización programada.
- Rebalanceo contra cartera objetivo.

**v1.3 — Hipoteca y deuda**
- Hipotecas variables (Euríbor + diferencial, revisiones), bonificaciones, comisiones de amortización.
- Estrategias de pago de deuda (avalancha/bola de nieve) para otros préstamos.

**v2.0 — Multiusuario / nube**
- Refresh tokens, recuperación de contraseña, 2FA, hogares compartidos (varios usuarios, una economía).
- PWA/offline, notificaciones (email/push), conexión bancaria PSD2 (agregador).
- Informes fiscales anuales (IRPF), objetivos con aportaciones automáticas.
