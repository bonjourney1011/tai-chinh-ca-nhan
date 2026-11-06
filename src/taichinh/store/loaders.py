"""Read market CSVs and build price tables in VND."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from taichinh import settings
from taichinh.store.schemas import FX_DAILY, GOLD_DAILY, STOCKS_DAILY, CsvSchema

NUMERIC = {"close", "open", "high", "low", "volume", "buy_vnd_luong", "sell_vnd_luong",
           "buy_transfer", "sell", "rate_pa", "nav", "yield_pa", "value", "close_usd"}


def load_csv(schema: CsvSchema, data_dir: Path | None = None) -> pd.DataFrame:
    """Load a schema's CSV (empty frame with the right columns if missing)."""
    path = (data_dir or settings.DATA_DIR) / schema.file
    if not path.exists():
        return pd.DataFrame(columns=list(schema.columns))
    df = pd.read_csv(path, dtype={c: str for c in schema.columns if c not in NUMERIC})
    for c in df.columns:
        if c in NUMERIC:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def _fx_usd(data_dir: Path | None) -> pd.Series:
    fx = load_csv(FX_DAILY, data_dir)
    fx = fx[fx["ccy"] == "USD"].drop_duplicates("date", keep="last")
    return fx.set_index("date")["buy_transfer"].sort_index()


def _asset_series(a: dict, stocks, gold, fx_usd, global_px) -> pd.Series | None:
    """Daily price series in the asset's native currency (VND for VN assets)."""
    src = a.get("source")
    if src == "vndirect":
        s = stocks[stocks["symbol"] == a["symbol"]].set_index("date")["close"]
    elif src == "sjc":
        s = gold[gold["product"] == a["product"]].set_index("date")["sell_vnd_luong"]
    elif src == "vietcombank":
        s = fx_usd
    elif src in ("tiingo", "kraken"):
        s = global_px[global_px["symbol"] == a["symbol"]].set_index("date")["close_usd"]
    else:
        return None
    return s[~s.index.duplicated(keep="last")].sort_index()


def _load_global(data_dir):
    from taichinh.store.schemas import GLOBAL_DAILY

    return load_csv(GLOBAL_DAILY, data_dir)


def load_close_series(
    asset_ids: list[str], assets_cfg: dict, data_dir: Path | None = None
) -> pd.DataFrame:
    """Date x asset_id closes in VND (USD assets converted via fx buy_transfer, ffilled)."""
    by_id = {a["asset_id"]: a for a in assets_cfg.get("assets", [])}
    stocks, gold = load_csv(STOCKS_DAILY, data_dir), load_csv(GOLD_DAILY, data_dir)
    fx_usd, global_px = _fx_usd(data_dir), _load_global(data_dir)
    cols = {}
    for aid in asset_ids:
        a = by_id[aid]
        s = _asset_series(a, stocks, gold, fx_usd, global_px)
        if s is None or s.empty:
            continue
        if a.get("tien_te") == "USD":
            rate = fx_usd.reindex(fx_usd.index.union(s.index)).ffill().bfill()
            s = s * rate.reindex(s.index)
        cols[aid] = s
    out = pd.DataFrame(cols)
    out.index.name = "date"
    return out.sort_index()


def latest_prices(assets_cfg: dict, data_dir: Path | None = None) -> pd.DataFrame:
    """One row per asset with data: price_date, price (native), currency, price_vnd, source."""
    stocks, gold = load_csv(STOCKS_DAILY, data_dir), load_csv(GOLD_DAILY, data_dir)
    fx_usd, global_px = _fx_usd(data_dir), _load_global(data_dir)
    usd_rate = float(fx_usd.iloc[-1]) if len(fx_usd) else None
    rows = []
    for a in assets_cfg.get("assets", []):
        s = _asset_series(a, stocks, gold, fx_usd, global_px)
        if s is None or s.dropna().empty:
            continue
        s = s.dropna()
        ccy = a.get("tien_te", "VND")
        price = float(s.iloc[-1])
        vnd = price * usd_rate if ccy == "USD" and usd_rate else (price if ccy == "VND" else None)
        rows.append(
            {
                "asset_id": a["asset_id"],
                "price_date": s.index[-1],
                "price": price,
                "currency": ccy,
                "price_vnd": vnd,
                "source": a.get("source"),
            }
        )
    cols = ["asset_id", "price_date", "price", "currency", "price_vnd", "source"]
    return pd.DataFrame(rows, columns=cols)
