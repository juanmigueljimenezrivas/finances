"""Copia todos los datos de SQLite a PostgreSQL conservando ids.

Uso (desde backend/, con requirements-postgres.txt instalado):
  python ../scripts/sqlite_to_postgres.py sqlite:///../data/finanzas.db postgresql+psycopg://user:pass@host/db
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from sqlalchemy import create_engine, func, select, text  # noqa: E402

from app import models  # noqa: E402,F401
from app.core.db import Base  # noqa: E402


def main(src_url: str, dst_url: str) -> None:
    src, dst = create_engine(src_url), create_engine(dst_url)
    Base.metadata.create_all(dst)
    with src.connect() as s, dst.begin() as d:
        for t in Base.metadata.sorted_tables:  # orden por dependencias FK
            rows = [dict(r._mapping) for r in s.execute(select(t))]
            if d.execute(select(func.count()).select_from(t)).scalar():
                raise SystemExit(f"Destino no vacío: {t.name}. Usa una base de datos nueva.")
            if rows:
                d.execute(t.insert(), rows)
            if "id" in t.c and rows and dst.dialect.name == "postgresql":  # reajusta la secuencia
                d.execute(text(f"SELECT setval(pg_get_serial_sequence('{t.name}','id'), (SELECT MAX(id) FROM {t.name}))"))
            print(f"{t.name}: {len(rows)} filas")
    print("Migración completada.")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
