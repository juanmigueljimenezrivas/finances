"""Agregados de ingresos/gastos (en Python para ser portables entre SQLite y PostgreSQL)."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Category, Transaction
from .dates import add_months, first_of_month, month_starts, ym


def _rows(db: Session, uid: int, start: date, end: date, types=("income", "expense")):
    return db.execute(
        select(Transaction.date, Transaction.type, Transaction.category_id, Transaction.amount).where(
            Transaction.user_id == uid, Transaction.date >= start, Transaction.date <= end, Transaction.type.in_(types)
        )
    ).all()


def monthly_summary(db: Session, uid: int, n: int = 12, end: date | None = None) -> list[dict]:
    months = month_starts(n, end)
    start, stop = months[0], add_months(months[-1], 1)
    acc = {ym(m): {"month": ym(m), "income": 0.0, "expenses": 0.0} for m in months}
    for d, t, _, a in _rows(db, uid, start, stop - timedelta(days=1)):
        k = ym(d)
        if k in acc:
            acc[k]["income" if t == "income" else "expenses"] += a
    out = []
    for v in acc.values():
        v["income"], v["expenses"] = round(v["income"], 2), round(v["expenses"], 2)
        v["savings"] = round(v["income"] - v["expenses"], 2)
        out.append(v)
    return out


def yearly_summary(db: Session, uid: int) -> list[dict]:
    acc: dict[int, dict] = defaultdict(lambda: {"income": 0.0, "expenses": 0.0})
    for d, t, _, a in _rows(db, uid, date(1900, 1, 1), date(2999, 12, 31)):
        acc[d.year]["income" if t == "income" else "expenses"] += a
    return [{"year": y, "income": round(v["income"], 2), "expenses": round(v["expenses"], 2), "savings": round(v["income"] - v["expenses"], 2)} for y, v in sorted(acc.items())]


def category_monthly(db: Session, uid: int, kind: str, n: int = 12) -> dict:
    months = month_starts(n)
    keys = [ym(m) for m in months]
    stop = add_months(months[-1], 1)
    cats = {c.id: c for c in db.scalars(select(Category).where(Category.user_id == uid))}
    data: dict[int | None, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for d, _, cid, a in _rows(db, uid, months[0], stop, (kind,)):
        if ym(d) in keys:
            data[cid][ym(d)] += a
    series = []
    for cid, byk in data.items():
        c = cats.get(cid)
        series.append({"category_id": cid, "name": c.name if c else "Sin categoría", "color": c.color if c else "#94a3b8", "icon": c.icon if c else "❔",
                       "values": [round(byk.get(k, 0.0), 2) for k in keys]})
    series.sort(key=lambda s: -sum(s["values"]))
    return {"months": keys, "series": series}


def month_category_totals(db: Session, uid: int, month: date, kind: str = "expense") -> dict[int | None, float]:
    start = first_of_month(month)
    end = add_months(start, 1)
    out: dict[int | None, float] = defaultdict(float)
    for d, _, cid, a in _rows(db, uid, start, end, (kind,)):
        if d < end:
            out[cid] += a
    return dict(out)


def _avg(vals: list[float]) -> float:
    return sum(vals) / len(vals) if vals else 0.0


def avg_monthly_expense(db: Session, uid: int, n: int = 6) -> float:
    """Media de gasto mensual en los últimos n meses COMPLETOS con datos; si no hay, usa el mes en curso."""
    ms = monthly_summary(db, uid, n + 1)
    past = [m["expenses"] for m in ms[:-1] if m["expenses"] > 0]
    return round(_avg(past) if past else ms[-1]["expenses"], 2)


def avg_monthly_income(db: Session, uid: int, n: int = 6) -> float:
    ms = monthly_summary(db, uid, n + 1)
    past = [m["income"] for m in ms[:-1] if m["income"] > 0]
    return round(_avg(past) if past else ms[-1]["income"], 2)


def avg_monthly_saving(db: Session, uid: int, n: int = 3) -> float:
    ms = monthly_summary(db, uid, n + 1)
    past = [m for m in ms[:-1] if m["income"] > 0 or m["expenses"] > 0]
    return round(_avg([m["savings"] for m in past]) if past else ms[-1]["savings"], 2)
