"""Golden checks against the FTU midterm spreadsheets (Excel formulas + Solver results)."""

from __future__ import annotations

import numpy as np
import pytest

from taichinh.engine.markowitz import max_sharpe_vol_cap, minimum_variance, tangency
from taichinh.engine.metrics import regress_on_market


def close(actual, expected, tol):
    np.testing.assert_allclose(actual, expected, atol=tol, rtol=0)


def test_cau1_betas(exam_returns):
    index, *stocks = exam_returns
    betas = [regress_on_market(r, index)[1] for r in stocks]
    close(betas, [0.7481, 0.910769, 1.718668], 1e-5)
    assert regress_on_market(stocks[2], index)[2] == pytest.approx(0.470648, abs=1e-5)


def test_cau2_bsr_vic_rf4(exam_inputs):
    inputs = exam_inputs([1, 3], 0.04)
    assert minimum_variance(inputs).weights[0] == pytest.approx(0.475092, abs=1e-5)
    best = tangency(inputs)
    assert best.weights[0] == pytest.approx(0.4222, abs=1e-4)
    assert best.sharpe == pytest.approx(2.096572, abs=1e-5)


def test_cau3_three_stock(exam_inputs):
    inputs = exam_inputs([1, 2, 3], 0.032)
    mvp = minimum_variance(inputs)
    close(mvp.weights, [0.208176, 0.598885, 0.192939], 1e-5)
    assert mvp.volatility == pytest.approx(0.269863, abs=1e-5)
    best = tangency(inputs)
    close(best.weights, [0.412147, 0.02615, 0.561703], 1e-5)
    assert best.sharpe == pytest.approx(2.118739, abs=1e-5)


def test_volatility_cap(exam_inputs):
    inputs = exam_inputs([1, 2, 3], 0.032)
    pf, status = max_sharpe_vol_cap(inputs, 0.3)
    assert status == "capped"
    assert pf.volatility == pytest.approx(0.3, abs=1e-6)
    assert pf.weights.sum() == pytest.approx(1.0, abs=1e-9)
    assert pf.weights.min() >= 0
    assert 1.578848 < pf.sharpe < 2.118739
    assert max_sharpe_vol_cap(inputs, 0.15)[1] == "infeasible"


def test_template_corner_solutions(template_inputs):
    inputs = template_inputs([1, 2, 3], 0.032)
    close(minimum_variance(inputs).weights, [0.503612, 0.175031, 0.321357], 1e-5)
    best = tangency(inputs)
    close(best.weights, [0, 1, 0], 1e-6)
    assert best.sharpe == pytest.approx(0.716322, abs=1e-5)


def test_template_all_below_risk_free(template_inputs):
    inputs = template_inputs([1, 3], 0.04)
    assert tangency(inputs) is None
    pf, status = max_sharpe_vol_cap(inputs, 1.0)
    assert status == "all-below-risk-free"
    assert pf.weights[0] == pytest.approx(1.0, abs=1e-6)
    assert pf.sharpe == pytest.approx(-0.354369, abs=1e-5)
