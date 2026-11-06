from datetime import date

import pytest

from taichinh.engine.budget_rules import budget_metrics
from taichinh.engine.cma import load_cma, load_profiles
from taichinh.engine.planner import plan_goal, plan_goals_sequential
from taichinh.engine.types import BudgetInputs, Goal

CMA = load_cma()
PROF = load_profiles()["can_bang"]


def test_end_to_end_36_months():
    g = Goal("g1", "Mua xe", 100e6, horizon_months=36)
    plan = plan_goal(g, PROF, CMA, seed=5, n_paths=5000)
    assert 0 < plan.p_success < 1 and plan.pmt_required > 0
    assert sum(plan.mix.weights.values()) == pytest.approx(1)
    assert plan.mix.w_eq <= 0.2 + 1e-9 and plan.allocation.caps.w_eq == 0.2
    assert plan.pmt_for_80 > plan.pmt_required
    assert len(plan.trajectory) == 37 and len(plan.bands[50]) == 37
    assert plan.target_nominal == pytest.approx(100e6 * 1.045**3)
    assert plan.explanations and len(plan.allocation.candidates) >= 3


def test_already_funded():
    g = Goal("g", "x", 50e6, current_pv=80e6, horizon_months=24, inflation_adjust=False)
    plan = plan_goal(g, PROF, CMA, n_paths=500)
    assert plan.pmt_required == 0 and plan.p_success == 1 and plan.mix.w_eq == 0


def test_deadline_usd_and_lots():
    g = Goal("g", "du hoc", 1000, currency="USD", deadline=date(2029, 11, 6), fx_drift=0.02)
    plan = plan_goal(
        g, PROF, CMA, prices={"etf_vn30": 20000, "gold_sjc": 80000},
        lot_sizes={"etf_vn30": 100, "gold_sjc": 1}, fx_spot=25000,
        today=date(2026, 11, 6), n_paths=2000,
    )
    assert plan.horizon_months == 36 and plan.lots is not None
    with pytest.raises(ValueError):
        plan_goal(g, PROF, CMA, today=date(2026, 11, 6))


def test_budget_warning():
    m = budget_metrics(BudgetInputs(10e6, 6e6, 3e6, 5e6), 5e6)
    plan = plan_goal(Goal("g", "x", 300e6, horizon_months=36), PROF, CMA, m, n_paths=1000)
    assert plan.warnings


def test_sequential():
    gs = [Goal("b", "b", 200e6, horizon_months=60), Goal("a", "a", 50e6, horizon_months=12)]
    plans = plan_goals_sequential(gs, PROF, CMA, None, 30e6, n_paths=1000, today=date(2026, 11, 6))
    assert [p.goal.id for p in plans] == ["a", "b"]
    assert plans[0].goal.current_pv == 30e6
    assert any("Vốn" in w for w in plans[1].warnings)
