import pytest

from taichinh.engine import allocation_rules as ar
from taichinh.engine.budget_rules import budget_metrics
from taichinh.engine.cma import load_cma, load_horizon_table, load_profiles
from taichinh.engine.types import BudgetInputs

HT = load_horizon_table()


def test_cap_horizon_monotone_and_values():
    vals = [ar.cap_horizon(m, HT) for m in (6, 12, 24, 36, 48, 60, 120)]
    assert vals == sorted(vals)
    assert ar.cap_horizon(36, HT) == 0.2 and ar.cap_horizon(12, HT) == 0.0
    assert ar.cap_horizon(500, HT) == 0.7


def test_cap_drawdown():
    assert ar.cap_drawdown(0.2, -0.48, -0.02) == pytest.approx((0.2 - 0.02) / 0.46)
    assert ar.cap_drawdown(0.9, -0.48, -0.02) == 1.0
    assert ar.cap_drawdown(0.2, -0.1, -0.1) == 1.0
    assert ar.cap_drawdown(0.05, -0.1, -0.1) == 0.0


def test_cap_var_decreasing_with_tighter_limit():
    caps = [ar.cap_var(x, 0.1, 0.22, 0.06, 0.01, 0.0) for x in (0.25, 0.15, 0.08, 0.02)]
    assert caps == sorted(caps, reverse=True)
    assert caps[0] > caps[-1]
    assert 0 <= caps[-1] <= 1


def test_cap_capacity():
    p = load_profiles()["can_bang"]
    assert ar.cap_capacity(None, p) == 1.0
    m = budget_metrics(BudgetInputs(10e6, 4e6, 2e6, 4e6), 1e6)  # emergency 1 month
    assert ar.cap_capacity(m, p) == p.capacity_cap_no_emergency
    m2 = budget_metrics(BudgetInputs(10e6, 4e6, 2e6, 40e6), 3e6)  # feasibility 1.0
    assert ar.cap_capacity(m2, p) == 0.4


def test_equity_cap_binding():
    cma = load_cma()
    c = ar.equity_cap(36, load_profiles()["can_bang"], cma, horizon_table=HT)
    assert c.w_eq == min(c.horizon, c.drawdown, c.var, c.tolerance, c.capacity) == 0.2
    assert c.binding == "horizon"
    assert ar.equity_cap(6, load_profiles()["can_bang"], cma, horizon_table=HT).w_eq == 0.0
    risky, safe = ar.sleeves(cma)
    assert "etf_vn30" in risky and "deposit_12m" in safe
