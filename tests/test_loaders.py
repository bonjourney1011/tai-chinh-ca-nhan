from __future__ import annotations

import pandas as pd

from taichinh.store.csv_upsert import upsert
from taichinh.store.loaders import latest_prices, load_close_series, load_csv
from taichinh.store.schemas import FX_DAILY, GLOBAL_DAILY, GOLD_DAILY, STOCKS_DAILY

PROV = {"source": "t", "fetched_at": "2026-11-06T00:00:00Z"}
CFG = {
    "assets": [
        {"asset_id": "E1VFVN30", "tien_te": "VND", "source": "vndirect", "symbol": "E1VFVN30"},
        {"asset_id": "SJC", "tien_te": "VND", "source": "sjc", "product": "SJC_1L"},
        {"asset_id": "USDVND", "tien_te": "VND", "source": "vietcombank"},
        {"asset_id": "VOO", "tien_te": "USD", "source": "tiingo", "symbol": "VOO"},
        {"asset_id": "TK12", "tien_te": "VND", "source": "manual"},
    ]
}


def _seed(d):
    upsert(pd.DataFrame([
        {"date": "2026-11-05", "symbol": "E1VFVN30", "close": 33640.0, "open": 1.0, "high": 1.0,
         "low": 1.0, "volume": 5, **PROV}]), STOCKS_DAILY, d)
    upsert(pd.DataFrame([
        {"date": "2026-11-05", "product": "SJC_1L", "buy_vnd_luong": 1.0e8,
         "sell_vnd_luong": 1.4e8, **PROV}]), GOLD_DAILY, d)
    upsert(pd.DataFrame([
        {"date": "2026-11-05", "ccy": "USD", "buy_transfer": 25000.0, "sell": 25400.0, **PROV}
    ]), FX_DAILY, d)
    upsert(pd.DataFrame([
        {"date": "2026-11-05", "symbol": "VOO", "close_usd": 500.0, **PROV}]), GLOBAL_DAILY, d)


def test_load_csv_missing_is_empty(tmp_path):
    df = load_csv(STOCKS_DAILY, tmp_path)
    assert df.empty and list(df.columns) == list(STOCKS_DAILY.columns)


def test_close_series_units(tmp_path):
    _seed(tmp_path)
    s = load_close_series(["E1VFVN30", "SJC", "USDVND", "VOO", "TK12"], CFG, tmp_path)
    row = s.loc["2026-11-05"]
    assert row["E1VFVN30"] == 33640.0          # already VND (x1000 done at fetch)
    assert row["SJC"] == 1.4e8                 # sell VND/luong
    assert row["USDVND"] == 25000.0            # fx buy_transfer
    assert row["VOO"] == 500.0 * 25000.0       # USD converted via fx
    assert "TK12" not in s.columns


def test_latest_prices(tmp_path):
    _seed(tmp_path)
    lp = latest_prices(CFG, tmp_path).set_index("asset_id")
    assert set(lp.index) == {"E1VFVN30", "SJC", "USDVND", "VOO"}
    assert lp.loc["VOO", "price"] == 500.0 and lp.loc["VOO", "currency"] == "USD"
    assert lp.loc["VOO", "price_vnd"] == 12_500_000.0
    assert lp.loc["SJC", "price_date"] == "2026-11-05"
