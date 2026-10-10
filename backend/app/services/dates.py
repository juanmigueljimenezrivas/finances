import calendar
from datetime import date


def add_months(d: date, n: int) -> date:
    m = d.month - 1 + n
    y = d.year + m // 12
    m = m % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def months_between(a: date, b: date) -> int:
    return (b.year - a.year) * 12 + (b.month - a.month)


def first_of_month(d: date) -> date:
    return d.replace(day=1)


def last_of_month(d: date) -> date:
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def month_starts(n: int, end: date | None = None) -> list[date]:
    """Los n últimos meses (primer día) terminando en el mes de `end` (incluido)."""
    end = first_of_month(end or date.today())
    return [add_months(end, -i) for i in range(n - 1, -1, -1)]


def ym(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"
