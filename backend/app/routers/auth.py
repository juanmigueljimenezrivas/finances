from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.db import get_db
from ..core.security import create_token, hash_password, verify_password
from ..deps import current_user
from ..models import User
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut
from ..services.bootstrap import bootstrap_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/meta")
def meta():
    return {"auth_enabled": settings.auth_enabled, "allow_registration": settings.allow_registration, "database": "sqlite" if settings.is_sqlite else "postgresql"}


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if not settings.auth_enabled:
        raise HTTPException(400, "La autenticación está desactivada (modo local)")
    if not settings.allow_registration:
        raise HTTPException(403, "Registro deshabilitado")
    email = body.email.lower().strip()
    if db.scalars(select(User).where(User.email == email)).first():
        raise HTTPException(409, "Ese email ya está registrado")
    u = User(email=email, name=body.name, hashed_password=hash_password(body.password))
    db.add(u)
    db.commit()
    bootstrap_user(db, u)
    return TokenOut(access_token=create_token(u.id), user=UserOut.model_validate(u))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.scalars(select(User).where(User.email == body.email.lower().strip())).first()
    if not settings.auth_enabled or not u or not verify_password(body.password, u.hashed_password):
        raise HTTPException(401, "Credenciales incorrectas")
    return TokenOut(access_token=create_token(u.id), user=UserOut.model_validate(u))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user
