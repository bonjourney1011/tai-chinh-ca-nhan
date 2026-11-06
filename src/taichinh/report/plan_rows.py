"""Plan tab rows: one row per (goal, option) from a GoalPlan."""

from __future__ import annotations

import json

from taichinh.engine.types import GoalPlan

REASON_VI = {
    "deposit_12m": "Giữ giá trị, lãi ổn định, rút được ngay",
    "bond_fund": "Ổn định hơn cổ phiếu, rút được trong vài ngày",
    "etf_vn30": "Tăng trưởng dài hạn từ thị trường cổ phiếu Việt Nam",
    "gold_sjc": "Giữ giá trị khi lạm phát và biến động mạnh",
    "us_etf": "Đa dạng hóa sang thị trường Mỹ, hợp mục tiêu bằng USD",
    "btc": "Tỷ trọng nhỏ cho tăng trưởng cao, biến động rất lớn",
}
STOCK_REASON = "Cổ phiếu Mo chọn, tăng trưởng nhưng rủi ro riêng cao"


def allocation_list(weights: dict[str, float], cma_to_asset: dict[str, str]) -> list[dict]:
    items = [
        {"asset_id": cma_to_asset.get(k, k), "pct": round(w, 4),
         "ly_do": REASON_VI.get(k, STOCK_REASON)}
        for k, w in sorted(weights.items(), key=lambda kv: -kv[1]) if w > 0.0005
    ]
    return items


def plan_row(
    goal_id: str, option: str, plan: GoalPlan, cma_to_asset: dict[str, str], run_at: str
) -> list:
    end = plan.horizon_months
    b = plan.bands
    return [
        goal_id, option, round(plan.pmt_required), round(plan.pmt_for_80),
        round(plan.p_success, 4), round(float(b[5][end])), round(float(b[50][end])),
        round(float(b[95][end])),
        json.dumps(allocation_list(plan.mix.weights, cma_to_asset), ensure_ascii=False),
        " ".join(plan.explanations), run_at,
    ]
