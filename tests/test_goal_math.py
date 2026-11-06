import numpy as np
import pytest

from taichinh.engine import goal_math as gm


@pytest.mark.parametrize("rate", [0.06, 0.0, -0.03])
def test_pmt_fv_identity(rate):
    pmt = gm.required_pmt(100e6, 10e6, 36, rate)
    assert gm.future_value(10e6, pmt, 36, rate) == pytest.approx(100e6, rel=1e-9)


def test_pmt_edges():
    assert gm.required_pmt(100, 200, 12, 0.05) == 0.0
    assert gm.required_pmt(100, 40, 0, 0.05) == 60
    assert gm.required_pmt(120, 0, 12, 0.0) == pytest.approx(10)


def test_months_round_trip():
    n = gm.months_to_goal(100e6, 10e6, 2e6, 0.06)
    assert gm.required_pmt(100e6, 10e6, round(n), 0.06) == pytest.approx(2e6, rel=0.05)
    assert gm.future_value(10e6, 2e6, 1, 0.06) < 100e6
    assert gm.months_to_goal(100, 200, 0, 0.05) == 0
    assert gm.months_to_goal(100, 10, 0, 0.0) is None
    assert gm.months_to_goal(100, 0, 10, 0.0) == pytest.approx(10)


def test_trajectory_matches_fv_with_lumps():
    lumps = {6: 5e6}
    tr = gm.plan_trajectory(1e6, 1e6, 12, 0.06, lumps)
    assert len(tr) == 13
    assert tr[-1] == pytest.approx(gm.future_value(1e6, 1e6, 12, 0.06, lumps))


def test_inflate_and_fx():
    assert gm.inflate_target(100, 0.05, 12) == pytest.approx(105)
    assert gm.fx_adjusted_target(1000, 25000, 0.02, 24) == pytest.approx(1000 * 25000 * 1.02**2)
    assert isinstance(gm.plan_trajectory(0, 1, 3, 0.0), np.ndarray)
