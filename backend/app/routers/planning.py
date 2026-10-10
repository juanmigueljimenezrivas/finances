from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..deps import current_user
from ..models import User
from ..schemas import FireIn, ProjectionIn, SettingsIn, SettingsOut
from ..services import insights, planning

router = APIRouter(tags=["planning"])


@router.get("/settings", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return planning.get_settings(db, user.id)


@router.put("/settings", response_model=SettingsOut)
def put_settings(body: SettingsIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    s = planning.get_settings(db, user.id)
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    return s


@router.post("/projections")
def projections(body: ProjectionIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return planning.projections(db, user.id, body.years, body.monthly_saving, body.initial_assets, body.real_terms, body.returns)


@router.post("/fire")
def fire(body: FireIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return planning.fire(db, user.id, body.annual_expenses, body.savings_rate, body.expected_return, body.inflation, body.withdrawal_rate, body.initial_assets)


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return insights.dashboard(db, user.id)


@router.get("/recommendations")
def recommendations(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return insights.recommendations(db, user.id)
