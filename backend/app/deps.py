"""Dependencia de usuario actual. Fase 1: usuario local único. Fase 2 (AUTH_ENABLED): JWT Bearer."""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .core.config import settings
from .core.db import get_db
from .core.security import decode_token
from .models import User
from .services.bootstrap import bootstrap_user

bearer = HTTPBearer(auto_error=False)
LOCAL_EMAIL = "local@localhost"


def get_local_user(db: Session) -> User:
    u = db.scalars(select(User).where(User.email == LOCAL_EMAIL)).first()
    if not u:
        u = User(email=LOCAL_EMAIL, name="Local")
        db.add(u)
        db.commit()
    bootstrap_user(db, u)
    return u


def current_user(db: Session = Depends(get_db), creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
    if not settings.auth_enabled:
        return get_local_user(db)
    uid = decode_token(creds.credentials) if creds else None
    user = db.get(User, uid) if uid else None
    if not user or not user.is_active:
        raise HTTPException(401, "No autenticado", headers={"WWW-Authenticate": "Bearer"})
    return user


def owned(db: Session, model, obj_id: int, uid: int):
    obj = db.get(model, obj_id)
    if not obj or getattr(obj, "user_id", uid) != uid:
        raise HTTPException(404, f"{model.__name__} no encontrado")
    return obj
