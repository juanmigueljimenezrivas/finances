from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Account
from . import stats
from .ledger import current_balances
from .planning import get_settings, monthly_saving_default


def status(db: Session, uid: int) -> dict:
    s = get_settings(db, uid)
    accs = list(db.scalars(select(Account).where(Account.user_id == uid, Account.include_in_emergency == True, Account.is_archived == False)))  # noqa: E712
    bals = current_balances(db, uid, accs)
    fund = round(sum(bals.values()), 2)
    avg = stats.avg_monthly_expense(db, uid, 6)
    target_months = s.emergency_months_target
    target = round(avg * target_months, 2)
    missing = max(target - fund, 0)
    saving = monthly_saving_default(db, uid, s)
    return {
        "avg_monthly_expense": avg, "fund": fund, "months_covered": round(fund / avg, 1) if avg else None,
        "target_months": target_months, "target_amount": target, "missing": round(missing, 2),
        "progress_pct": round(min(fund / target * 100, 100), 1) if target else 0,
        "months_to_target": (round(missing / saving, 1) if saving > 0 else None) if missing > 0 else 0,
        "accounts": [{"id": a.id, "name": a.name, "balance": bals[a.id]} for a in accs],
        "options": [3, 6, 12],
    }
