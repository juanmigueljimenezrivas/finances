from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

AccountType = Literal["checking", "remunerated", "savings", "cash", "other"]
TxType = Literal["income", "expense", "transfer"]
InvType = Literal["etf", "index_fund", "stock", "crypto", "bond"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth ----------
class UserOut(ORM):
    id: int
    email: str
    name: str


class RegisterIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    name: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- accounts ----------
class AccountIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    bank: str = ""
    type: AccountType = "checking"
    initial_balance: float = 0
    opened_on: dt.date = Field(default_factory=dt.date.today)
    interest_rate: float | None = Field(default=None, ge=0, le=100)
    include_in_emergency: bool = False
    is_archived: bool = False
    color: str | None = None


class AccountOut(ORM, AccountIn):
    id: int
    balance: float = 0


# ---------- categories / rules ----------
class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: Literal["income", "expense"]
    color: str = "#64748b"
    icon: str = "🏷️"


class CategoryOut(ORM, CategoryIn):
    id: int
    is_system: bool = False


class RuleIn(BaseModel):
    pattern: str = Field(min_length=1, max_length=200)
    category_id: int
    match_type: Literal["contains", "startswith", "regex"] = "contains"
    priority: int = 100
    is_active: bool = True


class RuleOut(ORM, RuleIn):
    id: int


# ---------- transactions ----------
class TransactionIn(BaseModel):
    date: dt.date
    amount: float = Field(gt=0)
    type: TxType
    account_id: int
    to_account_id: int | None = None
    category_id: int | None = None
    description: str = Field(default="", max_length=500)
    notes: str = ""

    @model_validator(mode="after")
    def _check(self):
        if self.type == "transfer":
            if not self.to_account_id or self.to_account_id == self.account_id:
                raise ValueError("La transferencia necesita una cuenta destino distinta")
            self.category_id = None
        else:
            self.to_account_id = None
        return self


class TransactionOut(ORM, TransactionIn):
    id: int


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    total: int
    sum_income: float
    sum_expense: float


# ---------- budgets ----------
class BudgetIn(BaseModel):
    category_id: int
    amount: float = Field(ge=0)


# ---------- mortgage ----------
class MortgageIn(BaseModel):
    name: str = "Hipoteca"
    initial_principal: float = Field(gt=0)
    annual_rate: float = Field(ge=0, le=100)
    monthly_payment: float | None = Field(default=None, gt=0)
    start_date: dt.date
    end_date: dt.date
    balance_override: float | None = Field(default=None, ge=0)
    override_date: dt.date | None = None
    property_value: float | None = None

    @model_validator(mode="after")
    def _check(self):
        if self.end_date <= self.start_date:
            raise ValueError("La fecha fin debe ser posterior al inicio")
        if self.balance_override is not None and self.override_date is None:
            self.override_date = dt.date.today()
        return self


class MortgageOut(ORM, MortgageIn):
    id: int


class PrepaymentScenario(BaseModel):
    extra: float = Field(ge=0)
    mode: Literal["once", "monthly"] = "once"  # una vez ahora / cada mes
    strategy: Literal["term", "payment"] = "term"  # reducir plazo / reducir cuota


class SimulateIn(BaseModel):
    scenarios: list[PrepaymentScenario]


# ---------- investments / patrimonio ----------
class InvestmentIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    ticker: str = ""
    type: InvType = "etf"
    quantity: float = Field(gt=0)
    buy_price: float = Field(ge=0)
    current_price: float | None = Field(default=None, ge=0)
    fees: float = Field(default=0, ge=0)
    purchase_date: dt.date = Field(default_factory=dt.date.today)
    currency: str = "EUR"
    provider: str = "manual"


class InvestmentOut(ORM, InvestmentIn):
    id: int
    current_price: float
    cost: float = 0
    value: float = 0
    pnl: float = 0
    pnl_pct: float = 0


class PriceUpdate(BaseModel):
    price: float = Field(ge=0)
    date: dt.date = Field(default_factory=dt.date.today)


class LiabilityIn(BaseModel):
    name: str = Field(min_length=1)
    kind: Literal["loan", "debt", "other"] = "loan"
    balance: float = Field(ge=0)
    annual_rate: float | None = None
    monthly_payment: float | None = None


class LiabilityOut(ORM, LiabilityIn):
    id: int


class OtherAssetIn(BaseModel):
    name: str = Field(min_length=1)
    kind: Literal["property", "vehicle", "other"] = "other"
    value: float = Field(ge=0)


class OtherAssetOut(ORM, OtherAssetIn):
    id: int


# ---------- goals ----------
class GoalIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: Literal["trip", "car", "emergency", "house", "investment", "other"] = "other"
    target_amount: float = Field(gt=0)
    current_amount: float = Field(default=0, ge=0)
    target_date: dt.date | None = None


class GoalOut(ORM, GoalIn):
    id: int


# ---------- settings / planning ----------
class SettingsIn(BaseModel):
    currency: str = "EUR"
    emergency_months_target: int = Field(default=6, ge=1, le=36)
    return_conservative: float = 2.0
    return_realistic: float = 5.0
    return_optimistic: float = 8.0
    inflation: float = 2.5
    monthly_saving_override: float | None = None
    fire_withdrawal_rate: float = Field(default=4.0, gt=0, le=20)
    fire_annual_expenses_override: float | None = None


class SettingsOut(ORM, SettingsIn):
    pass


class ProjectionIn(BaseModel):
    monthly_saving: float | None = None  # None => ahorro medio real
    initial_assets: float | None = None  # None => cuentas + inversiones actuales
    years: int = Field(default=20, ge=1, le=50)
    real_terms: bool = False  # descontar inflación
    returns: dict[str, float] | None = None  # sobreescribe rentabilidades por escenario


class FireIn(BaseModel):
    annual_expenses: float | None = None
    savings_rate: float | None = Field(default=None, ge=0, le=100)  # % sobre ingresos; None => ahorro real
    expected_return: float | None = None
    inflation: float | None = None
    withdrawal_rate: float | None = Field(default=None, gt=0, le=20)
    initial_assets: float | None = None


# ---------- import ----------
class ColumnMapping(BaseModel):
    date: str
    description: str | None = None
    amount: str | None = None
    debit: str | None = None  # columnas separadas cargo/abono
    credit: str | None = None
    balance: str | None = None  # saldo tras cada movimiento
    date_format: str | None = None
    decimal: Literal[",", "."] | None = None
    invert_sign: bool = False
