"""Goal planner: caps -> candidate mixes -> Monte Carlo -> recommended plan."""

from __future__ import annotations

from dataclasses import replace
from datetime import date

import numpy as np

from taichinh.engine.allocation_rules import equity_cap
from taichinh.engine.cma import load_horizon_table
from taichinh.engine.explain import explain_caps, explain_mix, pct, trieu
from taichinh.engine.goal_math import (
    future_value,
    fx_adjusted_target,
    inflate_target,
    plan_trajectory,
    required_pmt,
)
from taichinh.engine.lots import money_to_lots
from taichinh.engine.monte_carlo import pmt_for_success, simulate_paths, summarize_paths
from taichinh.engine.optimizer import candidate_mixes
from taichinh.engine.types import (
    AllocationResult,
    BudgetMetrics,
    CapitalMarketAssumptions,
    Goal,
    GoalPlan,
    MixEvaluation,
    RiskProfile,
)


def _horizon(goal: Goal, today: date) -> int:
    if goal.horizon_months is not None:
        return max(int(goal.horizon_months), 1)
    if goal.deadline is None:
        raise ValueError("goal needs horizon_months or deadline")
    d = goal.deadline
    n = (d.year - today.year) * 12 + d.month - today.month - (1 if d.day < today.day else 0)
    return max(n, 1)


def _target(goal: Goal, n: int, cma: CapitalMarketAssumptions, fx_spot: float | None) -> float:
    """Nominal VND target at the deadline.

    USD goal: converted at the drifted future spot (fx_drift only); VND CPI is NOT applied on
    top, since a USD price does not inflate with VND CPI. VND goal: inflated by VND CPI only
    when goal.inflation_adjust is set.
    """
    g = goal.target_amount
    if goal.currency == "USD":
        if not fx_spot:
            raise ValueError("fx_spot required for USD goal")
        return fx_adjusted_target(g, fx_spot, goal.fx_drift, n)
    if goal.inflation_adjust:
        g = inflate_target(g, cma.inflation, n)
    return g


def _pick(evals: list[MixEvaluation], dd_limit: float) -> tuple[MixEvaluation, bool]:
    """Best p_success among mixes within the drawdown limit (ties -> lower sigma)."""
    ok = [e for e in evals if e.mix.est_max_drawdown >= -dd_limit - 1e-12]
    pool = ok or [max(evals, key=lambda e: e.mix.est_max_drawdown)]
    best = max(e.mc.p_success for e in pool)
    near = [e for e in pool if best - e.mc.p_success < 0.01]
    return min(near, key=lambda e: e.mix.sigma), bool(ok)


def plan_goal(
    goal: Goal,
    profile: RiskProfile,
    cma: CapitalMarketAssumptions,
    budget_metrics: BudgetMetrics | None = None,
    prices: dict[str, float] | None = None,
    lot_sizes: dict[str, float] | None = None,
    fx_spot: float | None = None,
    seed: int = 0,
    n_paths: int = 20000,
    today: date | None = None,
    horizon_table: list[list[float]] | None = None,
) -> GoalPlan:
    n = _horizon(goal, today or date.today())
    g = _target(goal, n, cma, fx_spot)
    pv, lumps = goal.current_pv, goal.annual_lumps or None
    table = horizon_table if horizon_table is not None else load_horizon_table()
    caps = equity_cap(n, profile, cma, budget_metrics, horizon_table=table)
    warnings: list[str] = []

    if pv >= g:
        mix = candidate_mixes(0.0, cma, profile)[0]
        paths = simulate_paths(pv, 0.0, n, mix.mu, mix.sigma, min(n_paths, 2000), seed, lumps=lumps)
        mc = replace(summarize_paths(paths, g, seed=seed), p_success=1.0)
        rec = MixEvaluation(mix, 0.0, mc)
        evals, ok, pmt80 = [rec], True, 0.0
    else:
        evals = []
        for mix in candidate_mixes(caps.w_eq, cma, profile):
            lump_fv = future_value(0.0, 0.0, n, mix.mu, lumps)
            pmt = required_pmt(g - lump_fv, pv, n, mix.mu)
            paths = simulate_paths(pv, pmt, n, mix.mu, mix.sigma, n_paths, seed, lumps=lumps)
            evals.append(MixEvaluation(mix, pmt, summarize_paths(paths, g, seed=seed)))
        rec, ok = _pick(evals, profile.max_drawdown)
        pmt80 = pmt_for_success(
            0.8, pv, n, rec.mix.mu, rec.mix.sigma, seed, g, n_paths=n_paths, lumps=lumps
        )

    mix = rec.mix
    traj = plan_trajectory(pv, rec.pmt_required, n, mix.mu, lumps)
    lots = None
    if prices and lot_sizes and pv + rec.pmt_required > 0:
        lots = money_to_lots(pv + rec.pmt_required, prices, mix.weights, lot_sizes)

    if not ok:
        warnings.append(
            "Mọi danh mục đều vượt mức sụt giảm tối đa; hệ thống chọn danh mục an toàn nhất."
        )
    if caps.binding != "tolerance":
        warnings.append(f"Tỷ trọng rủi ro bị giới hạn ở {pct(caps.w_eq)} ({caps.binding}).")
    if budget_metrics is not None and budget_metrics.feasibility > 0.5:
        warnings.append(
            f"Số tiền cần gửi {trieu(rec.pmt_required)} mỗi tháng vượt một nửa phần tiền nhàn rỗi."
        )
    if rec.mc.p_success < 0.5:
        warnings.append("Xác suất đạt mục tiêu dưới 50%; hãy tăng số tiền gửi hoặc lùi thời hạn.")
    explanations = [explain_caps(caps), explain_mix(mix, rec.mc.p_success, rec.pmt_required)]
    return GoalPlan(
        goal=goal,
        target_nominal=g,
        horizon_months=n,
        allocation=AllocationResult(caps, evals, rec),
        pmt_required=rec.pmt_required,
        pmt_for_80=pmt80,
        p_success=rec.mc.p_success,
        bands=rec.mc.bands,
        trajectory=np.asarray(traj),
        mix=mix,
        lots=lots,
        explanations=explanations,
        warnings=warnings,
    )


def plan_goals_sequential(
    goals: list[Goal],
    profile: RiskProfile,
    cma: CapitalMarketAssumptions,
    budget_metrics: BudgetMetrics | None,
    capital: float,
    **kw,
) -> list[GoalPlan]:
    """Plan goals by deadline (then priority); starting capital is consumed in that order."""
    today = kw.get("today") or date.today()
    ordered = sorted(
        goals,
        key=lambda x: (_end(x, today), x.priority),
    )
    left, plans = capital, []
    for goal in ordered:
        give = min(left, max(goal.target_amount - goal.current_pv, 0.0))
        left -= give
        plan = plan_goal(
            replace(goal, current_pv=goal.current_pv + give), profile, cma, budget_metrics, **kw
        )
        if give < goal.target_amount - goal.current_pv and left <= 0:
            plan.warnings.append(
                "Vốn ban đầu không đủ cho mục tiêu này; Mo dựa vào tiền gửi hàng tháng."
            )
        plans.append(plan)
    return plans


def _end(goal: Goal, today: date) -> date:
    if goal.horizon_months is None:
        return goal.deadline or date.max
    y, m = divmod(today.month - 1 + int(goal.horizon_months or 0), 12)
    return date(today.year + y, m + 1, 1)
