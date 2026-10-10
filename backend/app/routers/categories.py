from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..deps import current_user, owned
from ..models import Category, CategoryRule, Transaction, User
from ..schemas import CategoryIn, CategoryOut, RuleIn, RuleOut
from ..services.categorizer import Categorizer

router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return list(db.scalars(select(Category).where(Category.user_id == user.id).order_by(Category.kind, Category.id)))


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    c = Category(user_id=user.id, **body.model_dump())
    db.add(c)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe una categoría con ese nombre")
    return c


@router.put("/categories/{cid}", response_model=CategoryOut)
def update_category(cid: int, body: CategoryIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    c = owned(db, Category, cid, user.id)
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe una categoría con ese nombre")
    return c


@router.delete("/categories/{cid}", status_code=204)
def delete_category(cid: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    c = owned(db, Category, cid, user.id)
    db.delete(c)  # los movimientos quedan "sin categoría" (ON DELETE SET NULL)
    db.commit()


@router.get("/rules", response_model=list[RuleOut])
def list_rules(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return list(db.scalars(select(CategoryRule).where(CategoryRule.user_id == user.id).order_by(CategoryRule.priority, CategoryRule.id)))


@router.post("/rules", response_model=RuleOut, status_code=201)
def create_rule(body: RuleIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    owned(db, Category, body.category_id, user.id)
    r = CategoryRule(user_id=user.id, **body.model_dump())
    db.add(r)
    db.commit()
    return r


@router.put("/rules/{rid}", response_model=RuleOut)
def update_rule(rid: int, body: RuleIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    r = owned(db, CategoryRule, rid, user.id)
    owned(db, Category, body.category_id, user.id)
    for k, v in body.model_dump().items():
        setattr(r, k, v)
    db.commit()
    return r


@router.delete("/rules/{rid}", status_code=204)
def delete_rule(rid: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(owned(db, CategoryRule, rid, user.id))
    db.commit()


@router.post("/rules/apply")
def apply_rules(only_uncategorized: bool = True, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Re-aplica las reglas a movimientos existentes."""
    cz = Categorizer(db, user.id)
    q = select(Transaction).where(Transaction.user_id == user.id, Transaction.type != "transfer")
    if only_uncategorized:
        q = q.where(Transaction.category_id.is_(None))
    n = 0
    for t in db.scalars(q):
        cid = cz.match(t.description, t.type)
        if cid and cid != t.category_id:
            t.category_id = cid
            n += 1
    db.commit()
    return {"updated": n}
