from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..deps import current_user, owned
from ..models import Investment, PriceHistory, User
from ..schemas import InvestmentIn, InvestmentOut, PriceUpdate
from ..services import prices
from ..services.dates import add_months, first_of_month, last_of_month
from ..services.networth import NetWorth

router = APIRouter(prefix="/investments", tags=["investments"])


def _out(i: Investment) -> InvestmentOut:
    o = InvestmentOut.model_validate(i)
    o.cost = round(i.quantity * i.buy_price + i.fees, 2)
    o.value = round(i.quantity * i.current_price, 2)
    o.pnl = round(o.value - o.cost, 2)
    o.pnl_pct = round(o.pnl / o.cost * 100, 2) if o.cost else 0
    return o


def _set_price(db: Session, inv: Investment, price: float, d: date) -> None:
    ph = db.scalars(select(PriceHistory).where(PriceHistory.investment_id == inv.id, PriceHistory.date == d)).first()
    if ph:
        ph.price = price
    else:
        db.add(PriceHistory(investment_id=inv.id, date=d, price=price))
    if not inv.last_price_at or d >= inv.last_price_at:
        inv.current_price, inv.last_price_at = price, d


@router.get("")
def portfolio(db: Session = Depends(get_db), user: User = Depends(current_user)):
    invs = [_out(i) for i in db.scalars(select(Investment).where(Investment.user_id == user.id).order_by(Investment.id))]
    cost, value = sum(i.cost for i in invs), sum(i.value for i in invs)
    alloc: dict[str, float] = {}
    for i in invs:
        alloc[i.type] = alloc.get(i.type, 0) + i.value
    nw = NetWorth(db, user.id)
    history = []
    cur = first_of_month(date.today())
    for k in range(23, -1, -1):
        m = add_months(cur, -k)
        d = min(last_of_month(m), date.today())
        if nw.investments and d >= min(i.purchase_date for i in nw.investments).replace(day=1):
            history.append({"month": f"{m.year}-{m.month:02d}", "value": round(sum(nw.inv_value(i, d) for i in nw.investments), 2),
                            "invested": round(sum(i.quantity * i.buy_price + i.fees for i in nw.investments if i.purchase_date <= d), 2)})
    return {
        "items": invs,
        "totals": {"cost": round(cost, 2), "value": round(value, 2), "pnl": round(value - cost, 2), "pnl_pct": round((value - cost) / cost * 100, 2) if cost else 0,
                   "gains": round(sum(i.pnl for i in invs if i.pnl > 0), 2), "losses": round(sum(i.pnl for i in invs if i.pnl < 0), 2), "fees": round(sum(i.fees for i in invs), 2)},
        "allocation": [{"type": k, "value": round(v, 2), "pct": round(v / value * 100, 1) if value else 0} for k, v in sorted(alloc.items(), key=lambda x: -x[1])],
        "history": history,
    }


@router.post("", response_model=InvestmentOut, status_code=201)
def create(body: InvestmentIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    data = body.model_dump()
    price = data.pop("current_price") if data.get("current_price") is not None else body.buy_price
    data.pop("current_price", None)
    inv = Investment(user_id=user.id, current_price=price, last_price_at=date.today(), **data)
    db.add(inv)
    db.flush()
    db.add(PriceHistory(investment_id=inv.id, date=body.purchase_date, price=body.buy_price))
    if price != body.buy_price or body.purchase_date != date.today():
        _set_price(db, inv, price, date.today())
    db.commit()
    return _out(inv)


@router.put("/{iid}", response_model=InvestmentOut)
def update(iid: int, body: InvestmentIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    inv = owned(db, Investment, iid, user.id)
    data = body.model_dump()
    price = data.pop("current_price")
    for k, v in data.items():
        setattr(inv, k, v)
    if price is not None and price != inv.current_price:
        _set_price(db, inv, price, date.today())
    db.commit()
    return _out(inv)


@router.post("/{iid}/price", response_model=InvestmentOut)
def update_price(iid: int, body: PriceUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    inv = owned(db, Investment, iid, user.id)
    _set_price(db, inv, body.price, body.date)
    db.commit()
    return _out(inv)


@router.post("/refresh-prices")
def refresh_prices(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Actualiza precios vía proveedores externos (hoy solo manual => 0 cambios)."""
    n = 0
    for inv in db.scalars(select(Investment).where(Investment.user_id == user.id)):
        p = prices.refresh(inv.provider, inv.ticker, inv.currency)
        if p is not None:
            _set_price(db, inv, p, date.today())
            n += 1
    db.commit()
    return {"updated": n}


@router.delete("/{iid}", status_code=204)
def delete(iid: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(owned(db, Investment, iid, user.id))
    db.commit()
