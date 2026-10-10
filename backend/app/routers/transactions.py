from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..deps import current_user, owned
from ..models import Account, Category, Transaction, User
from ..schemas import TransactionIn, TransactionOut, TransactionPage
from ..services import stats
from ..services.categorizer import Categorizer

router = APIRouter(tags=["transactions"])


def _validate(db: Session, uid: int, body: TransactionIn) -> None:
    accs = [owned(db, Account, body.account_id, uid)]
    if body.to_account_id:
        accs.append(owned(db, Account, body.to_account_id, uid))
    for a in accs:  # un movimiento anterior al alta se ignoraría en el saldo: se adelanta el alta
        if body.date < a.opened_on:
            a.opened_on = body.date
    if body.category_id:
        c = owned(db, Category, body.category_id, uid)
        if c.kind != body.type:
            raise HTTPException(422, "La categoría no corresponde al tipo de movimiento")


def filtered(uid: int, type: str | None, account_id: int | None, category_id: int | None, date_from: date | None, date_to: date | None, q: str | None, uncategorized: bool = False):
    f = [Transaction.user_id == uid]
    if type:
        f.append(Transaction.type == type)
    if account_id:
        f.append(or_(Transaction.account_id == account_id, Transaction.to_account_id == account_id))
    if category_id:
        f.append(Transaction.category_id == category_id)
    if uncategorized:
        f.append(Transaction.category_id.is_(None))
        f.append(Transaction.type != "transfer")
    if date_from:
        f.append(Transaction.date >= date_from)
    if date_to:
        f.append(Transaction.date <= date_to)
    if q:
        f.append(func.lower(Transaction.description).contains(q.lower()))
    return f


@router.get("/transactions", response_model=TransactionPage)
def list_transactions(
    type: str | None = None, account_id: int | None = None, category_id: int | None = None, date_from: date | None = None, date_to: date | None = None,
    q: str | None = None, uncategorized: bool = False, limit: int = Query(50, ge=1, le=500), offset: int = 0,
    db: Session = Depends(get_db), user: User = Depends(current_user),
):
    f = filtered(user.id, type, account_id, category_id, date_from, date_to, q, uncategorized)
    total = db.scalar(select(func.count()).select_from(Transaction).where(*f)) or 0
    sums = dict(db.execute(select(Transaction.type, func.sum(Transaction.amount)).where(*f).group_by(Transaction.type)).all())
    items = list(db.scalars(select(Transaction).where(*f).order_by(Transaction.date.desc(), Transaction.id.desc()).limit(limit).offset(offset)))
    return TransactionPage(items=items, total=total, sum_income=round(sums.get("income", 0) or 0, 2), sum_expense=round(sums.get("expense", 0) or 0, 2))


@router.post("/transactions", response_model=TransactionOut, status_code=201)
def create_transaction(body: TransactionIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    _validate(db, user.id, body)
    data = body.model_dump()
    if body.type != "transfer" and not body.category_id and body.description:
        data["category_id"] = Categorizer(db, user.id).match(body.description, body.type)
    t = Transaction(user_id=user.id, **data)
    db.add(t)
    db.commit()
    return t


@router.put("/transactions/{tid}", response_model=TransactionOut)
def update_transaction(tid: int, body: TransactionIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    t = owned(db, Transaction, tid, user.id)
    _validate(db, user.id, body)
    for k, v in body.model_dump().items():
        setattr(t, k, v)
    db.commit()
    return t


@router.delete("/transactions/{tid}", status_code=204)
def delete_transaction(tid: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(owned(db, Transaction, tid, user.id))
    db.commit()


@router.post("/transactions/bulk-delete")
def bulk_delete(ids: list[int], db: Session = Depends(get_db), user: User = Depends(current_user)):
    n = 0
    for t in db.scalars(select(Transaction).where(Transaction.user_id == user.id, Transaction.id.in_(ids))):
        db.delete(t)
        n += 1
    db.commit()
    return {"deleted": n}


@router.get("/stats/flows")
def flows(kind: str = Query("expense", pattern="^(income|expense)$"), months: int = Query(12, ge=1, le=60), db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Totales mensuales, anual (año natural) y evolución por categoría para ingresos o gastos."""
    ms = stats.monthly_summary(db, user.id, months)
    key = "income" if kind == "income" else "expenses"
    year = date.today().year
    ytd = sum(m[key] for m in stats.monthly_summary(db, user.id, date.today().month))
    yearly = [{"year": y["year"], "total": y[key]} for y in stats.yearly_summary(db, user.id)]
    cur = ms[-1][key]
    vals = [m[key] for m in ms[:-1] if m[key] > 0]
    return {
        "months": [{"month": m["month"], "total": m[key]} for m in ms],
        "current_month": cur, "average_month": round(sum(vals) / len(vals), 2) if vals else cur,
        "year_to_date": round(ytd, 2), "year": year, "yearly": yearly,
        "by_category": stats.category_monthly(db, user.id, kind, months),
    }
