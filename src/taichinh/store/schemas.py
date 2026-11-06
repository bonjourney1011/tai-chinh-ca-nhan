"""CSV contracts for data/market. Single source of truth for columns and upsert keys."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CsvSchema:
    file: str
    columns: tuple[str, ...]
    keys: tuple[str, ...]


PROVENANCE = ("source", "fetched_at")

STOCKS_DAILY = CsvSchema(
    "stocks_daily.csv",
    ("date", "symbol", "close", "open", "high", "low", "volume", *PROVENANCE),
    ("date", "symbol"),
)
GOLD_DAILY = CsvSchema(
    "gold_daily.csv",
    ("date", "product", "buy_vnd_luong", "sell_vnd_luong", *PROVENANCE),
    ("date", "product"),
)
FX_DAILY = CsvSchema(
    "fx_daily.csv",
    ("date", "ccy", "buy_transfer", "sell", *PROVENANCE),
    ("date", "ccy"),
)
DEPOSIT_RATES_MONTHLY = CsvSchema(
    "deposit_rates_monthly.csv",
    ("month", "bank", "term_months", "rate_pa", *PROVENANCE),
    ("month", "bank", "term_months"),
)
FUND_NAV_MONTHLY = CsvSchema(
    "fund_nav_monthly.csv",
    ("month", "fund_code", "nav", *PROVENANCE),
    ("month", "fund_code"),
)
BOND_YIELDS_MONTHLY = CsvSchema(
    "bond_yields_monthly.csv",
    ("month", "tenor_years", "yield_pa", *PROVENANCE),
    ("month", "tenor_years"),
)
MACRO_MONTHLY = CsvSchema(
    "macro_monthly.csv",
    ("period", "series_code", "value", *PROVENANCE),
    ("period", "series_code"),
)
GLOBAL_DAILY = CsvSchema(
    "global_daily.csv",
    ("date", "symbol", "close_usd", *PROVENANCE),
    ("date", "symbol"),
)

ALL_SCHEMAS: dict[str, CsvSchema] = {
    s.file: s
    for s in (
        STOCKS_DAILY,
        GOLD_DAILY,
        FX_DAILY,
        DEPOSIT_RATES_MONTHLY,
        FUND_NAV_MONTHLY,
        BOND_YIELDS_MONTHLY,
        MACRO_MONTHLY,
        GLOBAL_DAILY,
    )
}
