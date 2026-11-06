"""Property checks on a synthetic 10-stock universe."""

from __future__ import annotations

import numpy as np
import pytest

from taichinh.engine.markowitz import (
    efficient_frontier,
    max_sharpe_vol_cap,
    minimum_variance,
    optimal_cal_mix,
    random_cloud,
    tangency,
)
from taichinh.engine.returns import TRADING_DAYS
from taichinh.engine.types import MarketInputs


def synthetic_inputs(n: int, days: int, rf: float) -> MarketInputs:
    rng = np.random.default_rng(42)
    market = 0.012 * rng.standard_normal(days)
    r = np.array(
        [
            (i % 4) * 0.0006 - 0.0002 + (0.5 + i * 0.12) * market
            + 0.015 * rng.standard_normal(days)
            for i in range(n)
        ]
    )
    return MarketInputs(r.mean(axis=1) * TRADING_DAYS, np.cov(r, ddof=1) * TRADING_DAYS, rf)


@pytest.fixture(scope="module")
def setup():
    inputs = synthetic_inputs(10, 500, 0.04)
    return inputs, minimum_variance(inputs), tangency(inputs)


def test_long_only_fully_invested(setup):
    _, mvp, tg = setup
    for p in (mvp, tg):
        assert p.weights.min() >= 0
        assert p.weights.sum() == pytest.approx(1.0, abs=1e-9)


def test_no_random_portfolio_beats_optimum(setup):
    inputs, mvp, tg = setup
    cloud = random_cloud(inputs, 20000, seed=7)
    assert cloud[:, 0].min() >= mvp.volatility - 1e-12
    assert ((cloud[:, 1] - inputs.rf) / cloud[:, 0]).max() <= tg.sharpe + 1e-12


def test_frontier_monotone_and_cap_binds(setup):
    inputs, mvp, tg = setup
    vols = [p.volatility for p in efficient_frontier(inputs, mvp, 30)]
    assert all(b >= a - 1e-12 for a, b in zip(vols, vols[1:], strict=False))
    cap = (mvp.volatility + tg.volatility) / 2
    pf, status = max_sharpe_vol_cap(inputs, cap)
    assert status == "capped"
    assert pf.volatility == pytest.approx(cap, abs=1e-6)


def test_optimal_cal_mix(setup):
    inputs, _, tg = setup
    mix, utility = optimal_cal_mix(tg, inputs.rf, 3.0)
    assert 0.0 <= mix.risk_free_weight <= 1.0
    assert mix.weights.sum() + mix.risk_free_weight == pytest.approx(1.0)
    assert utility == pytest.approx(mix.expected_return - 1.5 * mix.volatility**2)
    # utility is not improved by moving along the CAL
    for y in np.linspace(0, 1, 21):
        u = inputs.rf + y * (tg.expected_return - inputs.rf) - 1.5 * (y * tg.volatility) ** 2
        assert u <= utility + 1e-12
