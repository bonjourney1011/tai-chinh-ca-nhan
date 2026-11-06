"""Manual_Prices (Sheet) -> monthly CSV upserts (deposit rates, fund NAV, bond yields)."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from taichinh.store.csv_upsert import upsert
from taichinh.store.schemas import (
    BOND_YIELDS_MONTHLY,
    DEPOSIT_RATES_MONTHLY,
    FUND_NAV_MONTHLY,
)

BOND10Y = "BOND10Y"


def _prov() -> dict:
    return {"source": "manual", "fetched_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")}


def manual_to_csv(
    manual_df: pd.DataFrame, assets_catalog: list[dict], data_dir: Path | None = None
) -> dict[str, int]:
    """Upsert manual rows; month = ngay[:7]. Returns rows added per CSV file (idempotent)."""
    by_cma = {a["asset_id"]: a.get("cma_key") for a in assets_catalog}
    dep, nav, bond = [], [], []
    for _, r in manual_df.sort_values("ngay", kind="stable").iterrows():
        aid, month = str(r["asset_id"]).strip(), str(r["ngay"]).strip()[:7]
        if len(month) != 7:
            continue
        rate, price = r.get("lai_suat_nam"), r.get("gia")
        if by_cma.get(aid) == "deposit_12m" and pd.notna(rate):
            dep.append({"month": month, "bank": "MANUAL", "term_months": 12, "rate_pa": rate,
                        **_prov()})
        elif by_cma.get(aid) == "bond_fund" and pd.notna(price):
            nav.append({"month": month, "fund_code": aid, "nav": price, **_prov()})
        elif aid == BOND10Y and pd.notna(rate):
            bond.append({"month": month, "tenor_years": 10, "yield_pa": rate, **_prov()})
    out = {}
    for rows, schema in ((dep, DEPOSIT_RATES_MONTHLY), (nav, FUND_NAV_MONTHLY),
                         (bond, BOND_YIELDS_MONTHLY)):
        if rows:
            out[schema.file] = upsert(pd.DataFrame(rows), schema, data_dir)
    return out
