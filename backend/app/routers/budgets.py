from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..deps import current_user, owned
from ..models import Budget, Category, User
from ..schemas import BudgetIn
from ..services import stats

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("")
def list_budgets(month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"), db: Session = Depends(get_db), user: User = Depends(current_user)):
    d = date(int(month[:4]), int(month[5:]), 1) if month else date.today().replace(day=1)
    spent = stats.month_category_totals(db, user.id, d)
    cats = {c.id: c for c in db.scalars(select(Category).where(Category.user_id == user.id, Category.kind == "expense"))}
    items = []
    for b in db.scalars(select(Budget).where(Budget.user_id == user.id)):
        c = cats.get(b.category_id)
        if not c:
            continue
        s = round(spent.get(b.category_id, 0.0), 2)
        items.append({"category_id": c.id, "name": c.name, "icon": c.icon, "color": c.color, "budget": b.amount, "spent": s,
                      "remaining": round(b.amount - s, 2), "pct": round(s / b.amount * 100, 1) if b.amount else (100 if s else 0), "over": s > b.amount})
    items.sort(key=lambda x: -x["pct"])
    budgeted = {i["category_id"] for i in items}
    unbudgeted = [{"category_id": k, "name": cats[k].name if k in cats else "Sin categoría", "spent": round(v, 2)} for k, v in spent.items() if k not in budgeted]
    tb, ts = sum(i["budget"] for i in items), sum(i["spent"] for i in items)
    return {"month": d.strftime("%Y-%m"), "items": items, "unbudgeted": unbudgeted,
            "total_budget": round(tb, 2), "total_spent": round(ts, 2), "total_pct": round(ts / tb * 100, 1) if tb else 0}


@router.put("")
def upsert_budget(body: BudgetIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    owned(db, Category, body.category_id, user.id)
    b = db.scalars(select(Budget).where(Budget.user_id == user.id, Budget.category_id == body.category_id)).first()
    if b:
        b.amount = body.amount
    else:
        db.add(Budget(user_id=user.id, **body.model_dump()))
    db.commit()
    return {"ok": True}


@router.delete("/{category_id}", status_code=204)
def delete_budget(category_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    b = db.scalars(select(Budget).where(Budget.user_id == user.id, Budget.category_id == category_id)).first()
    if b:
        db.delete(b)
        db.commit()
