from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .core.config import settings
from .core.db import init_db
from .deps import current_user
from .routers import accounts, auth, budgets, categories, data, exports, goals, importing, investments, mortgage, patrimonio, planning, transactions


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()  # Fase 1: create_all. Con PostgreSQL usar Alembic (ver docs/MIGRACION_POSTGRES.md)
    yield


app = FastAPI(title="Finanzas Personales API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

api = APIRouter(prefix="/api")
api.include_router(auth.router)
protected = [accounts, categories, transactions, budgets, mortgage, investments, patrimonio, goals, planning, importing, exports, data]
for mod in protected:
    api.include_router(mod.router, dependencies=[Depends(current_user)])


@api.get("/health")
def health():
    return {"status": "ok"}


app.include_router(api)

# Producción / Docker de una sola imagen: sirve el frontend compilado
dist = settings.frontend_dist
if dist.exists() and (dist / "index.html").exists():
    from fastapi.staticfiles import StaticFiles

    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        f = (dist / path).resolve()
        if path and f.is_file() and dist.resolve() in f.parents:
            return FileResponse(f)
        return FileResponse(dist / "index.html")
