from datetime import date


def test_health_and_meta(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/auth/meta").json()["auth_enabled"] is False


def test_full_flow(client):
    cats = client.get("/api/categories").json()
    exp = {c["name"]: c["id"] for c in cats if c["kind"] == "expense"}
    inc = {c["name"]: c["id"] for c in cats if c["kind"] == "income"}
    assert "Hipoteca" in exp and "Nómina" in inc

    a = client.post("/api/accounts", json={"name": "Nómina", "type": "checking", "initial_balance": 1000, "opened_on": "2020-01-01"}).json()
    b = client.post("/api/accounts", json={"name": "Remunerada", "type": "remunerated", "initial_balance": 0, "opened_on": "2020-01-01", "interest_rate": 3}).json()
    today = date.today().isoformat()
    assert client.post("/api/transactions", json={"date": today, "amount": 2000, "type": "income", "account_id": a["id"], "category_id": inc["Nómina"]}).status_code == 201
    # categorización automática por reglas
    t = client.post("/api/transactions", json={"date": today, "amount": 50, "type": "expense", "account_id": a["id"], "description": "COMPRA MERCADONA 123"}).json()
    assert t["category_id"] == exp["Alimentación"]
    assert client.post("/api/transactions", json={"date": today, "amount": 500, "type": "transfer", "account_id": a["id"], "to_account_id": b["id"]}).status_code == 201

    accs = {x["name"]: x["balance"] for x in client.get("/api/accounts").json()}
    assert accs["Nómina"] == 2450 and accs["Remunerada"] == 500

    # una categoría de gasto no vale para un ingreso
    assert client.post("/api/transactions", json={"date": today, "amount": 5, "type": "income", "account_id": a["id"], "category_id": exp["Ocio"]}).status_code == 422

    d = client.get("/api/dashboard").json()
    assert d["kpis"]["net_worth"] == 2950
    assert d["kpis"]["income_month"] == 2000 and d["kpis"]["expenses_month"] == 50

    client.put("/api/budgets", json={"category_id": exp["Alimentación"], "amount": 40})
    bud = client.get("/api/budgets").json()
    assert bud["items"][0]["over"] is True

    assert client.get("/api/emergency").status_code == 200
    assert client.get("/api/savings").json()["accounts"][0]["annual_interest"] == 15.0
    p = client.post("/api/projections", json={"years": 10, "monthly_saving": 300}).json()
    assert len(p["scenarios"]) == 3 and p["scenarios"][2]["points"][-1]["net_worth"] > p["scenarios"][0]["points"][-1]["net_worth"]
    f = client.post("/api/fire", json={"annual_expenses": 24000, "expected_return": 5, "inflation": 2}).json()
    assert f["fire_number"] == 600000

    for url in ("/api/export/transactions.csv", "/api/export/transactions.xlsx", "/api/export/full.xlsx", "/api/export/report.pdf", "/api/export/backup.json"):
        r = client.get(url)
        assert r.status_code == 200 and len(r.content) > 100, url


def test_import_wizard(client):
    acc = client.get("/api/accounts").json()[0]
    csv = "Fecha operación;Concepto;Importe;Saldo\n01/03/2024;COMPRA NETFLIX.COM;-12,99;1000,00\n02/03/2024;NOMINA EMPRESA;2.000,00;3000\n02/03/2024;PAGO REPSOL;-45,10;2955\n".encode()
    pv = client.post("/api/import/preview", files={"file": ("mov.csv", csv, "text/csv")}).json()
    assert pv["mapping"]["date"] == "Fecha operación" and pv["mapping"]["amount"] == "Importe" and pv["decimal"] == "," and pv["date_format"] == "%d/%m/%Y"
    import json
    mp = {"date": pv["mapping"]["date"], "description": pv["mapping"]["description"], "amount": pv["mapping"]["amount"], "date_format": pv["date_format"], "decimal": pv["decimal"]}
    data = {"mapping": json.dumps(mp), "account_id": str(acc["id"]), "header_row": str(pv["header_row"])}
    dry = client.post("/api/import/commit", data={**data, "dry_run": "true"}, files={"file": ("mov.csv", csv, "text/csv")}).json()
    assert dry["total"] == 3 and dry["categorized"] == 3 and dry["created"] == 0
    real = client.post("/api/import/commit", data={**data, "dry_run": "false"}, files={"file": ("mov.csv", csv, "text/csv")}).json()
    assert real["created"] == 3
    again = client.post("/api/import/commit", data={**data, "dry_run": "false"}, files={"file": ("mov.csv", csv, "text/csv")}).json()
    assert again["created"] == 0 and again["duplicates"] == 3


def test_backup_restore_roundtrip(client):
    before = client.get("/api/transactions?limit=500").json()["total"]
    bk = client.get("/api/export/backup.json").content
    r = client.post("/api/export/restore", files={"file": ("b.json", bk, "application/json")})
    assert r.status_code == 200, r.text
    assert client.get("/api/transactions?limit=500").json()["total"] == before


def test_demo_and_reset(client):
    assert client.post("/api/data/reset?confirm=true").status_code == 200
    assert client.post("/api/data/demo").status_code == 200
    d = client.get("/api/dashboard").json()
    assert d["kpis"]["net_worth"] > 0 and len(d["series"]) >= 12
    assert client.get("/api/mortgage").json()["summary"]["pending_balance"] > 0
    assert client.get("/api/investments").json()["totals"]["value"] > 0
    assert len(client.get("/api/recommendations").json()) >= 0
    assert client.get("/api/goals").status_code == 200


def test_import_bank_xlsx_with_balance(client):
    import io
    import json
    from datetime import datetime

    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["Nombre", "Titular Ficticio"])
    ws.append(["IBAN", "ES00 0000 0000 0000 0000 0000"])
    ws.append([])
    ws.append(["Fecha de la operación", "Fecha valor", "Tipo movimiento", "Importe", "Saldo", "Nro. Apunte"])
    ws.append([datetime(2026, 3, 2, 1, 59), datetime(2026, 3, 2, 1, 59), "cargo bizum - tienda", -15.95, 484.05, 2])
    ws.append([datetime(2026, 3, 1, 1, 59), datetime(2026, 3, 1, 1, 59), "abono bizum - amigo", 100, 500, 1])
    buf = io.BytesIO()
    wb.save(buf)
    acc = client.post("/api/accounts", json={"name": "Banco xlsx", "type": "checking", "initial_balance": 0}).json()
    f = {"file": ("movimientos.xlsx", buf.getvalue(), "application/octet-stream")}
    pv = client.post("/api/import/preview", files=f).json()
    assert pv["mapping"]["date"] == "Fecha de la operación" and pv["mapping"]["amount"] == "Importe" and pv["mapping"]["balance"] == "Saldo"
    mp = {**{k: v for k, v in pv["mapping"].items() if v}, "date_format": pv["date_format"], "decimal": pv["decimal"]}
    data = {"mapping": json.dumps(mp), "account_id": str(acc["id"]), "header_row": str(pv["header_row"]), "dry_run": "false", "sync_balance": "true"}
    r = client.post("/api/import/commit", data=data, files=f).json()
    assert r["created"] == 2 and r["closing_balance"] == 484.05 and r["balance_synced"] == 484.05
    assert next(a for a in client.get("/api/accounts").json() if a["id"] == acc["id"])["balance"] == 484.05


def test_transfer_before_opening_counts_in_remunerated(client):
    a = client.post("/api/accounts", json={"name": "N2", "type": "checking", "initial_balance": 1000}).json()
    r = client.post("/api/accounts", json={"name": "R2", "type": "remunerated", "interest_rate": 3}).json()
    client.post("/api/transactions", json={"date": "2020-01-01", "amount": 500, "type": "transfer", "account_id": a["id"], "to_account_id": r["id"]})
    bal = {x["id"]: x["balance"] for x in client.get("/api/accounts").json()}
    assert bal[r["id"]] == 500 and bal[a["id"]] == 500
