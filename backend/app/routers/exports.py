import csv
import io
import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..deps import current_user
from ..models import Account, Budget, Category, Investment, Transaction, User
from ..services import insights, mortgage as mtg
from ..services.ledger import current_balances
from ..models import Mortgage

router = APIRouter(prefix="/export", tags=["export"])

TYPE_ES = {"income": "Ingreso", "expense": "Gasto", "transfer": "Transferencia"}


def _tx_rows(db: Session, uid: int, date_from: date | None, date_to: date | None):
    accs = {a.id: a.name for a in db.scalars(select(Account).where(Account.user_id == uid))}
    cats = {c.id: c.name for c in db.scalars(select(Category).where(Category.user_id == uid))}
    q = select(Transaction).where(Transaction.user_id == uid).order_by(Transaction.date, Transaction.id)
    if date_from:
        q = q.where(Transaction.date >= date_from)
    if date_to:
        q = q.where(Transaction.date <= date_to)
    return [[t.date.isoformat(), TYPE_ES[t.type], t.amount, accs.get(t.account_id, ""), accs.get(t.to_account_id, "") if t.to_account_id else "",
             cats.get(t.category_id, "") if t.category_id else "", t.description, t.notes] for t in db.scalars(q)]


TX_HEADER = ["Fecha", "Tipo", "Importe", "Cuenta", "Cuenta destino", "Categoría", "Concepto", "Notas"]


@router.get("/transactions.csv")
def tx_csv(date_from: date | None = None, date_to: date | None = None, db: Session = Depends(get_db), user: User = Depends(current_user)):
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(TX_HEADER)
    w.writerows(_tx_rows(db, user.id, date_from, date_to))
    return Response(("﻿" + buf.getvalue()).encode("utf-8"), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="movimientos.csv"'})


def _xlsx(db: Session, uid: int, full: bool) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    wb = Workbook()
    head_fill, head_font = PatternFill("solid", fgColor="1E293B"), Font(bold=True, color="FFFFFF")

    def sheet(title: str, header: list[str], rows: list[list]):
        ws = wb.create_sheet(title)
        ws.append(header)
        for c in ws[1]:
            c.fill, c.font = head_fill, head_font
        for r in rows:
            ws.append(r)
        for i, h in enumerate(header, 1):
            ws.column_dimensions[ws.cell(1, i).column_letter].width = max(14, min(48, len(h) + 6))
        ws.freeze_panes = "A2"

    wb.remove(wb.active)
    sheet("Movimientos", TX_HEADER, _tx_rows(db, uid, None, None))
    if full:
        accs = list(db.scalars(select(Account).where(Account.user_id == uid)))
        bals = current_balances(db, uid, accs)
        sheet("Cuentas", ["Nombre", "Banco", "Tipo", "Saldo", "TAE %", "Alta"], [[a.name, a.bank, a.type, bals[a.id], a.interest_rate, a.opened_on.isoformat()] for a in accs])
        sheet("Inversiones", ["Activo", "Tipo", "Cantidad", "Precio compra", "Precio actual", "Comisiones", "Valor", "Plusvalía"],
              [[i.name, i.type, i.quantity, i.buy_price, i.current_price, i.fees, round(i.quantity * i.current_price, 2), round(i.quantity * (i.current_price - i.buy_price) - i.fees, 2)]
               for i in db.scalars(select(Investment).where(Investment.user_id == uid))])
        cats = {c.id: c.name for c in db.scalars(select(Category).where(Category.user_id == uid))}
        sheet("Presupuestos", ["Categoría", "Límite mensual"], [[cats.get(b.category_id, ""), b.amount] for b in db.scalars(select(Budget).where(Budget.user_id == uid))])
        m = db.scalars(select(Mortgage).where(Mortgage.user_id == uid)).first()
        if m:
            sheet("Amortización", ["Nº", "Fecha", "Cuota", "Intereses", "Capital", "Pendiente", "Pagada"], [[r["n"], r["date"], r["payment"], r["interest"], r["principal"], r["balance"], "Sí" if r["paid"] else ""] for r in mtg.schedule_dicts(m)])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


XLSX_MT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/transactions.xlsx")
def tx_xlsx(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return Response(_xlsx(db, user.id, False), media_type=XLSX_MT, headers={"Content-Disposition": 'attachment; filename="movimientos.xlsx"'})


@router.get("/full.xlsx")
def full_xlsx(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return Response(_xlsx(db, user.id, True), media_type=XLSX_MT, headers={"Content-Disposition": 'attachment; filename="finanzas-completo.xlsx"'})


@router.get("/report.pdf")
def report_pdf(db: Session = Depends(get_db), user: User = Depends(current_user)):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    d = insights.dashboard(db, user.id)
    k, b = d["kpis"], d["breakdown"]
    eur = lambda x: f"{x:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")  # noqa: E731
    st = getSampleStyleSheet()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title="Informe financiero", leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40)
    story = [Paragraph("Informe financiero personal", st["Title"]), Paragraph(f"Generado el {datetime.now():%d/%m/%Y %H:%M}", st["Normal"]), Spacer(1, 16)]

    def table(rows, widths=None, header=True):
        t = Table(rows, colWidths=widths, hAlign="LEFT")
        style = [("FONTSIZE", (0, 0), (-1, -1), 9), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]), ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                 ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1"))]
        if header:
            style += [("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white)]
        t.setStyle(TableStyle(style))
        return t

    story += [Paragraph("Patrimonio", st["Heading2"]), table([["Concepto", "Importe"], ["Patrimonio neto", eur(k["net_worth"])], ["Activos totales", eur(k["assets"])], ["  Cuentas corrientes y efectivo", eur(b["cash"])],
                                                              ["  Cuentas remuneradas y ahorro", eur(b["savings"])], ["  Inversiones", eur(b["investments"])], ["  Otros activos", eur(b["other_assets"])],
                                                              ["Pasivos totales", eur(k["liabilities"])], ["  Hipoteca", eur(b["mortgage"])], ["  Otras deudas", eur(b["other_liabilities"])]], [300, 150]), Spacer(1, 12)]
    story += [Paragraph("Flujo del mes en curso", st["Heading2"]), table([["Concepto", "Importe"], ["Ingresos", eur(k["income_month"])], ["Gastos", eur(k["expenses_month"])], ["Ahorro", eur(k["savings_month"])],
                                                                         ["Capacidad media de ahorro mensual", eur(k["monthly_saving_capacity"])]], [300, 150]), Spacer(1, 12)]
    if d["top_categories"]:
        story += [Paragraph("Gasto por categoría (mes en curso)", st["Heading2"]), table([["Categoría", "Importe"]] + [[c["name"], eur(c["amount"])] for c in d["top_categories"]], [300, 150]), Spacer(1, 12)]
    story += [Paragraph("Evolución mensual", st["Heading2"]), table([["Mes", "Ingresos", "Gastos", "Patrimonio neto"]] + [[r["month"], eur(r["income"]), eur(r["expenses"]), eur(r["net_worth"])] for r in d["series"]], [90, 120, 120, 140])]
    if d["recommendations"]:
        story += [Spacer(1, 12), Paragraph("Recomendaciones", st["Heading2"])] + [Paragraph(f"• <b>{r['title']}</b>: {r['message']}", st["Normal"]) for r in d["recommendations"]]
    doc.build(story)
    return Response(buf.getvalue(), media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="informe-financiero.pdf"'})


# ---------- copia de seguridad JSON (exportar / importar todos los datos del usuario) ----------
# Orden respetando claves foráneas. (modelo, columna que identifica al propietario)
def _backup_tables():
    from .. import models as m
    return [m.UserSettings, m.Account, m.Category, m.Transaction, m.Budget, m.Mortgage, m.Liability, m.OtherAsset, m.Investment, m.PriceHistory, m.Goal, m.CategoryRule]


def _serial(v):
    return v.isoformat() if isinstance(v, (date, datetime)) else v


@router.get("/backup.json")
def backup(db: Session = Depends(get_db), user: User = Depends(current_user)):
    out: dict = {"version": 1, "exported_at": datetime.now().isoformat(), "tables": {}}
    inv_ids = [i.id for i in db.scalars(select(Investment).where(Investment.user_id == user.id))]
    for M in _backup_tables():
        q = select(M)
        if M.__name__ == "PriceHistory":
            q = q.where(M.investment_id.in_(inv_ids or [-1]))
        else:
            q = q.where(M.user_id == user.id)
        out["tables"][M.__tablename__] = [{c.name: _serial(getattr(r, c.name)) for c in M.__table__.columns} for r in db.scalars(q)]
    return Response(json.dumps(out, ensure_ascii=False, indent=1), media_type="application/json", headers={"Content-Disposition": 'attachment; filename="backup-finanzas.json"'})


def wipe_user_data(db: Session, uid: int) -> None:
    from .. import models as m
    inv_ids = [i.id for i in db.scalars(select(m.Investment).where(m.Investment.user_id == uid))]
    if inv_ids:
        db.execute(delete(m.PriceHistory).where(m.PriceHistory.investment_id.in_(inv_ids)))
    for M in reversed(_backup_tables()):
        if M.__name__ != "PriceHistory":
            db.execute(delete(M).where(M.user_id == uid))


@router.post("/restore")
async def restore(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Restaura un backup.json REEMPLAZANDO todos los datos del usuario. Los ids se remapean (válido entre usuarios/BD)."""
    try:
        data = json.loads(await file.read())
        tables = data["tables"]
    except Exception:
        raise HTTPException(422, "Archivo de copia de seguridad no válido")
    from datetime import date as D

    models = {M.__tablename__: M for M in _backup_tables()}
    wipe_user_data(db, user.id)
    db.flush()
    idmap: dict[str, dict[int, int]] = {}
    fks = {"accounts": {}, "categories": {}, "transactions": {"account_id": "accounts", "to_account_id": "accounts", "category_id": "categories"},
           "budgets": {"category_id": "categories"}, "category_rules": {"category_id": "categories"}, "price_history": {"investment_id": "investments"}}
    for M in _backup_tables():
        name = M.__tablename__
        idmap[name] = {}
        for row in tables.get(name, []):
            row = dict(row)
            old = row.pop("id", None)
            for col in M.__table__.columns:
                if col.name in row and row[col.name] is not None and str(col.type).startswith(("DATE",)) and not str(col.type).startswith("DATETIME"):
                    row[col.name] = D.fromisoformat(row[col.name][:10])
                elif col.name in row and row[col.name] is not None and str(col.type).startswith("DATETIME"):
                    row[col.name] = datetime.fromisoformat(row[col.name])
            for fk, ref in fks.get(name, {}).items():
                if row.get(fk) is not None:
                    row[fk] = idmap[ref].get(row[fk])
            if "user_id" in row:
                row["user_id"] = user.id
            if name == "transactions":
                row["import_hash"] = row.get("import_hash")
            obj = M(**row)
            db.add(obj)
            db.flush()
            idmap[name][old] = obj.id
    db.commit()
    return {"restored": {k: len(v) for k, v in tables.items()}}
