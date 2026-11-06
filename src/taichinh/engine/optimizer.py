"""Within-sleeve optimisers and candidate mix construction."""

from __future__ import annotations

import numpy as np
from scipy.optimize import minimize

from taichinh.engine.allocation_rules import sleeves
from taichinh.engine.types import CapitalMarketAssumptions, Mix, RiskProfile


def project_to_boxes(w: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> np.ndarray:
    """Euclidean projection of w onto {sum = 1, lo <= x <= hi}: x = clip(w - tau, lo, hi) with
    tau found by bisection (sum is monotone in tau). Exact, so boxes are never violated by a
    renormalisation. If the boxes cannot sum to 1 the closest feasible end is returned."""
    w = np.asarray(w, float)
    if len(w) == 0:
        return w
    if lo.sum() >= 1.0:
        return lo.copy()
    if hi.sum() <= 1.0:
        return hi.copy()
    a, b = float((w - hi).min()) - 1.0, float((w - lo).max()) + 1.0
    for _ in range(100):
        tau = 0.5 * (a + b)
        if np.clip(w - tau, lo, hi).sum() > 1.0:
            a = tau
        else:
            b = tau
    return np.clip(w - 0.5 * (a + b), lo, hi)


def _start(lo: np.ndarray, hi: np.ndarray) -> np.ndarray:
    return project_to_boxes(np.full(len(lo), 1.0 / max(len(lo), 1)), lo, hi)


def _solve(fun, jac, cov, lo, hi, x0):
    n = len(lo)
    if n == 1:
        return np.ones(1)
    res = minimize(
        fun, x0, jac=jac, method="SLSQP", bounds=list(zip(lo, hi, strict=True)),
        constraints=[{"type": "eq", "fun": lambda w: w.sum() - 1.0, "jac": lambda w: np.ones(n)}],
        options={"maxiter": 500, "ftol": 1e-14},
    )
    return project_to_boxes(res.x, lo, hi)


def min_variance_boxed(cov: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> np.ndarray:
    x0 = _start(lo, hi)
    return _solve(lambda w: float(w @ cov @ w), lambda w: 2.0 * cov @ w, cov, lo, hi, x0)


def risk_contributions(w: np.ndarray, cov: np.ndarray) -> np.ndarray:
    """Fractional contributions w_i (Sigma w)_i / (w' Sigma w); sums to 1."""
    m = w * (cov @ w)
    tot = m.sum()
    return m / tot if tot > 0 else np.full(len(w), 1.0 / len(w))


def equal_risk_contribution(cov: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> np.ndarray:
    n = len(lo)
    inv = 1.0 / np.sqrt(np.diag(cov).clip(1e-12))
    x0 = project_to_boxes(inv / inv.sum(), lo, hi)
    target = np.full(n, 1.0 / n)
    return _solve(
        lambda w: float(np.sum((1e3 * (risk_contributions(w, cov) - target)) ** 2)),
        None, cov, lo, hi, x0,
    )


def _boxes(cma, ids, total):
    """Sleeve-relative bounds: asset caps are fractions of the whole portfolio, so divide by the
    sleeve's share (`total`, 1 if the sleeve is empty), cap at 1. If the boxes cannot sum to 1
    (sum hi < 1) hi is scaled up; if sum lo > 1 lo is dropped to 0."""
    t = total if total > 1e-9 else 1.0
    lo = np.array([min(cma.assets[a].min_weight / t, 1.0) for a in ids])
    hi = np.array([min(cma.assets[a].max_weight / t, 1.0) for a in ids])
    hi = np.maximum(hi, lo)
    if hi.sum() < 1.0:
        hi = np.minimum(hi / hi.sum(), 1.0)
    if lo.sum() > 1.0:
        lo = np.zeros_like(lo)
    return lo, hi


def build_mix(name, method, w_eq, risky_w, safe_w, risky_ids, safe_ids, cma) -> Mix:
    weights: dict[str, float] = {}
    for i, a in enumerate(risky_ids):
        weights[a] = float(w_eq * risky_w[i])
    for i, a in enumerate(safe_ids):
        weights[a] = float((1.0 - w_eq) * safe_w[i])
    ids = cma.asset_ids
    w = np.array([weights.get(a, 0.0) for a in ids])
    sigma = float(np.sqrt(max(w @ cma.cov() @ w, 0.0)))
    dd = float(sum(weights[a] * cma.assets[a].max_drawdown for a in weights))
    return Mix(name, method, weights, float(w @ cma.mu()), sigma, dd, float(w_eq))


def _sub(cma, ids):
    idx = [cma.asset_ids.index(a) for a in ids]
    return idx, cma.cov()[np.ix_(idx, idx)]


def candidate_mixes(w_eq: float, cma: CapitalMarketAssumptions, profile: RiskProfile) -> list[Mix]:
    risky, safe = sleeves(cma)
    if not safe:  # no safe sleeve: everything is risky
        w_eq = 1.0
    if not risky:
        w_eq = 0.0
    r_idx, r_cov = _sub(cma, risky) if risky else ([], np.zeros((0, 0)))
    s_idx, s_cov = _sub(cma, safe) if safe else ([], np.zeros((0, 0)))
    r_lo, r_hi = _boxes(cma, risky, w_eq) if risky else (np.zeros(0), np.zeros(0))
    s_lo, s_hi = _boxes(cma, safe, 1.0 - w_eq) if safe else (np.zeros(0), np.zeros(0))

    def mk(name, method, rw, sw):
        return build_mix(name, method, w_eq, rw, sw, risky, safe, cma)

    empty = np.zeros(0)
    mixes = [
        mk("rule_minvar", "min-variance trong từng nhóm",
           min_variance_boxed(r_cov, r_lo, r_hi) if risky else empty,
           min_variance_boxed(s_cov, s_lo, s_hi) if safe else empty),
        mk("rule_erc", "cân bằng đóng góp rủi ro",
           equal_risk_contribution(r_cov, r_lo, r_hi) if risky else empty,
           equal_risk_contribution(s_cov, s_lo, s_hi) if safe else empty),
        mk("one_over_n", "chia đều",
           _start(r_lo, r_hi) if risky else empty, _start(s_lo, s_hi) if safe else empty),
    ]
    if risky and w_eq > 0:
        from taichinh.engine import markowitz
        from taichinh.engine.types import MarketInputs

        t = markowitz.tangency(MarketInputs(cma.mu()[r_idx], r_cov, cma.rf))
        if t is not None:
            rw = np.clip(np.asarray(t.weights, float), 0.0, None)
            if rw.sum() > 1e-9:
                sw = min_variance_boxed(s_cov, s_lo, s_hi) if safe else empty
                rw = project_to_boxes(rw / rw.sum(), r_lo, r_hi)
                mixes.append(mk("classic_tangency", "Markowitz tiếp tuyến", rw, sw))
    return mixes
