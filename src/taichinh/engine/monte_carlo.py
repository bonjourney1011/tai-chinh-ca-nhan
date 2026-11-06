"""Vectorised Monte Carlo of monthly goal paths."""

from __future__ import annotations

import numpy as np

from taichinh.engine.goal_math import monthly
from taichinh.engine.types import MonteCarloResult


def _draw(n_paths, n_months, mu, sigma, seed, method, hist_monthly):
    """Monthly return matrix [n_paths, n_months]; sigma == 0 -> constant, no RNG."""
    r_m = monthly(mu)
    if method == "bootstrap" and hist_monthly is not None and len(hist_monthly) > 1:
        rng = np.random.default_rng(seed)
        return rng.choice(np.asarray(hist_monthly, float), size=(n_paths, n_months))
    if sigma <= 0:
        return np.full((n_paths, n_months), r_m)
    z = np.random.default_rng(seed).standard_normal((n_paths, n_months))
    return _returns_from_z(z, mu, sigma)


def _returns_from_z(z: np.ndarray, mu: float, sigma: float) -> np.ndarray:
    return monthly(mu) + sigma / np.sqrt(12.0) * z


def _build(r: np.ndarray, pv: float, pmt: float, lumps: dict[int, float] | None) -> np.ndarray:
    n_paths, n = r.shape
    w = np.empty((n_paths, n + 1))
    w[:, 0] = pv
    lumps = lumps or {}
    for t in range(n):
        w[:, t + 1] = w[:, t] * (1.0 + r[:, t]) + pmt + lumps.get(t + 1, 0.0)
    return w


def simulate_paths(
    pv: float,
    pmt: float,
    n_months: int,
    mu: float,
    sigma: float,
    n_paths: int = 20000,
    seed: int = 0,
    method: str = "normal",
    hist_monthly: np.ndarray | None = None,
    lumps: dict[int, float] | None = None,
) -> np.ndarray:
    r = _draw(n_paths, n_months, mu, sigma, seed, method, hist_monthly)
    return _build(r, pv, pmt, lumps)


def summarize_paths(
    paths: np.ndarray,
    goal_amount: float,
    pcts: tuple[int, ...] = (5, 25, 50, 75, 95),
    seed: int = 0,
    method: str = "normal",
) -> MonteCarloResult:
    wt = paths[:, -1]
    short = wt < goal_amount
    q = np.percentile(paths, pcts, axis=0)
    return MonteCarloResult(
        p_success=float(np.mean(~short)),
        median_fv=float(np.median(wt)),
        bands={int(p): q[i] for i, p in enumerate(pcts)},
        expected_shortfall=float(np.mean(goal_amount - wt[short])) if short.any() else 0.0,
        n_paths=paths.shape[0],
        seed=seed,
        method=method,
    )


def pmt_for_success(
    target_p: float,
    pv: float,
    n_months: int,
    mu: float,
    sigma: float,
    seed: int,
    goal_amount: float,
    n_paths: int = 20000,
    lumps: dict[int, float] | None = None,
    max_pmt: float | None = None,
) -> float:
    """Smallest PMT whose p_success >= target_p, bisection with common random numbers."""
    if n_months <= 0:
        return max(0.0, goal_amount - pv)
    if sigma <= 0:
        z = np.zeros((1, n_months))
    else:
        z = np.random.default_rng(seed).standard_normal((n_paths, n_months))
    r = _returns_from_z(z, mu, sigma)

    def p_of(pmt: float) -> float:
        return float(np.mean(_build(r, pv, pmt, lumps)[:, -1] >= goal_amount))

    if p_of(0.0) >= target_p:
        return 0.0
    hi = max_pmt if max_pmt is not None else max(goal_amount / n_months, 1.0)
    for _ in range(40):
        if p_of(hi) >= target_p:
            break
        hi *= 2.0
    lo = 0.0
    for _ in range(25):
        mid = 0.5 * (lo + hi)
        if p_of(mid) >= target_p:
            hi = mid
        else:
            lo = mid
    return hi
