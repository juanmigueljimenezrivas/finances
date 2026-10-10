"""Datos iniciales por usuario: categorías, reglas de categorización y ajustes."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Category, CategoryRule, User, UserSettings

EXPENSE_CATS = [
    ("Hipoteca", "🏠", "#6366f1"), ("Alimentación", "🛒", "#22c55e"), ("Restaurantes", "🍽️", "#f97316"),
    ("Suscripciones", "📺", "#a855f7"), ("Gimnasio", "🏋️", "#14b8a6"), ("Transporte", "🚆", "#0ea5e9"),
    ("Gasolina", "⛽", "#eab308"), ("Seguros", "🛡️", "#64748b"), ("Salud", "💊", "#ef4444"),
    ("Tecnología", "💻", "#3b82f6"), ("Viajes", "✈️", "#06b6d4"), ("Formación", "🎓", "#8b5cf6"),
    ("Hogar", "🛋️", "#f59e0b"), ("Mascotas", "🐾", "#ec4899"), ("Impuestos", "🧾", "#78716c"),
    ("Ocio", "🎮", "#d946ef"), ("Otros", "📦", "#94a3b8"),
]
INCOME_CATS = [
    ("Nómina", "💼", "#22c55e"), ("Bonus", "🎯", "#10b981"), ("Pagas extra", "🎁", "#84cc16"),
    ("Ingresos extraordinarios", "⭐", "#eab308"), ("Devoluciones", "↩️", "#06b6d4"),
    ("Intereses", "🏦", "#3b82f6"), ("Otros", "📦", "#94a3b8"),
]

DEFAULT_RULES = {
    "Alimentación": ["MERCADONA", "CARREFOUR", "LIDL", "ALCAMPO", "DIA SUPERMERCADOS", "EROSKI", "CONSUM", "AHORRAMAS"],
    "Gasolina": ["REPSOL", "CEPSA", "GALP", "SHELL", "BP ESTACION"],
    "Suscripciones": ["NETFLIX", "SPOTIFY", "HBO", "DISNEY", "PRIME VIDEO", "YOUTUBE PREMIUM", "ICLOUD", "DAZN"],
    "Gimnasio": ["GOFIT", "BASIC-FIT", "VIVAGYM", "GIMNASIO", "MC FIT"],
    "Transporte": ["UBER", "CABIFY", "RENFE", "METRO", "BLABLACAR", "BOLT", "ALSA"],
    "Restaurantes": ["MCDONALD", "BURGER KING", "GLOVO", "JUST EAT", "TELEPIZZA", "RESTAURANTE", "STARBUCKS", "UBER EATS"],
    "Salud": ["FARMACIA", "CLINICA", "DENTAL", "SANITAS"],
    "Hogar": ["IBERDROLA", "ENDESA", "NATURGY", "IKEA", "LEROY MERLIN", "AGUAS DE", "CANAL ISABEL"],
    "Seguros": ["MAPFRE", "AXA", "MUTUA", "SEGURO"],
    "Tecnología": ["PCCOMPONENTES", "APPLE.COM", "MEDIAMARKT", "FNAC"],
    "Viajes": ["BOOKING", "RYANAIR", "VUELING", "AIRBNB", "IBERIA"],
    "Hipoteca": ["PRESTAMO HIPOTECARIO", "HIPOTECA", "CUOTA PRESTAMO"],
    "Impuestos": ["AEAT", "HACIENDA", "AGENCIA TRIBUTARIA", "IBI"],
}
INCOME_RULES = {"Nómina": ["NOMINA", "NÓMINA", "TRANSFERENCIA NOMINA"], "Intereses": ["INTERESES", "LIQUIDACION INTERESES"]}


def bootstrap_user(db: Session, user: User) -> None:
    if not db.scalars(select(Category).where(Category.user_id == user.id)).first():
        cats: dict[tuple[str, str], Category] = {}
        for kind, items in (("expense", EXPENSE_CATS), ("income", INCOME_CATS)):
            for name, icon, color in items:
                c = Category(user_id=user.id, name=name, kind=kind, icon=icon, color=color, is_system=True)
                db.add(c)
                cats[(kind, name)] = c
        db.flush()
        for kind, rules in (("expense", DEFAULT_RULES), ("income", INCOME_RULES)):
            for cname, pats in rules.items():
                for p in pats:
                    db.add(CategoryRule(user_id=user.id, pattern=p, category_id=cats[(kind, cname)].id))
    if not db.scalars(select(UserSettings).where(UserSettings.user_id == user.id)).first():
        db.add(UserSettings(user_id=user.id))
    db.commit()
