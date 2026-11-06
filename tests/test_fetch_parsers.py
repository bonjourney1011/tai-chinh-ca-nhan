"""Parsers run on real raw responses saved under tests/fixtures (no network)."""

from __future__ import annotations

import json
from pathlib import Path

from taichinh.fetch.btmc_gold import parse_btmc
from taichinh.fetch.sjc_gold import parse_sjc_history, parse_sjc_latest
from taichinh.fetch.vietcombank_fx import parse_vcb
from taichinh.fetch.vndirect_stocks import parse_vndirect
from taichinh.store.schemas import FX_DAILY, GOLD_DAILY, STOCKS_DAILY

FIX = Path(__file__).parent / "fixtures"
TS = "2026-11-06T00:00:00Z"


def _json(name):
    return json.loads((FIX / name).read_text(encoding="utf-8"))


def test_vndirect_etf_x1000_and_columns():
    df = parse_vndirect(_json("vndirect-e1vfvn30.json"), "E1VFVN30", TS)
    assert list(df.columns) == list(STOCKS_DAILY.columns)
    assert not df.duplicated(list(STOCKS_DAILY.keys)).any()
    first = df.iloc[0]
    assert first["date"] == "2026-10-26" and first["close"] == 34000.0
    assert df["volume"].dtype.kind == "i"
    assert set(df["source"]) == {"vndirect"} and set(df["fetched_at"]) == {TS}


def test_vndirect_index_not_scaled():
    raw = {"s": "ok", "t": [1793836800], "c": [1740.73], "o": [1745.03], "h": [1753.15],
           "l": [1730.0], "v": [1]}
    assert parse_vndirect(raw, "VNINDEX", TS).iloc[0]["close"] == 1740.73


def test_vndirect_empty():
    df = parse_vndirect({"t": [], "s": "no_data"}, "E1VFVN30")
    assert df.empty and list(df.columns) == list(STOCKS_DAILY.columns)


def test_sjc_history_one_row_per_day():
    df = parse_sjc_history(_json("sjc-history.json"), "SJC_1L", TS)
    assert list(df.columns) == list(GOLD_DAILY.columns)
    assert not df.duplicated(["date", "product"]).any()
    assert len(df) < len(_json("sjc-history.json")["data"])  # intraday quotes collapsed
    assert (df["sell_vnd_luong"] > df["buy_vnd_luong"]).all()
    assert df["sell_vnd_luong"].between(1e7, 1e9).all()  # VND per luong
    assert set(df["source"]) == {"sjc"}


def test_sjc_latest_products():
    df = parse_sjc_latest(_json("sjc-getgoldprice.json"), TS)
    assert df["date"].iloc[0] == "2026-11-06"
    row = df[df["product"] == "SJC_1L"].iloc[0]
    assert (row["buy_vnd_luong"], row["sell_vnd_luong"]) == (139_500_000.0, 142_500_000.0)
    assert "SJC_RING_1C" in set(df["product"])


def test_btmc_units_luong():
    html = (FIX / "btmc-bgiavang.html").read_text(encoding="utf-8")
    df = parse_btmc(html, fetched_at=TS)
    assert list(df.columns) == list(GOLD_DAILY.columns)
    bar = df[df["product"] == "SJC_1L"].iloc[0]
    assert bar["sell_vnd_luong"] == 14250 * 10_000  # 1000 VND/chi -> VND/luong
    assert df["date"].iloc[0] == "2026-11-05"
    assert set(df["product"]) == {"SJC_1L", "BTMC_RING"} and set(df["source"]) == {"btmc"}


def test_vcb_usd_only():
    df = parse_vcb((FIX / "vcb-pxml.xml").read_text(encoding="utf-8"), TS)
    assert list(df.columns) == list(FX_DAILY.columns)
    assert len(df) == 1
    r = df.iloc[0]
    assert (r["ccy"], r["buy_transfer"], r["sell"], r["date"]) == (
        "USD", 25420.0, 25800.0, "2026-11-06")
