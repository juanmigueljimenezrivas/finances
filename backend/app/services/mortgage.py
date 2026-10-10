"""Cuadro de amortización (sistema francés), estadísticas y simulación de amortización anticipada."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date

from ..models import Mortgage
from .dates import add_months, months_between

MAX_ITER = 1200


@dataclass
class Row:
    n: int
    date: date
    payment: float
    interest: float
    principal: float
    balance: float
    paid: bool = False


def monthly_rate(annual_pct: float) -> float:
    return annual_pct / 100 / 12


def french_payment(principal: float, r: float, n: int) -> float:
    if n <= 0:
        return principal
    return principal / n if r == 0 else principal * r / (1 - (1 + r) ** -n)


def _amortize(balance: float, r: float, pay: float, k0: int, start: date, extra: float = 0.0) -> list[Row]:
    """Genera cuotas hasta saldar. k0 = nº de cuotas ya pagadas (alinea fechas con `start`)."""
    rows: list[Row] = []
    i = 0
    while balance > 0.005 and i < MAX_ITER:
        i += 1
        interest = balance * r
        principal = min(pay + extra - interest, balance)
        if principal <= 0:  # la cuota no cubre los intereses
            break
        balance -= principal
        rows.append(Row(k0 + i, add_months(start, k0 + i), round(principal + interest, 2), round(interest, 2), round(principal, 2), round(max(balance, 0), 2)))
    return rows


def build_schedule(m: Mortgage, today: date | None = None) -> tuple[list[Row], float]:
    """Devuelve (filas, cuota). Si hay balance_override, las cuotas posteriores parten de ese capital."""
    today = today or date.today()
    r = monthly_rate(m.annual_rate)
    n_total = max(months_between(m.start_date, m.end_date), 1)
    pay = m.monthly_payment or french_payment(m.initial_principal, r, n_total)
    rows = _amortize(m.initial_principal, r, pay, 0, m.start_date)
    if m.balance_override is not None and m.override_date:
        past = [x for x in rows if x.date <= m.override_date]
        remaining = max(months_between(m.override_date, m.end_date), 1)
        pay2 = m.monthly_payment or french_payment(m.balance_override, r, remaining)
        rows = past + _amortize(m.balance_override, r, pay2, len(past), m.start_date)
        pay = pay2
    for x in rows:
        x.paid = x.date <= today
    return rows, round(pay, 2)


def balance_at(m: Mortgage, rows: list[Row], d: date) -> float:
    if d < m.start_date:
        return 0.0
    bal, last = m.initial_principal, None
    for x in rows:
        if x.date <= d:
            bal, last = x.balance, x.date
        else:
            break
    if m.balance_override is not None and m.override_date and d >= m.override_date and (last is None or last <= m.override_date):
        bal = m.balance_override
    return bal


def summary(m: Mortgage, today: date | None = None) -> dict:
    today = today or date.today()
    rows, pay = build_schedule(m, today)
    paid = [x for x in rows if x.paid]
    future = [x for x in rows if not x.paid]
    pending = balance_at(m, rows, today)
    return {
        "monthly_payment": pay,
        "pending_balance": round(pending, 2),
        "amortized_capital": round(max(m.initial_principal - pending, 0), 2),
        "interest_paid": round(sum(x.interest for x in paid), 2),
        "interest_future": round(sum(x.interest for x in future), 2),
        "payments_made": len(paid),
        "payments_remaining": len(future),
        "total_remaining_cost": round(sum(x.payment for x in future), 2),
        "progress_pct": round((1 - pending / m.initial_principal) * 100, 2) if m.initial_principal else 0,
        "end_date_effective": future[-1].date.isoformat() if future else (paid[-1].date.isoformat() if paid else None),
        "ltv_pct": round(pending / m.property_value * 100, 1) if m.property_value else None,
    }


def schedule_dicts(m: Mortgage) -> list[dict]:
    rows, _ = build_schedule(m)
    return [{**asdict(x), "date": x.date.isoformat()} for x in rows]


def simulate(m: Mortgage, extra: float, mode: str, strategy: str, today: date | None = None) -> dict:
    today = today or date.today()
    rows, pay = build_schedule(m, today)
    paid = [x for x in rows if x.paid]
    base = [x for x in rows if not x.paid]
    balance = balance_at(m, rows, today)
    r = monthly_rate(m.annual_rate)
    k0 = len(paid)
    base_interest = sum(x.interest for x in base)
    new_pay = pay
    if not base or balance <= 0:
        return {"extra": extra, "mode": mode, "strategy": strategy, "new_payment": pay, "months": 0, "base_months": 0, "months_saved": 0, "interest": 0, "base_interest": 0, "interest_saved": 0, "new_end_date": None, "base_end_date": None}
    if mode == "once":
        bal0 = max(balance - extra, 0)
        if strategy == "payment":
            new_pay = french_payment(bal0, r, len(base))
            sim = _amortize(bal0, r, new_pay, k0, m.start_date)
        else:
            sim = _amortize(bal0, r, pay, k0, m.start_date)
    else:
        sim = _amortize(balance, r, pay, k0, m.start_date, extra=extra)
    sim_interest = sum(x.interest for x in sim)
    return {
        "extra": extra,
        "mode": mode,
        "strategy": strategy,
        "new_payment": round(new_pay, 2),
        "months": len(sim),
        "base_months": len(base),
        "months_saved": len(base) - len(sim),
        "interest": round(sim_interest, 2),
        "base_interest": round(base_interest, 2),
        "interest_saved": round(base_interest - sim_interest, 2),
        "new_end_date": sim[-1].date.isoformat() if sim else None,
        "base_end_date": base[-1].date.isoformat(),
    }
