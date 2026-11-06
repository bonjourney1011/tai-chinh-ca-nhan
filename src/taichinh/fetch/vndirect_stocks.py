"""VNDirect dchart (TradingView UDF) daily OHLCV for stocks/ETFs and VN-Index."""

from __future__ import annotations

from datetime import UTC, date, datetime, time

import pandas as pd

from taichinh import settings
from taichinh.fetch import http_client
from taichinh.fetch.common import now_iso, windows
from taichinh.store.schemas import STOCKS_DAILY

URL = "https://dchart-api.vndirect.com.vn/dchart/history"
INDEX_SYMBOLS = {"VNINDEX", "VN30", "HNXINDEX"}  # index points: no x1000
MAX_WINDOW_DAYS = 365 * 5 - 5


def parse_vndirect(raw: dict, symbol: str, fetched_at: str | None = None) -> pd.DataFrame:
    """UDF JSON -> STOCKS_DAILY rows. Stock/ETF prices are in nghin dong -> x1000 VND."""
    cols = list(STOCKS_DAILY.columns)
    if not raw or raw.get("s") not in ("ok", None) or not raw.get("t"):
        return pd.DataFrame(columns=cols)
    mult = 1.0 if symbol in INDEX_SYMBOLS else 1000.0
    df = pd.DataFrame(
        {
            "date": [datetime.fromtimestamp(t, UTC).strftime("%Y-%m-%d") for t in raw["t"]],
            "symbol": symbol,
            "close": [round(x * mult, 4) for x in raw["c"]],
            "open": [round(x * mult, 4) for x in raw["o"]],
            "high": [round(x * mult, 4) for x in raw["h"]],
            "low": [round(x * mult, 4) for x in raw["l"]],
            "volume": [int(x) for x in raw["v"]],
            "source": "vndirect",
            "fetched_at": fetched_at or now_iso(),
        }
    )
    return df[cols]


def configured_symbols() -> list[str]:
    cfg = settings.load_yaml("assets.yml")
    syms = [a["symbol"] for a in cfg.get("assets", []) if a.get("source") == "vndirect"]
    syms += [s["symbol"] for s in cfg.get("user_stocks") or []]
    return list(dict.fromkeys(syms))


def _unix(d: date, end_of_day: bool = False) -> int:
    t = time(23, 59, 59) if end_of_day else time(0, 0)
    return int(datetime.combine(d, t, tzinfo=UTC).timestamp())


def fetch_stocks(start: date, end: date, symbols: list[str] | None = None) -> pd.DataFrame:
    frames = []
    for sym in symbols or configured_symbols():
        for lo, hi in windows(start, end, MAX_WINDOW_DAYS):
            params = {
                "resolution": "D",
                "symbol": sym,
                "from": _unix(lo),
                "to": _unix(hi, end_of_day=True),
            }
            frames.append(parse_vndirect(http_client.get_json(URL, params), sym))
    frames = [f for f in frames if not f.empty]
    if not frames:
        return pd.DataFrame(columns=list(STOCKS_DAILY.columns))
    return pd.concat(frames, ignore_index=True)
