"""Recomendaciones automáticas y datos del dashboard."""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Budget, Category, Goal, Mortgage
from . import emergency, mortgage as mtg, stats
from .dates import add_months, months_between
from .networth import NetWorth
from .planning import get_settings


def _fmt(x: float) -> str:
    return f"{x:,.0f} €".replace(",", ".")


def recommendations(db: Session, uid: int) -> list[dict]:
    recs: list[dict] = []
    today = date.today()
    cats = {c.id: c for c in db.scalars(select(Category).where(Category.user_id == uid))}
    spent = stats.month_category_totals(db, uid, today)

    # 1) presupuestos superados / cerca del límite
    for b in db.scalars(select(Budget).where(Budget.user_id == uid)):
        s, c = spent.get(b.category_id, 0.0), cats.get(b.category_id)
        if not c or b.amount <= 0:
            continue
        pct = s / b.amount * 100
        if pct > 100:
            recs.append({"id": f"budget-over-{b.category_id}", "severity": "danger", "title": f"Presupuesto de {c.name} superado",
                         "message": f"Llevas {_fmt(s)} de {_fmt(b.amount)} ({pct:.0f}%). Te has pasado {_fmt(s - b.amount)}.", "link": "/presupuestos"})
        elif pct >= 80:
            recs.append({"id": f"budget-warn-{b.category_id}", "severity": "warning", "title": f"{c.name}: casi en el límite",
                         "message": f"Has consumido el {pct:.0f}% del presupuesto ({_fmt(b.amount - s)} restantes).", "link": "/presupuestos"})

    # 2) categorías con gasto excesivo vs media de 3 meses
    cm = stats.category_monthly(db, uid, "expense", 4)
    for s in cm["series"]:
        if s["category_id"] is None:
            continue
        prev = [v for v in s["values"][:-1] if v > 0]
        cur = s["values"][-1]
        if len(prev) >= 2:
            avg = sum(prev) / len(prev)
            if cur > avg * 1.3 and cur - avg > 40:
                recs.append({"id": f"cat-excess-{s['category_id']}", "severity": "warning", "title": f"Gasto elevado en {s['name']}",
                             "message": f"Este mes {_fmt(cur)} frente a una media de {_fmt(avg)} (+{(cur / avg - 1) * 100:.0f}%).", "link": "/gastos"})

    # 3) tendencia del ahorro
    ms = stats.monthly_summary(db, uid, 7)
    full = ms[:-1]
    if len(full) >= 6 and any(m["income"] > 0 for m in full):
        a, b = sum(m["savings"] for m in full[:3]) / 3, sum(m["savings"] for m in full[3:]) / 3
        if b < a - 50:
            recs.append({"id": "saving-trend", "severity": "warning", "title": "Tu ahorro está bajando",
                         "message": f"Ahorro medio de los últimos 3 meses: {_fmt(b)}/mes frente a {_fmt(a)}/mes en los 3 anteriores.", "link": "/dashboard"})
    if full and full[-1]["income"] > 0 and full[-1]["savings"] < 0:
        recs.append({"id": "negative-saving", "severity": "danger", "title": "Mes anterior con ahorro negativo",
                     "message": f"Gastaste {_fmt(-full[-1]['savings'])} más de lo que ingresaste.", "link": "/gastos"})

    # 4) fondo de emergencia, exceso de efectivo y amortización
    em = emergency.status(db, uid)
    nw = NetWorth(db, uid)
    cur = nw.at(today)
    if em["avg_monthly_expense"] > 0 and em["target_amount"] > 0:
        if em["fund"] < em["target_amount"]:
            recs.append({"id": "emergency-low", "severity": "warning", "title": "Fondo de emergencia incompleto",
                         "message": f"Cubre {em['months_covered'] or 0} de {em['target_months']} meses. Te faltan {_fmt(em['missing'])}.", "link": "/emergencia"})
        liquid = cur["cash"] + cur["savings"]
        excess = liquid - em["target_amount"] - em["avg_monthly_expense"]  # colchón de un mes en cuenta corriente
        if excess > 1000:
            recs.append({"id": "cash-excess", "severity": "info", "title": "Tienes efectivo sin trabajar",
                         "message": f"Con el fondo de emergencia cubierto, te sobran unos {_fmt(excess)}. Considera invertirlos o amortizar hipoteca.", "link": "/inversiones"})
            m = db.scalars(select(Mortgage).where(Mortgage.user_id == uid)).first()
            if m:
                rate = m.annual_rate
                best_cash = max([a.interest_rate or 0 for a in nw.accounts] or [0])
                if rate > best_cash:
                    sim = mtg.simulate(m, round(min(excess, cur["mortgage"]) / 100) * 100, "once", "term")
                    recs.append({"id": "mortgage-prepay", "severity": "info", "title": "Posible amortización de hipoteca",
                                 "message": f"Tu hipoteca cuesta {rate:.2f}% y tu efectivo rinde {best_cash:.2f}%. Amortizar {_fmt(sim['extra'])} ahorraría {_fmt(sim['interest_saved'])} en intereses y {sim['months_saved']} meses.",
                                 "link": "/hipoteca"})

    # 5) objetivos
    saving = stats.avg_monthly_saving(db, uid)
    for g in db.scalars(select(Goal).where(Goal.user_id == uid)):
        if g.current_amount >= g.target_amount:
            recs.append({"id": f"goal-done-{g.id}", "severity": "success", "title": f"¡Objetivo alcanzado: {g.name}!", "message": f"Has completado {_fmt(g.target_amount)}.", "link": "/objetivos"})
        elif g.target_date:
            left = max(months_between(today, g.target_date), 0)
            need = g.target_amount - g.current_amount
            if g.target_date < today:
                recs.append({"id": f"goal-late-{g.id}", "severity": "warning", "title": f"Objetivo vencido: {g.name}", "message": f"Faltan {_fmt(need)} y la fecha ya pasó.", "link": "/objetivos"})
            elif left > 0 and need / left > max(saving, 0) and saving >= 0:
                recs.append({"id": f"goal-risk-{g.id}", "severity": "warning", "title": f"Objetivo en riesgo: {g.name}",
                             "message": f"Necesitas {_fmt(need / left)}/mes y tu ahorro medio es {_fmt(saving)}/mes.", "link": "/objetivos"})
    order = {"danger": 0, "warning": 1, "info": 2, "success": 3}
    return sorted(recs, key=lambda r: order[r["severity"]])


def dashboard(db: Session, uid: int) -> dict:
    today = date.today()
    nw = NetWorth(db, uid)
    cur = nw.at(today)
    series = nw.series(12)
    flows = {m["month"]: m for m in stats.monthly_summary(db, uid, 12)}
    for row in series:
        f = flows.get(row["month"], {})
        row.update(income=f.get("income", 0), expenses=f.get("expenses", 0), savings_flow=f.get("savings", 0))
    ms = stats.monthly_summary(db, uid, 2)
    this, prev = ms[-1], ms[0]
    first_nw = series[0]["net_worth"] if series else cur["net_worth"]
    year_start = next((r for r in series if r["month"] == f"{today.year}-01"), series[0] if series else None)
    top = stats.month_category_totals(db, uid, today)
    cats = {c.id: c for c in db.scalars(select(Category).where(Category.user_id == uid))}
    top_list = sorted(({"name": cats[k].name if k in cats else "Sin categoría", "color": cats[k].color if k in cats else "#94a3b8", "icon": cats[k].icon if k in cats else "❔", "amount": round(v, 2)} for k, v in top.items()), key=lambda x: -x["amount"])
    return {
        "kpis": {
            "net_worth": cur["net_worth"], "assets": cur["assets"], "liabilities": cur["liabilities"], "available": cur["cash"],
            "accumulated_savings": round(cur["savings"] + cur["investments"], 2), "savings_accounts": cur["savings"], "investments": cur["investments"],
            "monthly_saving_capacity": stats.avg_monthly_saving(db, uid),
            "net_worth_change_month": round(cur["net_worth"] - series[-2]["net_worth"], 2) if len(series) > 1 else 0,
            "net_worth_change_year": round(cur["net_worth"] - (year_start["net_worth"] if year_start else first_nw), 2),
            "income_month": this["income"], "expenses_month": this["expenses"], "savings_month": this["savings"],
            "expenses_prev_month": prev["expenses"], "income_prev_month": prev["income"],
        },
        "breakdown": cur,
        "series": series,
        "yearly": stats.yearly_summary(db, uid),
        "top_categories": top_list[:6],
        "recommendations": recommendations(db, uid)[:4],
        "empty": not nw.accounts,
    }
