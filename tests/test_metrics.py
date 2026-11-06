"""Unit tests for metrics, covariance helpers and return conversions."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from scipy.stats import norm

from taichinh.engine.covariance import ledoit_wolf_cov, nearest_psd
from taichinh.engine.metrics import (
    historical_var_es,
    max_drawdown,
    parametric_var_es,
    regress_on_market,
    summarize_wealth,
)
from taichinh.engine.returns import annual_rate, monthly_rate, simple_returns, to_monthly


def test_max_drawdown_known_path():
    assert max_drawdown(np.array([1.0, 1.2, 0.9, 1.1, 0.6, 1.0])) == pytest.approx(0.5)
    assert max_drawdown(np.array([1.0, 1.1, 1.2])) == 0.0


def test_summarize_wealth_total_return():
    s = summarize_wealth(np.array([1.0, 1.1, 0.99, 1.2]), 0.02)
    assert s.total_return == pytest.approx(0.2)
    assert s.max_drawdown == pytest.approx(0.1)


def test_parametric_var_es_matches_scipy():
    mu, sigma, a = 0.08, 0.2, 0.95
    var, es = parametric_var_es(mu, sigma, a)
    assert var == pytest.approx(-norm.ppf(1 - a, loc=mu, scale=sigma))
    tail = norm.expect(lambda x: x, loc=mu, scale=sigma, ub=norm.ppf(1 - a, mu, sigma)) / (1 - a)
    assert es == pytest.approx(-tail, abs=1e-6)


def test_historical_var_es_ordering():
    r = np.random.default_rng(1).normal(0.001, 0.01, 2000)
    var, es = historical_var_es(r, 0.95)
    assert es >= var > 0


def test_regress_on_market_matches_polyfit():
    rng = np.random.default_rng(3)
    x = rng.normal(0, 0.01, 300)
    y = 0.0002 + 1.3 * x + rng.normal(0, 0.005, 300)
    alpha, beta, r2 = regress_on_market(y, x)
    slope, intercept = np.polyfit(x, y, 1)
    assert beta == pytest.approx(slope)
    assert alpha == pytest.approx(intercept)
    assert r2 == pytest.approx(np.corrcoef(x, y)[0, 1] ** 2)


def test_ledoit_wolf_shrinkage_and_psd():
    x = np.random.default_rng(5).normal(size=(40, 15))
    cov, shrink = ledoit_wolf_cov(x)
    assert 0.0 <= shrink <= 1.0
    assert np.linalg.eigvalsh(cov).min() > 0
    assert np.allclose(cov, cov.T)


def test_nearest_psd_fixes_non_psd():
    m = np.array([[1.0, 0.9, 0.0], [0.9, 1.0, 0.9], [0.0, 0.9, 1.0]])
    m[0, 2] = -0.9
    assert np.linalg.eigvalsh(m).min() < 0
    assert np.linalg.eigvalsh(nearest_psd(m)).min() >= 0


def test_returns_helpers():
    assert simple_returns(np.array([100.0, 110.0, 99.0])) == pytest.approx([0.1, -0.1])
    two_d = simple_returns(np.array([[1.0, 2.0, 3.0], [2.0, 2.0, 4.0]]))
    assert two_d.shape == (2, 2)
    assert annual_rate(monthly_rate(0.12)) == pytest.approx(0.12)
    idx = pd.to_datetime(["2025-01-15", "2025-01-31", "2025-02-14", "2025-02-28", "2025-03-31"])
    m = to_monthly(pd.DataFrame({"a": [1.0, 2.0, 2.5, 3.0, 4.5]}, index=idx))
    assert m["a"].tolist() == pytest.approx([0.5, 0.5])
