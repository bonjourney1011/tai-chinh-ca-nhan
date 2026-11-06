"""`taichinh demo`: plan one goal from real CSV history and print it in Vietnamese."""

from __future__ import annotations

from datetime import date

from taichinh.engine.cma import blend_with_history, load_cma, load_profiles
from taichinh.engine.explain import pct, trieu
from taichinh.engine.planner import plan_goal
from taichinh.engine.types import Goal, GoalPlan
from taichinh.universe import CORE_CMA, FOREIGN_CMA, monthly_returns_by_cma_key, user_stock_ids

LABELS = {
    "deposit_12m": "Tiền gửi 12 tháng", "bond_fund": "Quỹ trái phiếu", "etf_vn30": "ETF VN30",
    "gold_sjc": "Vàng SJC", "us_etf": "ETF Mỹ", "btc": "Bitcoin",
}
METHOD_VI = {
    "rule_minvar": "Rủi ro thấp nhất", "rule_erc": "Chia đều rủi ro", "one_over_n": "Chia đều tiền",
    "classic_tangency": "Markowitz (tangency)", "safe_only": "Chỉ tài sản an toàn",
}


def build_plan(
    target: float, months: int, profile_name: str, pv: float = 0.0,
    foreign: bool = False, scenario: str = "base", seed: int = 0,
) -> tuple[GoalPlan, dict[str, int]]:
    keys = list(CORE_CMA) + (list(FOREIGN_CMA) if foreign else [])
    stocks = user_stock_ids()
    cma = load_cma(scenario=scenario, asset_ids=keys, stock_ids=stocks)
    hist = monthly_returns_by_cma_key(keys + stocks)
    hist_months = {c: int(hist[c].notna().sum()) for c in hist.columns} if not hist.empty else {}
    if not hist.empty:
        cma = blend_with_history(cma, hist)
    profile = load_profiles()[profile_name]
    goal = Goal(id="DEMO", name="Mục tiêu demo", target_amount=target,
                horizon_months=months, current_pv=pv)
    return plan_goal(goal, profile, cma, seed=seed, today=date.today()), hist_months


def render(plan: GoalPlan, hist_months: dict[str, int] | None = None) -> str:
    caps = plan.allocation.caps
    lines = [
        f"Mục tiêu {trieu(plan.goal.target_amount)} trong {plan.horizon_months} tháng "
        f"(tính cả lạm phát: {trieu(plan.target_nominal)}). "
        f"Tiền có sẵn: {trieu(plan.goal.current_pv)}.",
        "",
        f"Cần gửi mỗi tháng: {trieu(plan.pmt_required)}  →  xác suất đạt {pct(plan.p_success)}",
        f"Muốn chắc 80%: gửi {trieu(plan.pmt_for_80)}/tháng",
        f"Cổ phiếu tối đa {pct(caps.w_eq)} (giới hạn bởi: {caps.binding})",
        "",
        "Phương án đề xuất — " + METHOD_VI.get(plan.mix.method, plan.mix.method) + ":",
    ]
    for k, w in sorted(plan.mix.weights.items(), key=lambda kv: -kv[1]):
        if w > 0.0005:
            part = trieu(plan.pmt_required * w)
            lines.append(f"  {LABELS.get(k, k):<20} {pct(w):>7}   {part}/tháng")
    lines += [
        f"  Lợi nhuận kỳ vọng {pct(plan.mix.mu)}/năm, biến động {pct(plan.mix.sigma)}/năm, "
        f"sụt giảm ước tính {pct(plan.mix.est_max_drawdown)}",
        "",
        "So sánh các phương án (mỗi phương án dùng số tiền gửi tối thiểu của nó):",
    ]
    for ev in plan.allocation.candidates:
        lines.append(
            f"  {METHOD_VI.get(ev.mix.method, ev.mix.method):<22} "
            f"{trieu(ev.pmt_required):>14}/tháng  đạt {pct(ev.mc.p_success):>6}"
            f"  σ {pct(ev.mix.sigma)}"
        )
    end, b = plan.horizon_months, plan.bands
    lines += [
        "",
        f"Kết quả cuối kỳ: xấu (5%) {trieu(b[5][end])} · trung bình {trieu(b[50][end])} "
        f"· tốt (95%) {trieu(b[95][end])}",
    ]
    if hist_months:
        shown = ", ".join(f"{LABELS.get(k, k)} {v} tháng" for k, v in hist_months.items())
        lines.append("Lịch sử dùng để ước biến động: " + shown)
    lines += ["", *plan.explanations]
    if plan.warnings:
        lines += ["", "Lưu ý:", *[f"  - {w}" for w in plan.warnings]]
    return "\n".join(lines)
