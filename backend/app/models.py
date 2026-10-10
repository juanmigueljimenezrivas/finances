"""Modelo de datos. Todas las tablas de dominio llevan user_id => multiusuario listo para la Fase 2.
Importes: Numeric(14,2) (exacto en PostgreSQL, float en SQLite)."""
from __future__ import annotations

import datetime as dt
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .core.db import Base

Money = Numeric(14, 2, asdecimal=False)
Rate = Numeric(8, 4, asdecimal=False)
Qty = Numeric(20, 8, asdecimal=False)
Price = Numeric(20, 6, asdecimal=False)

ACCOUNT_TYPES = ("checking", "remunerated", "savings", "cash", "other")
INVESTMENT_TYPES = ("etf", "index_fund", "stock", "crypto", "bond")


def _uid() -> Mapped[int]:
    return mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    hashed_password: Mapped[str] = mapped_column(String(255), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    name: Mapped[str] = mapped_column(String(120))
    bank: Mapped[str] = mapped_column(String(120), default="")
    type: Mapped[str] = mapped_column(String(20), default="checking")
    # Saldo al INICIO del día `opened_on`. Los movimientos posteriores lo modifican; los anteriores
    # permiten reconstruir el histórico hacia atrás (importar historial no altera el saldo actual).
    initial_balance: Mapped[float] = mapped_column(Money, default=0)
    opened_on: Mapped[dt.date] = mapped_column(Date, default=dt.date.today)
    interest_rate: Mapped[float | None] = mapped_column(Rate, nullable=True)  # TAE %
    include_in_emergency: Mapped[bool] = mapped_column(Boolean, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "kind", "name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    name: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(10))  # income | expense
    color: Mapped[str] = mapped_column(String(16), default="#64748b")
    icon: Mapped[str] = mapped_column(String(8), default="🏷️")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)


class Transaction(Base):
    """Libro mayor. amount siempre > 0; el signo lo da `type`. Las transferencias son UN movimiento
    (account_id -> to_account_id) que no cuenta como ingreso ni gasto."""
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_tx_amount_positive"),
        Index("ix_tx_user_date", "user_id", "date"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    date: Mapped[dt.date] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Money)
    type: Mapped[str] = mapped_column(String(10))  # income | expense | transfer
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    to_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    description: Mapped[str] = mapped_column(String(500), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    import_hash: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("user_id", "category_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"))
    amount: Mapped[float] = mapped_column(Money)  # límite mensual


class Mortgage(Base):
    __tablename__ = "mortgages"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    name: Mapped[str] = mapped_column(String(120), default="Hipoteca")
    initial_principal: Mapped[float] = mapped_column(Money)
    annual_rate: Mapped[float] = mapped_column(Rate)  # % nominal anual
    monthly_payment: Mapped[float | None] = mapped_column(Money, nullable=True)  # None => se calcula (sistema francés)
    start_date: Mapped[dt.date] = mapped_column(Date)
    end_date: Mapped[dt.date] = mapped_column(Date)
    # Opcional: capital pendiente real según el banco (re-ancla el cuadro de amortización)
    balance_override: Mapped[float | None] = mapped_column(Money, nullable=True)
    override_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    property_value: Mapped[float | None] = mapped_column(Money, nullable=True)


class Liability(Base):
    __tablename__ = "liabilities"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(20), default="loan")  # loan | debt | other
    balance: Mapped[float] = mapped_column(Money)
    annual_rate: Mapped[float | None] = mapped_column(Rate, nullable=True)
    monthly_payment: Mapped[float | None] = mapped_column(Money, nullable=True)


class OtherAsset(Base):
    __tablename__ = "other_assets"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(30), default="other")  # property | vehicle | other
    value: Mapped[float] = mapped_column(Money)


class Investment(Base):
    __tablename__ = "investments"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    name: Mapped[str] = mapped_column(String(160))
    ticker: Mapped[str] = mapped_column(String(40), default="")
    type: Mapped[str] = mapped_column(String(20), default="etf")
    quantity: Mapped[float] = mapped_column(Qty)
    buy_price: Mapped[float] = mapped_column(Price)
    current_price: Mapped[float] = mapped_column(Price)
    fees: Mapped[float] = mapped_column(Money, default=0)
    purchase_date: Mapped[dt.date] = mapped_column(Date, default=dt.date.today)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    provider: Mapped[str] = mapped_column(String(30), default="manual")  # integración futura con APIs de precios
    last_price_at: Mapped[dt.date | None] = mapped_column(Date, nullable=True)


class PriceHistory(Base):
    __tablename__ = "price_history"
    __table_args__ = (UniqueConstraint("investment_id", "date"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    investment_id: Mapped[int] = mapped_column(ForeignKey("investments.id", ondelete="CASCADE"), index=True)
    date: Mapped[dt.date] = mapped_column(Date)
    price: Mapped[float] = mapped_column(Price)


class Goal(Base):
    __tablename__ = "goals"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(30), default="other")  # trip | car | emergency | house | investment | other
    target_amount: Mapped[float] = mapped_column(Money)
    current_amount: Mapped[float] = mapped_column(Money, default=0)
    target_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class CategoryRule(Base):
    __tablename__ = "category_rules"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = _uid()
    pattern: Mapped[str] = mapped_column(String(200))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"))
    match_type: Mapped[str] = mapped_column(String(10), default="contains")  # contains | startswith | regex
    priority: Mapped[int] = mapped_column(Integer, default=100)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class UserSettings(Base):
    __tablename__ = "user_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    emergency_months_target: Mapped[int] = mapped_column(Integer, default=6)
    # Proyecciones: rentabilidad anual esperada (%) por escenario
    return_conservative: Mapped[float] = mapped_column(Rate, default=2.0)
    return_realistic: Mapped[float] = mapped_column(Rate, default=5.0)
    return_optimistic: Mapped[float] = mapped_column(Rate, default=8.0)
    inflation: Mapped[float] = mapped_column(Rate, default=2.5)
    monthly_saving_override: Mapped[float | None] = mapped_column(Money, nullable=True)
    # FIRE
    fire_withdrawal_rate: Mapped[float] = mapped_column(Rate, default=4.0)
    fire_annual_expenses_override: Mapped[float | None] = mapped_column(Money, nullable=True)
