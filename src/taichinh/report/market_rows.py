"""Assets and Prices_Latest tab rows (latest auto prices overlaid with newest manual entries)."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from taichinh.store.loaders import latest_prices


def assets_rows(catalog: list[dict]) -> list[list]:
    return [
        [a["asset_id"], a.get("ten", a["asset_id"]), a.get("nhom", "khac"),
         a.get("tien_te", "VND"), a.get("loai_gia", "gia"), bool(a.get("nhap_tay", False)),
         a.get("mo_ta", "")]
        for a in catalog
    ]


def price_records(
    catalog: list[dict], manual_df: pd.DataFrame | None = None, data_dir: Path | None = None
) -> dict[str, dict]:
    """asset_id -> {gia, lai_suat_nam, ngay_gia, nguon, gia_vnd}; manual newest wins."""
    auto = latest_prices({"assets": catalog}, data_dir)
    rec: dict[str, dict] = {}
    for _, r in auto.iterrows():
        rec[r["asset_id"]] = {
            "gia": float(r["price"]), "lai_suat_nam": None, "ngay_gia": str(r["price_date"])[:10],
            "nguon": r["source"] or "", "gia_vnd": None if pd.isna(r["price_vnd"])
            else float(r["price_vnd"]),
        }
    known = {a["asset_id"]: a for a in catalog}
    if manual_df is not None and not manual_df.empty:
        ordered = manual_df.sort_values("ngay", kind="stable")
        newest = ordered.drop_duplicates("asset_id", keep="last")
        for _, m in newest.iterrows():
            a = known.get(str(m["asset_id"]).strip())
            if a is None:
                continue
            day = str(m["ngay"])[:10]
            if a.get("loai_gia") == "lai_suat":
                if pd.isna(m["lai_suat_nam"]):
                    continue
                rec[a["asset_id"]] = {"gia": None, "lai_suat_nam": float(m["lai_suat_nam"]),
                                      "ngay_gia": day, "nguon": "manual", "gia_vnd": 1.0}
            elif pd.notna(m["gia"]):
                px = float(m["gia"])
                rec[a["asset_id"]] = {"gia": px, "lai_suat_nam": None, "ngay_gia": day,
                                      "nguon": "manual",
                                      "gia_vnd": px if a.get("tien_te", "VND") == "VND" else None}
    return rec


def prices_rows(catalog: list[dict], records: dict[str, dict], run_at: str) -> list[list]:
    out = []
    for a in catalog:
        r = records.get(a["asset_id"])
        if r is None:
            continue
        out.append([a["asset_id"], a.get("ten", ""), a.get("nhom", "khac"),
                    a.get("tien_te", "VND"), r["gia"] if r["gia"] is not None else "",
                    r["lai_suat_nam"] if r["lai_suat_nam"] is not None else "",
                    r["ngay_gia"], r["nguon"], run_at])
    return out
