"""Fetcher registry. `run_fetch` never raises: failures are recorded in _fetch_status.json."""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import date, timedelta

import pandas as pd

from taichinh import settings
from taichinh.fetch.btmc_gold import fetch_btmc
from taichinh.fetch.sjc_gold import fetch_sjc
from taichinh.fetch.vietcombank_fx import fetch_vcb
from taichinh.fetch.vndirect_stocks import fetch_stocks
from taichinh.store.csv_upsert import upsert
from taichinh.store.schemas import FX_DAILY, GOLD_DAILY, STOCKS_DAILY, CsvSchema

DEFAULT_LOOKBACK_DAYS = 30


def fetch_gold(start: date, end: date) -> pd.DataFrame:
    """SJC first; BTMC board (current quote only) if SJC fails."""
    try:
        return fetch_sjc(start, end)
    except Exception:
        return fetch_btmc(start, end)


# source -> (fetch(start, end) -> DataFrame, target schema)
FETCHERS: dict[str, Callable[[date, date], pd.DataFrame]] = {
    "stocks": fetch_stocks,
    "gold": fetch_gold,
    "fx": fetch_vcb,
}
SCHEMAS: dict[str, CsvSchema] = {"stocks": STOCKS_DAILY, "gold": GOLD_DAILY, "fx": FX_DAILY}


def status_path():
    return settings.DATA_DIR / "_fetch_status.json"


def run_fetch(
    sources: list[str], start: date | None = None, end: date | None = None
) -> dict[str, dict]:
    end = end or date.today()
    start = start or end - timedelta(days=DEFAULT_LOOKBACK_DAYS)
    result: dict[str, dict] = {}
    for name in sources:
        try:
            df = FETCHERS[name](start, end)
            upsert(df, SCHEMAS[name])
            latest = str(df["date"].max()) if len(df) else None
            result[name] = {"ok": True, "rows": int(len(df)), "latest": latest, "error": None}
        except Exception as e:  # noqa: BLE001 - status file is the error channel
            err = f"{type(e).__name__}: {e}"
            result[name] = {"ok": False, "rows": 0, "latest": None, "error": err}
    try:
        path = status_path()
        old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps({**old, **result}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    except Exception:  # noqa: BLE001
        pass
    return result
