"""Proyecciones por escenarios y simulador FIRE."""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Account, Investment, UserSettings
from . import mortgage as mtg
from . import stats
from .dates import add_months
from .networth import NetWorth

SCENARIOS = {"conservative": "Conservador", "realistic": "Realista", "optimistic": "Optimista"}
HORIZONS = (1, 5, 10, 20)


def get_settings(db: Session, uid: int) -> UserSettings:
    s = db.scalars(select(UserSettings).where(UserSettings.user_id == uid)).first()
    if not s:
        s = UserSettings(user_id=uid)
        db.add(s)
        db.commit()
    return s


def financial_assets(nw: NetWorth) -> float:
    cur = nw.at(date.today())
    return cur["cash"] + cur["savings"] + cur["investments"]


def monthly_saving_default(db: Session, uid: int, s: UserSettings) -> float:
    return s.monthly_saving_override if s.monthly_saving_override is not None else stats.avg_monthly_saving(db, uid)


def _grow(initial: float, monthly: float, annual_pct: float, months: int) -> float:
    r = (1 + annual_pct / 100) ** (1 / 12) - 1
    bal = initial
    for _ in range(months):
        bal = bal * (1 + r) + monthly
    return bal


def projections(db: Session, uid: int, years: int, monthly: float | None, initial: float | None, real: bool, returns: dict | None) -> dict:
    s = get_settings(db, uid)
    nw = NetWorth(db, uid)
    base = nw.at(date.today())
    start = initial if initial is not None else financial_assets(nw)
    monthly = monthly if monthly is not None else monthly_saving_default(db, uid, s)
    rates = {"conservative": s.return_conservative, "realistic": s.return_realistic, "optimistic": s.return_optimistic}
    rates.update({k: v for k, v in (returns or {}).items() if k in rates})
    today = date.today()
    out = []
    for key, label in SCENARIOS.items():
        rate = rates[key]
        points, horizons = [], {}
        for y in range(0, years + 1):
            fin = _grow(start, monthly, rate, y * 12)
            mort = mtg.balance_at(nw.mortgage, nw.rows, add_months(today, y * 12)) if nw.mortgage else 0.0
            net = fin + base["other_assets"] - mort - base["other_liabilities"]
            deflator = (1 + s.inflation / 100) ** y if real else 1.0
            pt = {"year": y, "financial_assets": round(fin / deflator, 2), "mortgage": round(mort / deflator, 2), "net_worth": round(net / deflator, 2),
                  "contributions": round((start + monthly * 12 * y) / deflator, 2)}
            points.append(pt)
            if y in HORIZONS and y <= years:
                horizons[str(y)] = {**pt, "growth": round(pt["financial_assets"] - pt["contributions"], 2)}
        out.append({"key": key, "label": label, "annual_return": rate, "points": points, "horizons": horizons})
    return {"initial_assets": round(start, 2), "monthly_saving": round(monthly, 2), "real_terms": real, "inflation": s.inflation,
            "other_assets": base["other_assets"], "scenarios": out}


def _years_to_target(initial: float, monthly: float, real_return_pct: float, target: float, max_years: int = 80) -> int | None:
    bal = initial
    r = (1 + real_return_pct / 100) ** (1 / 12) - 1
    for m in range(max_years * 12 + 1):
        if bal >= target:
            return m
        bal = bal * (1 + r) + monthly
    return None


def fire(db: Session, uid: int, annual_expenses=None, savings_rate=None, expected_return=None, inflation=None, withdrawal_rate=None, initial=None) -> dict:
    s = get_settings(db, uid)
    nw = NetWorth(db, uid)
    expenses = annual_expenses or s.fire_annual_expenses_override or stats.avg_monthly_expense(db, uid, 12) * 12
    wr = withdrawal_rate or s.fire_withdrawal_rate
    ret = expected_return if expected_return is not None else s.return_realistic
    infl = inflation if inflation is not None else s.inflation
    income = stats.avg_monthly_income(db, uid, 12)
    real_ret = ((1 + ret / 100) / (1 + infl / 100) - 1) * 100
    start = initial if initial is not None else financial_assets(nw)
    target = expenses / (wr / 100) if expenses > 0 else 0.0
    monthly = income * savings_rate / 100 if savings_rate is not None else monthly_saving_default(db, uid, s)

    def run(m: float):
        months = _years_to_target(start, m, real_ret, target)
        return months, (add_months(date.today(), months).isoformat() if months is not None else None)

    months, fire_date = run(monthly)
    series, bal, r = [], start, (1 + real_ret / 100) ** (1 / 12) - 1
    horizon = min(((months or 600) // 12) + 6, 60)
    for y in range(horizon + 1):
        series.append({"year": y, "wealth": round(bal, 2), "target": round(target, 2)})
        for _ in range(12):
            bal = bal * (1 + r) + monthly
    table = []
    if income > 0:
        for rate in (10, 20, 30, 40, 50, 60, 70):
            mm, dd = run(income * rate / 100)
            table.append({"savings_rate": rate, "years": round(mm / 12, 1) if mm is not None else None, "date": dd})
    return {
        "annual_expenses": round(expenses, 2), "fire_number": round(target, 2), "current_assets": round(start, 2),
        "progress_pct": round(min(start / target * 100, 100), 1) if target else 0, "monthly_saving": round(monthly, 2),
        "avg_monthly_income": income, "savings_rate_pct": round(monthly / income * 100, 1) if income else None,
        "real_return": round(real_ret, 2), "withdrawal_rate": wr, "years_to_fire": round(months / 12, 1) if months is not None else None,
        "fire_date": fire_date, "reachable": months is not None, "series": series, "by_savings_rate": table,
        "passive_income_monthly_at_fire": round(target * wr / 100 / 12, 2),
    }
