from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..deps import current_user, owned
from ..models import Account, Liability, OtherAsset, User
from ..schemas import LiabilityIn, LiabilityOut, OtherAssetIn, OtherAssetOut
from ..services.networth import NetWorth

router = APIRouter(tags=["networth"])


@router.get("/networth")
def networth(months: int = Query(24, ge=1, le=120), db: Session = Depends(get_db), user: User = Depends(current_user)):
    nw = NetWorth(db, user.id)
    return {"current": nw.at(nw.today), "series": nw.series(months)}


@router.get("/other-assets", response_model=list[OtherAssetOut])
def list_assets(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return list(db.scalars(select(OtherAsset).where(OtherAsset.user_id == user.id)))


@router.post("/other-assets", response_model=OtherAssetOut, status_code=201)
def create_asset(body: OtherAssetIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    a = OtherAsset(user_id=user.id, **body.model_dump())
    db.add(a)
    db.commit()
    return a


@router.put("/other-assets/{i}", response_model=OtherAssetOut)
def update_asset(i: int, body: OtherAssetIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    a = owned(db, OtherAsset, i, user.id)
    for k, v in body.model_dump().items():
        setattr(a, k, v)
    db.commit()
    return a


@router.delete("/other-assets/{i}", status_code=204)
def delete_asset(i: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(owned(db, OtherAsset, i, user.id))
    db.commit()


@router.get("/liabilities", response_model=list[LiabilityOut])
def list_liabs(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return list(db.scalars(select(Liability).where(Liability.user_id == user.id)))


@router.post("/liabilities", response_model=LiabilityOut, status_code=201)
def create_liab(body: LiabilityIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    x = Liability(user_id=user.id, **body.model_dump())
    db.add(x)
    db.commit()
    return x


@router.put("/liabilities/{i}", response_model=LiabilityOut)
def update_liab(i: int, body: LiabilityIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    x = owned(db, Liability, i, user.id)
    for k, v in body.model_dump().items():
        setattr(x, k, v)
    db.commit()
    return x


@router.delete("/liabilities/{i}", status_code=204)
def delete_liab(i: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(owned(db, Liability, i, user.id))
    db.commit()
