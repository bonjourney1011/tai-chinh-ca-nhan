"""Vietcombank exchange-rate XML. Max 1 request per 5 minutes (enforced via .cache file)."""

from __future__ import annotations

import time
import xml.etree.ElementTree as ET
from datetime import date, datetime

import pandas as pd

from taichinh import settings
from taichinh.fetch import http_client
from taichinh.fetch.common import now_iso
from taichinh.store.schemas import FX_DAILY

URL = "https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx"
MIN_GAP_SECONDS = 300
CURRENCIES = ("USD",)
STAMP = settings.REPO_ROOT / ".cache" / ".vcb_last_fetch"


def _num(s: str | None) -> float | None:
    s = (s or "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def parse_vcb(xml_text: str, fetched_at: str | None = None) -> pd.DataFrame:
    root = ET.fromstring(xml_text.lstrip("﻿").strip())
    stamp = (root.findtext("DateTime") or "").strip()
    try:
        d = datetime.strptime(stamp, "%m/%d/%Y %I:%M:%S %p").date().isoformat()
    except ValueError:
        d = date.today().isoformat()
    rows = []
    for e in root.iter("Exrate"):
        ccy = e.get("CurrencyCode")
        if ccy in CURRENCIES and _num(e.get("Transfer")) and _num(e.get("Sell")):
            rows.append((d, ccy, _num(e.get("Transfer")), _num(e.get("Sell"))))
    df = pd.DataFrame(rows, columns=["date", "ccy", "buy_transfer", "sell"])
    df["source"] = "vietcombank"
    df["fetched_at"] = fetched_at or now_iso()
    return df[list(FX_DAILY.columns)]


def fetch_vcb(start: date | None = None, end: date | None = None) -> pd.DataFrame:
    """Current rate only (no history). Raises if called again within 5 minutes."""
    if STAMP.exists():
        try:
            age = time.time() - float(STAMP.read_text().strip())
        except ValueError:
            age = MIN_GAP_SECONDS
        if age < MIN_GAP_SECONDS:
            raise RuntimeError(f"Vietcombank throttled: retry in {int(MIN_GAP_SECONDS - age)}s")
    STAMP.parent.mkdir(parents=True, exist_ok=True)
    STAMP.write_text(str(time.time()))
    return parse_vcb(http_client.get_text(URL))
