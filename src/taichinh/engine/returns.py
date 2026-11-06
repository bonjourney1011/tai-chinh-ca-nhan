"""Price alignment and return conversions. Simple returns, sample moments, 252 trading days."""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from taichinh.engine.types import AlignedPrices, PriceSeries

TRADING_DAYS = 252
MONTHS = 12


def align_on_common_dates(series: list[PriceSeries]) -> AlignedPrices:
    """Inner join on dates: keep sessions where every symbol has a finite positive close."""
    lookups = [dict(zip(s.dates, np.asarray(s.closes, dtype=float), strict=False)) for s in series]

    def ok(d: str) -> bool:
        return all(d in m and np.isfinite(m[d]) and m[d] > 0 for m in lookups)

    dates = sorted(d for d in lookups[0] if ok(d))
    closes = np.array([[m[d] for d in dates] for m in lookups], dtype=float)
    return AlignedPrices([s.symbol for s in series], dates, closes.reshape(len(series), len(dates)))


def simple_returns(closes: np.ndarray) -> np.ndarray:
    """R_t = P_t / P_{t-1} - 1 along the last axis (1-D or [asset, day])."""
    c = np.asarray(closes, dtype=float)
    return c[..., 1:] / c[..., :-1] - 1.0


def log_returns(closes: np.ndarray) -> np.ndarray:
    c = np.asarray(closes, dtype=float)
    return np.log(c[..., 1:] / c[..., :-1])


def to_monthly(prices: pd.DataFrame, today: date | None = None) -> pd.DataFrame:
    """Daily prices (DatetimeIndex) -> month-end last close -> monthly simple returns.
    Only completed months are used: a month whose end is after `today` is dropped."""
    closes = prices.resample("ME").last()
    closes = closes[closes.index <= pd.Timestamp(today or date.today())]
    return closes.pct_change(fill_method=None).dropna(how="all")


def annualize_mean(r: np.ndarray, periods: int = TRADING_DAYS) -> np.ndarray:
    return np.mean(r, axis=0) * periods


def annualize_cov(cov: np.ndarray, periods: int = TRADING_DAYS) -> np.ndarray:
    return np.asarray(cov) * periods


def monthly_rate(annual: float) -> float:
    return (1.0 + annual) ** (1.0 / MONTHS) - 1.0


def annual_rate(monthly: float) -> float:
    return (1.0 + monthly) ** MONTHS - 1.0
