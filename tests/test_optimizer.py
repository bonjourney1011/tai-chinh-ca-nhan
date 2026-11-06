import numpy as np
import pytest

from taichinh.engine import optimizer as op
from taichinh.engine.cma import load_cma, load_profiles

COV = np.array([[0.04, 0.006, 0.0], [0.006, 0.0256, 0.004], [0.0, 0.004, 0.09]])


def test_minvar_within_boxes_and_beats_equal():
    lo, hi = np.zeros(3), np.array([0.7, 0.7, 0.3])
    w = op.min_variance_boxed(COV, lo, hi)
    assert w.sum() == pytest.approx(1) and (w >= lo - 1e-9).all() and (w <= hi + 1e-9).all()
    eq = np.full(3, 1 / 3)
    assert w @ COV @ w <= eq @ COV @ eq + 1e-12


def test_erc_equal_contributions():
    w = op.equal_risk_contribution(COV, np.zeros(3), np.ones(3))
    rc = op.risk_contributions(w, COV)
    assert w.sum() == pytest.approx(1)
    assert np.allclose(rc, 1 / 3, atol=1e-4)


def test_single_asset_sleeve():
    one = np.array([[0.01]])
    assert op.min_variance_boxed(one, np.zeros(1), np.ones(1))[0] == 1.0
    assert op.equal_risk_contribution(one, np.zeros(1), np.ones(1))[0] == 1.0


def test_candidate_mixes():
    cma = load_cma()
    mixes = op.candidate_mixes(0.2, cma, load_profiles()["can_bang"])
    assert {"rule_minvar", "rule_erc", "one_over_n"} <= {m.name for m in mixes}
    for m in mixes:
        assert sum(m.weights.values()) == pytest.approx(1)
        risky = sum(v for k, v in m.weights.items() if cma.assets[k].sleeve == "risky")
        assert risky == pytest.approx(0.2)
        assert m.sigma > 0 and m.est_max_drawdown <= 0


def test_zero_equity_mix():
    cma = load_cma()
    m = op.candidate_mixes(0.0, cma, load_profiles()["bao_thu"])[0]
    assert sum(m.weights.values()) == pytest.approx(1)
    assert all(m.weights[a] == 0 for a in m.weights if cma.assets[a].sleeve == "risky")
