"""Idempotent CSV upsert keyed by schema keys. UTF-8, LF, exact column order."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from taichinh import settings
from taichinh.store.schemas import CsvSchema


def csv_path(schema: CsvSchema, data_dir: Path | None = None) -> Path:
    return (data_dir or settings.DATA_DIR) / schema.file


def upsert(df: pd.DataFrame, schema: CsvSchema, data_dir: Path | None = None) -> int:
    """Merge `df` into the schema's CSV (newest row per key wins). Returns rows added."""
    path = csv_path(schema, data_dir)
    cols = list(schema.columns)
    new = df.reindex(columns=cols).astype(object)
    if path.exists():
        old = pd.read_csv(path, dtype=str, keep_default_na=False)
        old = old.reindex(columns=cols).astype(object)
    else:
        old = pd.DataFrame(columns=cols, dtype=object)
    # Compare keys as strings so that "1" vs 1 never produces false duplicates.
    new_s = new.astype(str).where(new.notna(), "")
    merged = pd.concat([old, new_s], ignore_index=True)
    merged = merged.drop_duplicates(list(schema.keys), keep="last")
    merged = merged.sort_values(list(schema.keys), kind="stable").reset_index(drop=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    merged[cols].to_csv(path, index=False, encoding="utf-8", lineterminator="\n")
    return max(len(merged) - len(old), 0)
