from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..deps import current_user
from ..models import Mortgage, User
from ..schemas import MortgageIn, MortgageOut, SimulateIn
from ..services import mortgage as svc

router = APIRouter(prefix="/mortgage", tags=["mortgage"])


def _get(db: Session, uid: int) -> Mortgage | None:
    return db.scalars(select(Mortgage).where(Mortgage.user_id == uid)).first()


@router.get("")
def get_mortgage(db: Session = Depends(get_db), user: User = Depends(current_user)):
    m = _get(db, user.id)
    if not m:
        return {"mortgage": None}
    return {"mortgage": MortgageOut.model_validate(m), "summary": svc.summary(m)}


@router.put("", response_model=MortgageOut)
def upsert_mortgage(body: MortgageIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    m = _get(db, user.id)
    if not m:
        m = Mortgage(user_id=user.id, **body.model_dump())
        db.add(m)
    else:
        for k, v in body.model_dump().items():
            setattr(m, k, v)
    db.commit()
    return m


@router.delete("", status_code=204)
def delete_mortgage(db: Session = Depends(get_db), user: User = Depends(current_user)):
    m = _get(db, user.id)
    if m:
        db.delete(m)
        db.commit()


@router.get("/schedule")
def schedule(db: Session = Depends(get_db), user: User = Depends(current_user)):
    m = _get(db, user.id)
    if not m:
        raise HTTPException(404, "No hay hipoteca configurada")
    return svc.schedule_dicts(m)


@router.post("/simulate")
def simulate(body: SimulateIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    m = _get(db, user.id)
    if not m:
        raise HTTPException(404, "No hay hipoteca configurada")
    return [svc.simulate(m, s.extra, s.mode, s.strategy) for s in body.scenarios]
