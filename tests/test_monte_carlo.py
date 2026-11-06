import time

import numpy as np
import pytest

from taichinh.engine import goal_math as gm
from taichinh.engine import monte_carlo as mc


def test_zero_sigma_matches_deterministic():
    pmt = gm.required_pmt(100e6, 5e6, 60, 0.07)
    for p, expect in ((pmt * 1.01, 1.0), (pmt * 0.9, 0.0)):
        paths = mc.simulate_paths(5e6, p, 60, 0.07, 0.0, n_paths=50, seed=1)
        res = mc.summarize_paths(paths, 100e6)
        assert res.p_success == expect == float(gm.future_value(5e6, p, 60, 0.07) >= 100e6)
    tr = gm.plan_trajectory(5e6, pmt, 60, 0.07)
    paths = mc.simulate_paths(5e6, pmt, 60, 0.07, 0.0, n_paths=10)
    assert np.allclose(mc.summarize_paths(paths, 1e9).bands[50], tr)


def test_seed_reproducible_and_bands_ordered():
    a = mc.summarize_paths(mc.simulate_paths(1e6, 1e6, 24, 0.08, 0.15, 2000, 7), 3e7)
    b = mc.summarize_paths(mc.simulate_paths(1e6, 1e6, 24, 0.08, 0.15, 2000, 7), 3e7)
    for k in a.bands:
        assert np.array_equal(a.bands[k], b.bands[k])
    assert (a.bands[5] <= a.bands[50]).all() and (a.bands[50] <= a.bands[95]).all()
    assert a.expected_shortfall >= 0


def test_bootstrap_runs():
    hist = np.array([0.01, -0.02, 0.03, 0.0, 0.015])
    p = mc.simulate_paths(1e6, 0, 12, 0.08, 0.1, 500, 3, method="bootstrap", hist_monthly=hist)
    assert p.shape == (500, 13)


def test_pmt_for_success_near_deterministic_at_half():
    det = gm.required_pmt(100e6, 5e6, 60, 0.08)
    got = mc.pmt_for_success(0.5, 5e6, 60, 0.08, 0.10, 11, 100e6, n_paths=8000)
    assert got == pytest.approx(det, rel=0.10)
    assert mc.pmt_for_success(0.8, 5e6, 60, 0.08, 0.10, 11, 100e6, n_paths=8000) > got
    assert mc.pmt_for_success(0.5, 200e6, 12, 0.05, 0.0, 1, 100e6) == 0.0


def test_runtime():
    t = time.perf_counter()
    mc.simulate_paths(1e6, 1e6, 120, 0.08, 0.15, 20000, 1)
    assert time.perf_counter() - t < 2.0
