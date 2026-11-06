import numpy as np
import pandas as pd
import pytest

from taichinh.engine import cma as c


def test_load_cma_and_stocks():
    m = c.load_cma(stock_ids=["FPT", "VNM"])
    assert "stock_default" not in m.asset_ids and m.asset_ids[-2:] == ["FPT", "VNM"]
    assert np.allclose(m.corr, m.corr.T) and np.allclose(np.diag(m.corr), 1)
    assert np.linalg.eigvalsh(m.corr).min() > -1e-9
    assert m.assets["FPT"].sigma == 0.35 and m.assets["FPT"].id == "FPT"
    assert m.inflation == 0.045 and m.rf == 0.044
    sub = c.load_cma(asset_ids=["deposit_12m", "etf_vn30"])
    assert sub.corr.shape == (2, 2)


def test_blend_zero_history_is_prior():
    prior = c.load_cma()
    out = c.blend_with_history(prior, pd.DataFrame({"etf_vn30": []}, dtype=float))
    assert np.allclose(out.cov(), prior.cov())
    rng = np.random.default_rng(0)
    short = pd.DataFrame(rng.normal(0, 0.05, (12, 2)), columns=["etf_vn30", "gold_sjc"])
    assert np.allclose(c.blend_with_history(prior, short).cov(), prior.cov())


def test_blend_long_history_psd_and_mu_kept():
    prior = c.load_cma()
    rng = np.random.default_rng(1)
    df = pd.DataFrame(rng.normal(0, 0.03, (150, 3)), columns=["etf_vn30", "gold_sjc", "us_etf"])
    out = c.blend_with_history(prior, df)
    assert np.linalg.eigvalsh(out.corr).min() > -1e-9
    assert np.allclose(out.mu(), prior.mu())
    assert out.assets["etf_vn30"].history_months == 120
    assert out.assets["etf_vn30"].sigma != prior.assets["etf_vn30"].sigma
    assert out.assets["btc"].sigma == prior.assets["btc"].sigma


def test_overrides_and_rates():
    prior = c.load_cma()
    out = c.apply_overrides(prior, {"btc": 0.01, "nope": 1})
    assert out.assets["btc"].mu_base == 0.01 and prior.assets["btc"].mu_base == 0.15
    assert c.real_rate(0.10, 0.045) == pytest.approx(1.1 / 1.045 - 1)


def test_profiles_thresholds():
    p = c.load_profiles()
    assert p["can_bang"].max_drawdown == 0.2 and set(p) == {"bao_thu", "can_bang", "tang_truong"}
    assert c.load_thresholds()["min_savings_rate"] == 0.10
