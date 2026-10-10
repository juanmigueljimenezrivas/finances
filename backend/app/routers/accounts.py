from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..deps import current_user, owned
from ..models import Account, Category, Transaction, User
from ..schemas import AccountIn, AccountOut
from ..services import savings
from ..services.ledger import current_balances

router = APIRouter(tags=["accounts"])


def _out(a: Account, bal: float) -> AccountOut:
    o = AccountOut.model_validate(a)
    o.balance = bal
    return o


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(include_archived: bool = False, db: Session = Depends(get_db), user: User = Depends(current_user)):
    q = select(Account).where(Account.user_id == user.id).order_by(Account.id)
    accs = list(db.scalars(q))
    bals = current_balances(db, user.id, accs)
    return [_out(a, bals[a.id]) for a in accs if include_archived or not a.is_archived]


@router.post("/accounts", response_model=AccountOut, status_code=201)
def create_account(body: AccountIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    a = Account(user_id=user.id, **body.model_dump())
    if a.type in ("remunerated", "savings") and body.include_in_emergency is False:
        a.include_in_emergency = True  # por defecto el ahorro líquido cuenta para el fondo de emergencia
    db.add(a)
    db.commit()
    return _out(a, a.initial_balance)


@router.put("/accounts/{aid}", response_model=AccountOut)
def update_account(aid: int, body: AccountIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    a = owned(db, Account, aid, user.id)
    for k, v in body.model_dump().items():
        setattr(a, k, v)
    db.commit()
    return _out(a, current_balances(db, user.id, [a])[a.id])


@router.delete("/accounts/{aid}", status_code=204)
def delete_account(aid: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    a = owned(db, Account, aid, user.id)
    n = db.query(Transaction).filter((Transaction.account_id == aid) | (Transaction.to_account_id == aid)).count()
    if n:
        raise HTTPException(409, f"La cuenta tiene {n} movimientos. Archívala en lugar de borrarla.")
    db.delete(a)
    db.commit()


@router.get("/savings")
def savings_overview(contribution: float = 0, years: int = Query(10, ge=1, le=40), db: Session = Depends(get_db), user: User = Depends(current_user)):
    return savings.overview(db, user.id, contribution, years)


@router.post("/accounts/{aid}/apply-interest", status_code=201)
def apply_interest(aid: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Registra como ingreso (categoría Intereses) el interés de un mes del saldo actual."""
    a = owned(db, Account, aid, user.id)
    if not a.interest_rate:
        raise HTTPException(400, "La cuenta no tiene rentabilidad definida")
    bal = current_balances(db, user.id, [a])[a.id]
    amount = round(bal * savings.monthly_factor(a.interest_rate), 2)
    if amount <= 0:
        raise HTTPException(400, "Intereses nulos")
    cat = db.scalars(select(Category).where(Category.user_id == user.id, Category.kind == "income", Category.name == "Intereses")).first()
    t = Transaction(user_id=user.id, date=date.today(), amount=amount, type="income", account_id=a.id, category_id=cat.id if cat else None, description="Intereses mensuales (estimados)")
    db.add(t)
    db.commit()
    return {"id": t.id, "amount": amount}
