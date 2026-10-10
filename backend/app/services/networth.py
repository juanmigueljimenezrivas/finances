"""Patrimonio neto actual e histórico (reconstruido desde movimientos, precios y cuadro de amortización)."""
from __future__ import annotations

import bisect
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Account, Investment, Liability, Mortgage, OtherAsset, PriceHistory, Transaction
from . import mortgage as mtg
from .dates import add_months, first_of_month, last_of_month
from .ledger import balance_at, load_deltas

LIQUID_TYPES = ("checking", "cash", "other")
SAVINGS_TYPES = ("remunerated", "savings")


class NetWorth:
    def __init__(self, db: Session, uid: int):
        self.today = date.today()
        self.accounts = list(db.scalars(select(Account).where(Account.user_id == uid)))
        self.deltas = load_deltas(db, uid)
        self.investments = list(db.scalars(select(Investment).where(Investment.user_id == uid)))
        ids = [i.id for i in self.investments]
        self.prices: dict[int, tuple[list[date], list[float]]] = {}
        if ids:
            ph: dict[int, list[tuple[date, float]]] = {}
            for p in db.scalars(select(PriceHistory).where(PriceHistory.investment_id.in_(ids))):
                ph.setdefault(p.investment_id, []).append((p.date, p.price))
            for k, v in ph.items():
                v.sort()
                self.prices[k] = ([x[0] for x in v], [x[1] for x in v])
        self.other_assets = sum(a.value for a in db.scalars(select(OtherAsset).where(OtherAsset.user_id == uid)))
        self.other_liabs = sum(x.balance for x in db.scalars(select(Liability).where(Liability.user_id == uid)))
        self.mortgage = db.scalars(select(Mortgage).where(Mortgage.user_id == uid)).first()
        self.rows = mtg.build_schedule(self.mortgage)[0] if self.mortgage else []
        first = [a.opened_on for a in self.accounts] + [i.purchase_date for i in self.investments]
        first += [d for ds in self.deltas.values() for d, _ in ds[:1]]
        self.first_date = min(first) if first else self.today

    def inv_value(self, inv: Investment, d: date) -> float:
        if d < inv.purchase_date:
            return 0.0
        if d >= self.today:
            return inv.quantity * inv.current_price
        ds, ps = self.prices.get(inv.id, ([], []))
        i = bisect.bisect_right(ds, d) - 1
        return inv.quantity * (ps[i] if i >= 0 else inv.buy_price)

    def at(self, d: date) -> dict:
        cash = sum(balance_at(a, self.deltas, d) for a in self.accounts if a.type in LIQUID_TYPES)
        savings = sum(balance_at(a, self.deltas, d) for a in self.accounts if a.type in SAVINGS_TYPES)
        inv = sum(self.inv_value(i, d) for i in self.investments)
        mort = mtg.balance_at(self.mortgage, self.rows, d) if self.mortgage else 0.0
        assets = cash + savings + inv + self.other_assets
        liabs = mort + self.other_liabs
        return {
            "date": d.isoformat(),
            "cash": round(cash, 2), "savings": round(savings, 2), "investments": round(inv, 2), "other_assets": round(self.other_assets, 2),
            "mortgage": round(mort, 2), "other_liabilities": round(self.other_liabs, 2),
            "assets": round(assets, 2), "liabilities": round(liabs, 2), "net_worth": round(assets - liabs, 2),
        }

    def series(self, months: int = 24) -> list[dict]:
        out = []
        cur = first_of_month(self.today)
        for i in range(months - 1, -1, -1):
            m = add_months(cur, -i)
            d = min(last_of_month(m), self.today)
            if last_of_month(m) < first_of_month(self.first_date):
                continue
            row = self.at(d)
            row["month"] = f"{m.year:04d}-{m.month:02d}"
            out.append(row)
        return out


def current(db: Session, uid: int) -> dict:
    return NetWorth(db, uid).at(date.today())
