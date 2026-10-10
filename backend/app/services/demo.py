"""Datos de ejemplo realistas (determinista) para explorar la app."""
from __future__ import annotations

import random
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Account, Budget, Category, Goal, Investment, Mortgage, OtherAsset, PriceHistory, Transaction, User
from . import mortgage as mtg
from .dates import add_months, first_of_month, months_between


def load_demo(db: Session, user: User) -> None:
    rnd = random.Random(42)
    today = date.today()
    uid = user.id
    cats = {(c.kind, c.name): c.id for c in db.scalars(select(Category).where(Category.user_id == uid))}
    start = add_months(first_of_month(today), -17)

    main = Account(user_id=uid, name="Cuenta nómina", bank="Banco Principal", type="checking", initial_balance=1800, opened_on=start)
    rem = Account(user_id=uid, name="Cuenta remunerada", bank="Banco Online", type="remunerated", initial_balance=9000, opened_on=start, interest_rate=2.5, include_in_emergency=True)
    cash = Account(user_id=uid, name="Efectivo", bank="", type="cash", initial_balance=120, opened_on=start)
    db.add_all([main, rem, cash])
    db.flush()

    m_price = mtg.french_payment(165000, mtg.monthly_rate(2.45), 360)
    txs: list[Transaction] = []

    def add(d: date, amount: float, t: str, acc: Account, cat: str | None = None, desc: str = "", to: Account | None = None):
        if d > today or amount <= 0:
            return
        txs.append(Transaction(user_id=uid, date=d, amount=round(amount, 2), type=t, account_id=acc.id, to_account_id=to.id if to else None,
                               category_id=cats.get((t, cat)) if cat else None, description=desc))

    rem_bal = 9000.0
    for i in range(18):
        m = add_months(start, i)
        D = lambda day: m.replace(day=min(day, 28))  # noqa: E731
        add(D(27), 2450, "income", main, "Nómina", "NOMINA EMPRESA SL")
        if m.month in (6, 12):
            add(D(27), 2450, "income", main, "Pagas extra", "PAGA EXTRA")
        if m.month == 3:
            add(D(15), 1200, "income", main, "Bonus", "BONUS ANUAL")
        add(D(3), m_price, "expense", main, "Hipoteca", "PRESTAMO HIPOTECARIO")
        add(D(5), 12.99, "expense", main, "Suscripciones", "NETFLIX.COM")
        add(D(6), 10.99, "expense", main, "Suscripciones", "SPOTIFY AB")
        add(D(8), 29.90, "expense", main, "Gimnasio", "GOFIT MENSUALIDAD")
        add(D(15), 48, "expense", main, "Seguros", "MAPFRE SEGURO COCHE")
        add(D(12), rnd.uniform(60, 120), "expense", main, "Hogar", "IBERDROLA FACTURA")
        add(D(18), 35, "expense", main, "Hogar", "AGUAS DE LA CIUDAD")
        for _ in range(rnd.randint(2, 3)):
            add(D(rnd.randint(1, 28)), rnd.uniform(38, 62), "expense", main, "Gasolina", "REPSOL ESTACION")
        for _ in range(rnd.randint(6, 8)):
            add(D(rnd.randint(1, 28)), rnd.uniform(18, 70), "expense", main, "Alimentación", rnd.choice(["MERCADONA", "CARREFOUR", "LIDL", "MERCADONA"]))
        for _ in range(rnd.randint(3, 5)):
            add(D(rnd.randint(1, 28)), rnd.uniform(14, 48), "expense", main, "Restaurantes", rnd.choice(["RESTAURANTE LA PLAZA", "GLOVO", "MCDONALDS", "TELEPIZZA"]))
        for _ in range(rnd.randint(1, 3)):
            add(D(rnd.randint(1, 28)), rnd.uniform(10, 55), "expense", main, "Ocio", rnd.choice(["CINESA", "STEAM GAMES", "ENTRADAS CONCIERTO"]))
        if rnd.random() < 0.35:
            add(D(rnd.randint(1, 28)), rnd.uniform(25, 180), "expense", main, "Tecnología", "PCCOMPONENTES")
        if rnd.random() < 0.3:
            add(D(rnd.randint(1, 28)), rnd.uniform(15, 60), "expense", main, "Salud", "FARMACIA")
        if m.month in (7, 8):
            add(D(10), rnd.uniform(350, 700), "expense", main, "Viajes", "VUELING / BOOKING")
        if i == 14:
            add(D(20), 320, "expense", main, "Impuestos", "AEAT")
        add(D(9), rnd.uniform(15, 40), "expense", cash, "Otros", "Efectivo")
        add(D(28), 400, "transfer", main, None, "Ahorro mensual", to=rem)
        rem_bal += 400
        interest = rem_bal * 0.0021
        rem_bal += interest
        add(D(28), interest, "income", rem, "Intereses", "Liquidación intereses")
    db.add_all(txs)

    # Hipoteca: 4 años y pico de antigüedad
    ms = add_months(first_of_month(today), -50)
    db.add(Mortgage(user_id=uid, name="Hipoteca vivienda", initial_principal=165000, annual_rate=2.45, monthly_payment=None, start_date=ms, end_date=add_months(ms, 360), property_value=230000))
    db.add(OtherAsset(user_id=uid, name="Vivienda habitual", kind="property", value=230000))
    for k, v in {"Alimentación": 400, "Restaurantes": 130, "Ocio": 150, "Tecnología": 50, "Gasolina": 120, "Suscripciones": 40}.items():
        db.add(Budget(user_id=uid, category_id=cats[("expense", k)], amount=v))

    for name, ticker, typ, qty, buy, cur, fee, months_ago in [
        ("Vanguard FTSE All-World", "VWCE", "etf", 38, 102.40, 121.80, 4.5, 14),
        ("Fondo indexado S&P 500", "IE00B3YCGJ38", "index_fund", 55.2, 18.40, 21.35, 0, 9),
        ("Bitcoin", "BTC", "crypto", 0.05, 41000, 62000, 9.9, 6),
    ]:
        pd = add_months(today, -months_ago)
        inv = Investment(user_id=uid, name=name, ticker=ticker, type=typ, quantity=qty, buy_price=buy, current_price=cur, fees=fee, purchase_date=pd, last_price_at=today)
        db.add(inv)
        db.flush()
        for j in range(months_ago + 1):
            frac = j / months_ago
            price = buy + (cur - buy) * frac + buy * rnd.uniform(-0.03, 0.03) * (0 if j in (0, months_ago) else 1)
            db.add(PriceHistory(investment_id=inv.id, date=add_months(pd, j) if j < months_ago else today, price=round(price, 4)))

    db.add(Goal(user_id=uid, name="Viaje a Japón", kind="trip", target_amount=4000, current_amount=1650, target_date=add_months(today, 10)))
    db.add(Goal(user_id=uid, name="Entrada coche", kind="car", target_amount=12000, current_amount=3200, target_date=add_months(today, 30)))
    db.add(Goal(user_id=uid, name="Aportación extra a inversión", kind="investment", target_amount=5000, current_amount=900))
    db.commit()
