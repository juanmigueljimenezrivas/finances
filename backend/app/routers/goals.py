from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..deps import current_user, owned
from ..models import Goal, User
from ..schemas import GoalIn, GoalOut
from ..services import emergency, stats
from ..services.dates import months_between
from ..services.planning import get_settings

router = APIRouter(tags=["goals"])


def _enrich(g: Goal, saving: float) -> dict:
    out = GoalOut.model_validate(g).model_dump(mode="json")
    need = max(g.target_amount - g.current_amount, 0)
    out["pct"] = round(min(g.current_amount / g.target_amount * 100, 100), 1)
    out["remaining"] = round(need, 2)
    left = months_between(date.today(), g.target_date) if g.target_date else None
    out["months_left"] = left
    out["monthly_needed"] = round(need / left, 2) if left and left > 0 else None
    out["eta_months"] = round(need / saving, 1) if saving > 0 and need > 0 else (0 if need == 0 else None)
    out["on_track"] = None if not left else (need == 0 or (left > 0 and need / left <= max(saving, 0)))
    return out


@router.get("/goals")
def list_goals(db: Session = Depends(get_db), user: User = Depends(current_user)):
    saving = stats.avg_monthly_saving(db, user.id)
    return [_enrich(g, saving) for g in db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.target_date.is_(None), Goal.target_date, Goal.id))]


@router.post("/goals", status_code=201)
def create_goal(body: GoalIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    g = Goal(user_id=user.id, **body.model_dump())
    db.add(g)
    db.commit()
    return _enrich(g, stats.avg_monthly_saving(db, user.id))


@router.put("/goals/{gid}")
def update_goal(gid: int, body: GoalIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    g = owned(db, Goal, gid, user.id)
    for k, v in body.model_dump().items():
        setattr(g, k, v)
    db.commit()
    return _enrich(g, stats.avg_monthly_saving(db, user.id))


@router.post("/goals/{gid}/contribute")
def contribute(gid: int, amount: float, db: Session = Depends(get_db), user: User = Depends(current_user)):
    g = owned(db, Goal, gid, user.id)
    g.current_amount = max(g.current_amount + amount, 0)
    db.commit()
    return _enrich(g, stats.avg_monthly_saving(db, user.id))


@router.delete("/goals/{gid}", status_code=204)
def delete_goal(gid: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(owned(db, Goal, gid, user.id))
    db.commit()


@router.get("/emergency")
def emergency_status(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return emergency.status(db, user.id)


@router.put("/emergency/target")
def set_target(months: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    s = get_settings(db, user.id)
    s.emergency_months_target = max(1, min(months, 36))
    db.commit()
    return emergency.status(db, user.id)
