import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..deps import current_user, owned
from ..models import Account, Category, Transaction, User
from ..schemas import ColumnMapping
from ..services import importer
from ..services.categorizer import Categorizer
from ..services.ledger import balance_at, load_deltas

router = APIRouter(prefix="/import", tags=["import"])
MAX_BYTES = 10 * 1024 * 1024


async def _read(file: UploadFile) -> list[list[str]]:
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Archivo demasiado grande (máx. 10 MB)")
    try:
        rows = importer.read_table(file.filename or "", data)
    except ValueError as e:
        raise HTTPException(422, str(e))
    if len(rows) < 2:
        raise HTTPException(422, "El archivo no contiene datos")
    return rows


@router.post("/preview")
async def preview(file: UploadFile = File(...), user: User = Depends(current_user)):
    rows = await _read(file)
    return importer.detect(rows)


@router.post("/commit")
async def commit(
    file: UploadFile = File(...), mapping: str = Form(...), account_id: int = Form(...), header_row: int = Form(0),
    dry_run: bool = Form(True), skip_duplicates: bool = Form(True), apply_rules: bool = Form(True), sync_balance: bool = Form(False),
    db: Session = Depends(get_db), user: User = Depends(current_user),
):
    acc = owned(db, Account, account_id, user.id)
    try:
        m = ColumnMapping(**json.loads(mapping))
    except Exception as e:
        raise HTTPException(422, f"Mapeo inválido: {e}")
    rows = await _read(file)
    if m.date not in rows[header_row] or (m.amount and m.amount not in rows[header_row]):
        raise HTTPException(422, "El mapeo no coincide con las columnas del archivo")
    items, errors = importer.parse_rows(rows, header_row, m)
    importer.assign_hashes(items, account_id)
    existing = set(db.scalars(select(Transaction.import_hash).where(Transaction.user_id == user.id, Transaction.import_hash.in_([i["hash"] for i in items]))))
    cz = Categorizer(db, user.id) if apply_rules else None
    cats = {c.id: c for c in db.scalars(select(Category).where(Category.user_id == user.id))}
    result, created = [], 0
    for it in items:
        it["category_id"] = cz.match(it["description"], it["type"]) if cz else None
        it["duplicate"] = it["hash"] in existing
        if not dry_run and not (it["duplicate"] and skip_duplicates):
            db.add(Transaction(user_id=user.id, date=it["date"], amount=it["amount"], type=it["type"], account_id=account_id,
                               category_id=it["category_id"], description=it["description"], import_hash=it["hash"]))
            created += 1
        if len(result) < 200:
            c = cats.get(it["category_id"])
            result.append({"date": it["date"].isoformat(), "amount": it["amount"], "type": it["type"], "description": it["description"],
                           "category": c.name if c else None, "duplicate": it["duplicate"]})
    closing = importer.closing_balance(items)
    synced = None
    if not dry_run and sync_balance and closing:
        # Cuadra la cuenta con el saldo del extracto: el alta retrocede hasta el primer movimiento para que todos computen.
        db.flush()
        first = min(i["date"] for i in items)
        if first < acc.opened_on:
            acc.opened_on = first
        db.flush()
        acc.initial_balance = round(acc.initial_balance + closing[0] - balance_at(acc, load_deltas(db, user.id), closing[1]), 2)
        synced = closing[0]
    if not dry_run:
        db.commit()
    return {"closing_balance": closing[0] if closing else None, "closing_date": closing[1].isoformat() if closing else None, "balance_synced": synced, "dry_run": dry_run, "total": len(items), "duplicates": sum(i["duplicate"] for i in items), "categorized": sum(1 for i in items if i["category_id"]),
            "created": created, "errors": errors[:50], "error_count": len(errors), "rows": result,
            "income": round(sum(i["amount"] for i in items if i["type"] == "income"), 2), "expenses": round(sum(i["amount"] for i in items if i["type"] == "expense"), 2)}
