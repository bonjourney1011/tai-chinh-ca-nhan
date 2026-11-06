"""Regression tests for the phase-1 code review (boxes, history gaps, goal maths, USD goals)."""

from dataclasses import replace
from datetime import date

import numpy as np
import pandas as pd
import pytest

from taichinh.engine import cma as c
from taichinh.engine import goal_math as gm
from taichinh.engine.goal_math import months_to_goal
from taichinh.engine.optimizer import candidate_mixes, project_to_boxes
from taichinh.engine.planner import _target
from taichinh.engine.returns import to_monthly
from taichinh.engine.types import Goal
from taichinh.universe import CORE_CMA, FOREIGN_CMA, monthly_returns_by_cma_key


@pytest.mark.parametrize("w_eq", [0.2, 0.7])
def test_every_candidate_respects_asset_boxes(w_eq):
    cma = c.load_cma(asset_ids=list(CORE_CMA) + list(FOREIGN_CMA))
    mixes = candidate_mixes(w_eq, cma, c.load_profiles()["tang_truong"])
    assert {m.name for m in mixes} >= {"rule_minvar", "rule_erc", "one_over_n"}
    for m in mixes:
        assert sum(m.weights.values()) == pytest.approx(1.0)
        for a, w in m.weights.items():
            assert w <= cma.assets[a].max_weight + 1e-6, (m.name, a, w)
            assert w >= cma.assets[a].min_weight - 1e-6


def test_project_to_boxes_exact():
    lo, hi = np.zeros(3), np.array([0.5, 0.3, 1.0])
    w = project_to_boxes(np.array([0.9, 0.9, 0.0]), lo, hi)
    assert w.sum() == pytest.approx(1.0) and (w <= hi + 1e-12).all() and (w >= lo).all()


def test_months_to_goal_negative_rate():
    n = months_to_goal(100, 0, 10, -0.03)
    assert n == pytest.approx(11, abs=1)
    assert gm.future_value(0, 10, int(np.ceil(n)), -0.03) >= 100
    assert months_to_goal(100, 0, 10, 0.05) is not None
    assert months_to_goal(100, 0, 0, -0.03) is None  # nothing saved, value only decays
    assert months_to_goal(1000, 0, 10, -0.5) is None  # asymptote pmt/|r| below the goal


def test_to_monthly_drops_current_partial_month():
    idx = pd.to_datetime(["2026-08-31", "2026-09-30", "2026-10-31", "2026-11-03", "2026-11-05"])
    df = pd.DataFrame({"a": [1.0, 1.1, 1.21, 1.3, 1.4]}, index=idx)
    m = to_monthly(df, today=date(2026, 11, 6))
    assert list(m.index.strftime("%Y-%m")) == ["2026-09", "2026-10"]
    assert len(to_monthly(df, today=date(2026, 11, 30))) == 3


def test_gold_history_gap_filled_from_real_csv():
    hist = monthly_returns_by_cma_key(["gold_sjc", "etf_vn30"])
    assert hist["gold_sjc"].tail(120).notna().sum() >= 118
    assert hist.index.max() <= pd.Timestamp(date.today())
    out = c.blend_with_history(c.load_cma(), hist)
    assert out.assets["gold_sjc"].history_months >= 118
    assert np.linalg.eigvalsh(out.corr).min() > -1e-9


def test_blend_uses_own_window_not_joint_dropna():
    rng = np.random.default_rng(3)
    a = rng.normal(0, 0.05, 120)
    b = np.where(np.arange(120) < 60, np.nan, rng.normal(0, 0.02, 120))
    out = c.blend_with_history(c.load_cma(), pd.DataFrame({"etf_vn30": a, "gold_sjc": b}))
    assert out.assets["etf_vn30"].history_months == 120
    assert out.assets["gold_sjc"].history_months == 60
    # sigma of the long series is its full-window sigma, not the 60-row intersection
    lam = 1.0
    assert out.assets["etf_vn30"].sigma == pytest.approx(lam * a.std(ddof=1) * np.sqrt(12))
    assert np.linalg.eigvalsh(out.corr).min() > -1e-9


def test_usd_goal_gets_fx_drift_only():
    cma = c.load_cma()
    g = Goal("u", "u", 1000.0, horizon_months=24, currency="USD", fx_drift=0.02,
             inflation_adjust=True)
    assert _target(g, 24, cma, 25000.0) == pytest.approx(1000 * 25000 * 1.02**2)
    v = replace(g, currency="VND", target_amount=1e8)
    assert _target(v, 24, cma, None) == pytest.approx(1e8 * (1 + cma.inflation) ** 2)
    assert _target(replace(v, inflation_adjust=False), 24, cma, None) == 1e8
