"""Configuración por variables de entorno. Fase 1: SQLite local. Fase 2: DATABASE_URL=postgresql+psycopg://..."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = Path(os.getenv("DATA_DIR", ROOT / "data"))


def _bool(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


class Settings:
    database_url: str = os.getenv("DATABASE_URL") or f"sqlite:///{(DATA_DIR / 'finanzas.db').as_posix()}"
    # Fase 2: activar autenticación JWT y multiusuario
    auth_enabled: bool = _bool("AUTH_ENABLED")
    allow_registration: bool = _bool("ALLOW_REGISTRATION", "true")
    secret_key: str = os.getenv("SECRET_KEY", "dev-insecure-change-me")
    token_minutes: int = int(os.getenv("TOKEN_MINUTES", "10080"))
    cors_origins: list[str] = [o for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o]
    frontend_dist: Path = Path(os.getenv("FRONTEND_DIST", ROOT / "frontend" / "dist"))

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


settings = Settings()

if settings.auth_enabled and settings.secret_key == "dev-insecure-change-me":
    raise RuntimeError("AUTH_ENABLED=true requiere definir SECRET_KEY con un valor secreto propio.")
