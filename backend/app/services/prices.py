"""Punto de extensión para cotizaciones externas (Fase 2+).

Implementa `PriceProvider` (p. ej. Yahoo Finance, CoinGecko, Alpha Vantage) y regístralo en PROVIDERS.
`Investment.provider` selecciona qué proveedor usar; "manual" no consulta nada."""
from __future__ import annotations

from typing import Protocol


class PriceProvider(Protocol):
    name: str

    def fetch_price(self, ticker: str, currency: str = "EUR") -> float | None: ...


class ManualProvider:
    name = "manual"

    def fetch_price(self, ticker: str, currency: str = "EUR") -> float | None:
        return None  # el usuario actualiza el precio a mano


PROVIDERS: dict[str, PriceProvider] = {"manual": ManualProvider()}


def refresh(provider: str, ticker: str, currency: str = "EUR") -> float | None:
    p = PROVIDERS.get(provider)
    return p.fetch_price(ticker, currency) if p else None
