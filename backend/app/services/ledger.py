"""Saldos de cuentas a partir del libro de movimientos."""
from __future__ import annotations

from collections import defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Account, Transaction

Deltas = dict[int, list[tuple[date, float]]]


def load_deltas(db: Session, uid: int) -> Deltas:
    out: Deltas = defaultdict(list)
    rows = db.execute(select(Transaction.date, Transaction.type, Transaction.amount, Transaction.account_id, Transaction.to_account_id).where(Transaction.user_id == uid)).all()
    for d, t, a, acc, to in rows:
        if t == "income":
            out[acc].append((d, a))
        elif t == "expense":
            out[acc].append((d, -a))
        else:
            out[acc].append((d, -a))
            if to:
                out[to].append((d, a))
    return out


def balance_at(acc: Account, deltas: Deltas, d: date) -> float:
    ds = deltas.get(acc.id, [])
    if d >= acc.opened_on:
        return acc.initial_balance + sum(x for dt, x in ds if acc.opened_on <= dt <= d)
    return acc.initial_balance - sum(x for dt, x in ds if d < dt < acc.opened_on)


def current_balances(db: Session, uid: int, accounts: list[Account] | None = None) -> dict[int, float]:
    accounts = accounts if accounts is not None else list(db.scalars(select(Account).where(Account.user_id == uid)))
    deltas = load_deltas(db, uid)
    today = date.today()
    return {a.id: round(balance_at(a, deltas, today), 2) for a in accounts}
