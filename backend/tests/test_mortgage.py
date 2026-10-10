from datetime import date

from app.models import Mortgage
from app.services import mortgage as svc


def make(**kw):
    base = dict(initial_principal=100000, annual_rate=3.0, monthly_payment=None, start_date=date(2020, 1, 1), end_date=date(2050, 1, 1), balance_override=None, override_date=None, property_value=None)
    base.update(kw)
    return Mortgage(**base)


def test_french_schedule_closes_to_zero():
    rows, pay = svc.build_schedule(make(), today=date(2024, 1, 1))
    assert len(rows) == 360
    assert abs(rows[-1].balance) < 0.01
    assert abs(pay - 421.60) < 0.01


def test_summary_progress():
    s = svc.summary(make(), today=date(2024, 1, 1))
    assert s["payments_made"] == 48
    assert s["payments_remaining"] == 312
    assert 0 < s["amortized_capital"] < 100000
    assert abs(s["pending_balance"] + s["amortized_capital"] - 100000) < 0.01


def test_prepayment_saves_interest_and_months():
    m = make()
    r = svc.simulate(m, 100, "monthly", "term", today=date(2024, 1, 1))
    assert r["months_saved"] > 0 and r["interest_saved"] > 0
    once = svc.simulate(m, 10000, "once", "term", today=date(2024, 1, 1))
    pay = svc.simulate(m, 10000, "once", "payment", today=date(2024, 1, 1))
    assert once["months_saved"] > 0 and once["interest_saved"] > 0
    assert pay["months_saved"] == 0 and pay["new_payment"] < 421.60
