"""Asset catalog helpers: config/assets.yml ↔ CMA keys, lot sizes, price-history inputs."""

from __future__ import annotations

import pandas as pd

from taichinh.engine.returns import to_monthly
from taichinh.settings import load_yaml
from taichinh.store.loaders import load_close_series

CORE_CMA = ("deposit_12m", "bond_fund", "etf_vn30", "gold_sjc")
FOREIGN_CMA = ("us_etf", "btc")


def load_assets_cfg() -> dict:
    return load_yaml("assets.yml")


def catalog(assets_cfg: dict | None = None) -> list[dict]:
    """All assets incl. user stocks (user stocks get cma_key = their asset_id, nhom co_phieu)."""
    cfg = assets_cfg or load_assets_cfg()
    rows = list(cfg.get("assets", []))
    for s in cfg.get("user_stocks", []) or []:
        rows.append({
            "asset_id": s["asset_id"], "ten": s.get("ten", s["asset_id"]), "nhom": "co_phieu",
            "tien_te": "VND", "loai_gia": "gia", "nhap_tay": False, "cma_key": s["asset_id"],
            "lot_size": 100, "source": "vndirect", "symbol": s.get("symbol", s["asset_id"]),
            "user_stock": True,
        })
    return rows


def cma_to_asset(assets_cfg: dict | None = None) -> dict[str, str]:
    """cma_key → asset_id for investable assets (skips benchmark/fx-only rows)."""
    return {
        a["cma_key"]: a["asset_id"]
        for a in catalog(assets_cfg)
        if a.get("cma_key") and not a.get("benchmark_only") and not a.get("fx_only")
    }


def user_stock_ids(assets_cfg: dict | None = None) -> list[str]:
    return [a["asset_id"] for a in catalog(assets_cfg) if a.get("user_stock")]


def lot_sizes(assets_cfg: dict | None = None) -> dict[str, float]:
    """lot size keyed by cma_key."""
    return {
        a["cma_key"]: float(a.get("lot_size") or 1)
        for a in catalog(assets_cfg)
        if a.get("cma_key")
    }


def monthly_returns_by_cma_key(cma_keys: list[str], assets_cfg: dict | None = None) -> pd.DataFrame:
    """Monthly simple returns (columns = cma keys) for assets that have a price history CSV."""
    cfg = assets_cfg or load_assets_cfg()
    mapping = cma_to_asset(cfg)
    ids = [mapping[k] for k in cma_keys if k in mapping]
    if not ids:
        return pd.DataFrame()
    closes = load_close_series(ids, {"assets": catalog(cfg)}).dropna(how="all")
    if closes.empty:
        return pd.DataFrame()
    closes.index = pd.to_datetime(closes.index)
    inverse = {v: k for k, v in mapping.items()}
    return to_monthly(closes).rename(columns=inverse).dropna(axis=1, how="all")
