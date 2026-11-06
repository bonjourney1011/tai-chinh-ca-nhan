"""SJC gold prices (VND/luong). Numbers only: page text is never stored (ai-input=no).

goldPriceId (== PriceId in history rows, == Id in GetGoldPrice rows):
  1  = "Vang SJC 1L, 10L, 1KG" Ho Chi Minh -> product SJC_1L
  49 = "Vang nhan SJC 99,99% 1 chi, 2 chi, 5 chi" Ho Chi Minh -> product SJC_RING_1C
History endpoint rejects windows >= 90 days, so we use 89-day windows.
"""

from __future__ import annotations

import re
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

import pandas as pd

from taichinh.fetch import http_client
from taichinh.fetch.common import now_iso, windows
from taichinh.store.schemas import GOLD_DAILY

URL = "https://sjc.com.vn/GoldPrice/Services/PriceService.ashx"
PRODUCT_IDS = {"SJC_1L": 1, "SJC_RING_1C": 49}
HCM = "Hồ Chí Minh"
WINDOW_DAYS = 88
SPACING = 2.0
_VN = ZoneInfo("Asia/Ho_Chi_Minh")


def _empty() -> pd.DataFrame:
    return pd.DataFrame(columns=list(GOLD_DAILY.columns))


def _rows_to_df(rows: list[tuple], fetched_at: str | None) -> pd.DataFrame:
    if not rows:
        return _empty()
    df = pd.DataFrame(rows, columns=["date", "product", "buy_vnd_luong", "sell_vnd_luong"])
    df = df.drop_duplicates(["date", "product"], keep="last")  # last quote of the day
    df["source"] = "sjc"
    df["fetched_at"] = fetched_at or now_iso()
    return df[list(GOLD_DAILY.columns)].reset_index(drop=True)


def parse_sjc_history(raw: dict, product: str, fetched_at: str | None = None) -> pd.DataFrame:
    """GetGoldPriceHistory JSON -> one row per VN calendar day (last intraday quote)."""
    rows = []
    for r in sorted(raw.get("data") or [], key=lambda x: x["Id"]):
        ms = int(re.search(r"-?\d+", r["GroupDate"]).group())
        d = datetime.fromtimestamp(ms / 1000, UTC).astimezone(_VN).strftime("%Y-%m-%d")
        rows.append((d, product, float(r["BuyValue"]), float(r["SellValue"])))
    return _rows_to_df(rows, fetched_at)


def parse_sjc_latest(raw: dict, fetched_at: str | None = None) -> pd.DataFrame:
    """GetGoldPrice JSON (current board) -> today's rows for known products (HCM branch)."""
    m = re.match(r"\d{2}:\d{2} (\d{2})/(\d{2})/(\d{4})", raw.get("latestDate") or "")
    if not m:
        return _empty()
    d = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    by_id = {v: k for k, v in PRODUCT_IDS.items()}
    rows = [
        (d, by_id[r["Id"]], float(r["BuyValue"]), float(r["SellValue"]))
        for r in raw.get("data") or []
        if r.get("Id") in by_id and r.get("BranchName") == HCM
    ]
    return _rows_to_df(rows, fetched_at)


def fetch_sjc(start: date, end: date) -> pd.DataFrame:
    frames = [parse_sjc_latest(http_client.post_form(URL, {"method": "GetGoldPrice"}, SPACING))]
    for product, pid in PRODUCT_IDS.items():
        for lo, hi in windows(start, end, WINDOW_DAYS):
            body = {
                "method": "GetGoldPriceHistory",
                "goldPriceId": pid,
                "fromDate": lo.strftime("%d/%m/%Y"),
                "toDate": hi.strftime("%d/%m/%Y"),
            }
            raw = http_client.post_form(URL, body, SPACING)
            if not raw.get("success"):
                raise RuntimeError(f"SJC history rejected: {raw.get('message') or raw.get('msg')}")
            frames.append(parse_sjc_history(raw, product))
    frames = [f for f in frames if not f.empty]
    return pd.concat(frames, ignore_index=True) if frames else _empty()
