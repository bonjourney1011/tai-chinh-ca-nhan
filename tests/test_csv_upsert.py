from __future__ import annotations

import pandas as pd

from taichinh.store.csv_upsert import csv_path, upsert
from taichinh.store.schemas import FX_DAILY


def _df(rate, d="2026-11-05", ts="2026-11-05T00:00:00Z"):
    return pd.DataFrame(
        [{"date": d, "ccy": "USD", "buy_transfer": rate, "sell": rate + 380.0,
          "source": "vietcombank", "fetched_at": ts}]
    )


def test_idempotent_and_keeps_newest(tmp_path):
    assert upsert(_df(25400.0), FX_DAILY, tmp_path) == 1
    assert upsert(_df(25400.0), FX_DAILY, tmp_path) == 0
    assert upsert(_df(25500.0, ts="2026-11-06T00:00:00Z"), FX_DAILY, tmp_path) == 0
    out = pd.read_csv(csv_path(FX_DAILY, tmp_path))
    assert len(out) == 1 and out.iloc[0]["buy_transfer"] == 25500.0


def test_sorted_exact_columns_lf(tmp_path):
    upsert(pd.concat([_df(1.0, "2026-11-06"), _df(2.0, "2026-11-04")]), FX_DAILY, tmp_path)
    upsert(_df(3.0, "2026-11-05"), FX_DAILY, tmp_path)
    raw = csv_path(FX_DAILY, tmp_path).read_bytes()
    assert b"\r" not in raw
    out = pd.read_csv(csv_path(FX_DAILY, tmp_path))
    assert list(out.columns) == list(FX_DAILY.columns)
    assert list(out["date"]) == ["2026-11-04", "2026-11-05", "2026-11-06"]
