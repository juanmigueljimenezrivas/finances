from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..deps import current_user
from ..models import Account, Transaction, User
from ..services.bootstrap import bootstrap_user
from ..services.demo import load_demo
from .exports import wipe_user_data

router = APIRouter(prefix="/data", tags=["data"])


@router.post("/reset")
def reset(confirm: bool = False, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Borra TODOS los datos del usuario y restaura categorías/reglas por defecto."""
    if not confirm:
        raise HTTPException(400, "Falta confirm=true")
    wipe_user_data(db, user.id)
    db.commit()
    bootstrap_user(db, user)
    return {"ok": True}


@router.post("/demo")
def demo(db: Session = Depends(get_db), user: User = Depends(current_user)):
    if db.scalar(select(func.count()).select_from(Transaction).where(Transaction.user_id == user.id)) or db.scalar(select(func.count()).select_from(Account).where(Account.user_id == user.id)):
        raise HTTPException(409, "Ya tienes datos. Restablece primero si quieres cargar el ejemplo.")
    bootstrap_user(db, user)
    load_demo(db, user)
    return {"ok": True}
