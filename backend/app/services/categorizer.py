"""Categorización automática por reglas (contiene / empieza por / regex), por prioridad."""
from __future__ import annotations

import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Category, CategoryRule


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).upper().strip()


class Categorizer:
    def __init__(self, db: Session, uid: int):
        kinds = {c.id: c.kind for c in db.scalars(select(Category).where(Category.user_id == uid))}
        rules = db.scalars(select(CategoryRule).where(CategoryRule.user_id == uid, CategoryRule.is_active == True).order_by(CategoryRule.priority, CategoryRule.id))  # noqa: E712
        self.rules = [(r, kinds.get(r.category_id)) for r in rules if r.category_id in kinds]

    def match(self, description: str, kind: str) -> int | None:
        text = norm(description)
        for r, rk in self.rules:
            if rk != kind:
                continue
            p = norm(r.pattern)
            if r.match_type == "contains" and p in text:
                return r.category_id
            if r.match_type == "startswith" and text.startswith(p):
                return r.category_id
            if r.match_type == "regex":
                try:
                    if re.search(r.pattern, description or "", re.I):
                        return r.category_id
                except re.error:
                    continue
        return None
