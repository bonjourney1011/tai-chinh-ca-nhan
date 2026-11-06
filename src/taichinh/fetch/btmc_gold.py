"""BTMC gold board (fallback). Unit is 1000 VND per chi -> x10 for luong -> x1000 for VND."""

from __future__ import annotations

import re
from datetime import date
from html.parser import HTMLParser

import pandas as pd

from taichinh.fetch import http_client
from taichinh.fetch.common import now_iso
from taichinh.store.schemas import GOLD_DAILY

URL = "https://btmc.vn/Home/BGiaVang"
# row-name substring (upper-case) -> product code
PRODUCTS = {"VÀNG MIẾNG SJC": "SJC_1L", "NHẪN TRÒN TRƠN": "BTMC_RING"}
LUONG_VND = 10 * 1000  # chi -> luong (x10), thousand VND -> VND (x1000)


class _Table(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append(re.sub(r"\s+", " ", "".join(self._cell)).strip())
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.rows.append(self._row)
            self._row = None


def _num(s: str) -> float | None:
    digits = re.sub(r"[^\d]", "", s)
    return float(digits) if digits else None


def parse_btmc(html: str, today: date | None = None, fetched_at: str | None = None) -> pd.DataFrame:
    t = _Table()
    t.feed(html)
    d = (today or date.today()).isoformat()
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})\s+\d{2}:\d{2}", html)
    if m and today is None:
        d = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    rows, seen = [], set()
    for cells in t.rows:
        if len(cells) < 4:
            continue
        name = cells[-4].upper()
        for key, product in PRODUCTS.items():
            if key in name and product not in seen:
                buy, sell = _num(cells[-2]), _num(cells[-1])
                if buy and sell:
                    seen.add(product)
                    rows.append((d, product, buy * LUONG_VND, sell * LUONG_VND))
    df = pd.DataFrame(rows, columns=["date", "product", "buy_vnd_luong", "sell_vnd_luong"])
    df["source"] = "btmc"
    df["fetched_at"] = fetched_at or now_iso()
    return df[list(GOLD_DAILY.columns)]


def fetch_btmc(start: date | None = None, end: date | None = None) -> pd.DataFrame:
    """Board shows only the current quote; start/end accepted for a uniform signature."""
    return parse_btmc(http_client.get_text(URL))
