"""Kraken public OHLC (daily candles, USD quote) for crypto assets with source: kraken.
Public market data needs no key. OHLC returns at most 720 candles per call, so backfills
beyond ~2 years are fetched in 700-day windows via `since`."""

from __future__ import annotations

from datetime import UTC, date, datetime, time

import pandas as pd

from taichinh import settings
from taichinh.fetch import http_client
from taichinh.fetch.common import now_iso, windows
from taichinh.store.schemas import GLOBAL_DAILY

URL = "https://api.kraken.com/0/public/OHLC"
INTERVAL_MIN = 1440
MAX_WINDOW_DAYS = 700
# Kraken answers with its internal pair name (XXBTZUSD for XBTUSD); map back to the symbol.
ALIASES = {"XXBTZUSD": "XBTUSD", "XETHZUSD": "ETHUSD"}


def parse_kraken(raw: dict, symbol: str, fetched_at: str | None = None) -> pd.DataFrame:
    """OHLC JSON -> GLOBAL_DAILY rows (close in USD). Unknown/err payloads -> empty frame."""
    cols = list(GLOBAL_DAILY.columns)
    if not raw or raw.get("error") or not raw.get("result"):
        return pd.DataFrame(columns=cols)
    candles = None
    for key, val in raw["result"].items():
        if key != "last" and ALIASES.get(key, key) == symbol:
            candles = val
    if not candles:
        return pd.DataFrame(columns=cols)
    df = pd.DataFrame(
        {
            "date": [datetime.fromtimestamp(int(c[0]), UTC).strftime("%Y-%m-%d") for c in candles],
            "symbol": symbol,
            "close_usd": [round(float(c[4]), 6) for c in candles],
            "source": "kraken",
            "fetched_at": fetched_at or now_iso(),
        }
    )
    return df[cols].drop_duplicates(["date", "symbol"], keep="last")


def configured_symbols() -> list[str]:
    cfg = settings.load_yaml("assets.yml")
    return [a["symbol"] for a in cfg.get("assets", []) if a.get("source") == "kraken"]


def _unix(d: date) -> int:
    return int(datetime.combine(d, time(0, 0), tzinfo=UTC).timestamp())


def fetch_crypto(start: date, end: date, symbols: list[str] | None = None) -> pd.DataFrame:
    frames = []
    for sym in symbols or configured_symbols():
        for lo, hi in windows(start, end, MAX_WINDOW_DAYS):
            params = {"pair": sym, "interval": INTERVAL_MIN, "since": _unix(lo) - 1}
            df = parse_kraken(http_client.get_json(URL, params), sym)
            frames.append(df[(df["date"] >= lo.isoformat()) & (df["date"] <= hi.isoformat())])
    frames = [f for f in frames if not f.empty]
    if not frames:
        return pd.DataFrame(columns=list(GLOBAL_DAILY.columns))
    return pd.concat(frames, ignore_index=True)
