"""Tracking tab rows: actual value vs plan expectation, allocation drift, suggested deposit."""

from __future__ import annotations

import json
from datetime import date

import pandas as pd

from taichinh.engine.goal_math import future_value
from taichinh.engine.lots import drift_after_lots
from taichinh.engine.types import GoalPlan


def months_between(start: date | None, today: date) -> int:
    if start is None:
        return 0
    n = (today.year - start.year) * 12 + today.month - start.month
    n -= 1 if today.day < start.day else 0
    return max(n, 0)


def holdings_value(
    holdings: pd.DataFrame, goal_id: str, price_vnd: dict[str, float]
) -> tuple[float, dict[str, float], list[str]]:
    """(total VND, value by asset_id, asset_ids missing a price). Deposits: so_luong is VND."""
    total, by_asset, missing = 0.0, {}, []
    sub = holdings[holdings["goal_id"].astype(str).str.strip() == goal_id]
    for _, h in sub.iterrows():
        if pd.isna(h["so_luong"]):
            continue
        aid = str(h["asset_id"]).strip()
        px = price_vnd.get(aid)
        if px is None:
            missing.append(aid)
            continue
        v = float(h["so_luong"]) * px
        by_asset[aid] = by_asset.get(aid, 0.0) + v
        total += v
    return total, by_asset, missing


def expected_and_p25(plan: GoalPlan, pv0: float, elapsed: int) -> tuple[float, float]:
    """Expected value after `elapsed` months of the chosen plan (start pv0, plan pmt, plan mu).
    p25 = expected scaled by the plan's p25/p50 band ratio at the same relative month."""
    exp = future_value(pv0, plan.pmt_required, elapsed, plan.mix.mu) if elapsed > 0 else pv0
    k = min(elapsed, plan.horizon_months)
    p50 = float(plan.bands[50][k])
    ratio = float(plan.bands[25][k]) / p50 if p50 > 0 else 1.0
    return exp, exp * ratio


def tracking_row(
    goal_id: str, today: date, actual: float, by_asset: dict[str, float], plan: GoalPlan,
    pv0: float, elapsed: int, target_pct: dict[str, float], run_at: str,
) -> list:
    exp, p25 = expected_and_p25(plan, pv0, elapsed)
    on_track = elapsed == 0 or actual >= p25 - 1e-6
    gap = actual - exp
    pmt = plan.pmt_required
    gap_months = round(gap / pmt, 1) if pmt > 0 else 0.0
    real = {a: v / actual for a, v in by_asset.items()} if actual > 0 else {}
    drift = drift_after_lots(target_pct, real) if real else {}
    drift_json = [{"asset_id": a, "lech_pct": round(d, 4)}
                  for a, d in sorted(drift.items(), key=lambda kv: -abs(kv[1]))]
    return [goal_id, today.isoformat(), round(actual), round(exp), bool(on_track), gap_months,
            json.dumps(drift_json, ensure_ascii=False), round(pmt), run_at]
