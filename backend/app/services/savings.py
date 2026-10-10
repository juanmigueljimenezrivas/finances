"""Cuenta remunerada: intereses y proyecciones. El tipo es TAE (efectivo anual)."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Account, Category, Transaction
from .ledger import current_balances


def monthly_factor(tae: float) -> float:
    return (1 + tae / 100) ** (1 / 12) - 1


def project(balance: float, tae: float, monthly_contribution: float = 0.0, years: int = 10) -> list[dict]:
    r = monthly_factor(tae)
    bal, contrib, pts = balance, balance, [{"year": 0, "balance": round(balance, 2), "interest": 0.0, "contributions": round(balance, 2)}]
    for m in range(1, years * 12 + 1):
        bal = bal * (1 + r) + monthly_contribution
        contrib += monthly_contribution
        if m % 12 == 0:
            pts.append({"year": m // 12, "balance": round(bal, 2), "interest": round(bal - contrib, 2), "contributions": round(contrib, 2)})
    return pts


def overview(db: Session, uid: int, contribution: float = 0.0, years: int = 10) -> dict:
    accs = list(db.scalars(select(Account).where(Account.user_id == uid, Account.type.in_(("remunerated", "savings")), Account.is_archived == False)))  # noqa: E712
    bals = current_balances(db, uid, accs)
    interest_cat = db.scalars(select(Category).where(Category.user_id == uid, Category.kind == "income", Category.name == "Intereses")).first()
    out = []
    for a in accs:
        b, tae = bals[a.id], a.interest_rate or 0.0
        accrued = 0.0
        if interest_cat:
            accrued = db.scalar(select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == uid, Transaction.account_id == a.id, Transaction.type == "income", Transaction.category_id == interest_cat.id)) or 0.0
        out.append({
            "account_id": a.id, "name": a.name, "bank": a.bank, "balance": b, "tae": tae,
            "monthly_interest": round(b * monthly_factor(tae), 2), "annual_interest": round(b * tae / 100, 2),
            "accumulated_interest": round(accrued, 2), "projection": project(b, tae, contribution, years),
        })
    return {"accounts": out, "totals": {"balance": round(sum(x["balance"] for x in out), 2), "monthly_interest": round(sum(x["monthly_interest"] for x in out), 2),
                                        "annual_interest": round(sum(x["annual_interest"] for x in out), 2), "accumulated_interest": round(sum(x["accumulated_interest"] for x in out), 2)}}
