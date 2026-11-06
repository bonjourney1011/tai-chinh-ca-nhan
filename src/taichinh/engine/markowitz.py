"""Long-only Markowitz optimizers on annual MarketInputs (port of the TS optimizer)."""

from __future__ import annotations

import numpy as np

from taichinh.engine.metrics import portfolio_mu_sigma
from taichinh.engine.qp_solver import solve_nonneg_qp
from taichinh.engine.types import CapStatus, MarketInputs, PortfolioStats


def evaluate_portfolio(w: np.ndarray, inputs: MarketInputs) -> PortfolioStats:
    mu, sigma = portfolio_mu_sigma(w, inputs.mu, inputs.cov)
    sh = (mu - inputs.rf) / sigma if sigma > 0 else float("nan")
    return PortfolioStats(np.asarray(w, dtype=float), 0.0, mu, sigma, sh)


def _unit(n: int, k: int) -> np.ndarray:
    v = np.zeros(n)
    v[k] = 1.0
    return v


def minimum_variance(inputs: MarketInputs) -> PortfolioStats:
    n = len(inputs.mu)
    ones = np.ones(n)
    w = solve_nonneg_qp(inputs.cov, ones[None, :], np.array([1.0]), ones / n)
    return evaluate_portfolio(w, inputs)


def frontier_portfolio(target: float, inputs: MarketInputs, mvp: PortfolioStats) -> PortfolioStats:
    """Lowest-risk long-only portfolio earning `target`."""
    n = len(inputs.mu)
    top = int(np.argmax(inputs.mu))
    span = inputs.mu[top] - mvp.expected_return
    if target >= inputs.mu[top]:
        return evaluate_portfolio(_unit(n, top), inputs)
    if span <= 1e-12 or target <= mvp.expected_return:
        return mvp
    t = (target - mvp.expected_return) / span
    start = (1 - t) * mvp.weights + t * _unit(n, top)
    a = np.vstack([np.ones(n), inputs.mu])
    w = solve_nonneg_qp(inputs.cov, a, np.array([1.0, target]), start)
    return evaluate_portfolio(w, inputs)


def efficient_frontier(
    inputs: MarketInputs, mvp: PortfolioStats, points: int = 40
) -> list[PortfolioStats]:
    top = float(np.max(inputs.mu))
    if top - mvp.expected_return <= 1e-12:
        return [mvp]
    return [
        frontier_portfolio(
            mvp.expected_return + (top - mvp.expected_return) * i / (points - 1), inputs, mvp
        )
        for i in range(points)
    ]


def tangency(inputs: MarketInputs) -> PortfolioStats | None:
    """Max-Sharpe long-only: min y'Sy s.t. (mu-rf)'y = 1, y >= 0, w = y / sum(y)."""
    excess = inputs.mu - inputs.rf
    best = int(np.argmax(excess))
    if excess[best] <= 0:
        return None
    y = solve_nonneg_qp(
        inputs.cov, excess[None, :], np.array([1.0]), _unit(len(excess), best) / excess[best]
    )
    w = y / y.sum()
    w[w < 1e-10] = 0.0
    return evaluate_portfolio(w, inputs)


def max_sharpe_vol_cap(
    inputs: MarketInputs,
    cap: float,
    mvp: PortfolioStats | None = None,
    tangency_pf: PortfolioStats | None = None,  # precomputed tangency (mirrors the TS param)
) -> tuple[PortfolioStats | None, CapStatus]:
    """Max-Sharpe stock-only portfolio with sigma <= cap (bisection along the frontier)."""
    mvp = mvp or minimum_variance(inputs)
    tg = tangency_pf if tangency_pf is not None else tangency(inputs)
    if mvp.volatility > cap * (1 + 1e-9):
        return None, "infeasible"
    if tg is not None:
        if tg.volatility <= cap:
            return tg, "within-cap"
        lo, hi, best = mvp.expected_return, tg.expected_return, mvp
        for _ in range(60):
            mid = (lo + hi) / 2
            cand = frontier_portfolio(mid, inputs, mvp)
            if cand.volatility <= cap:
                best, lo = cand, mid
            else:
                hi = mid
        return best, "capped"
    best = mvp
    for p in efficient_frontier(inputs, mvp, 101):
        if p.volatility <= cap and p.sharpe > best.sharpe:
            best = p
    return best, "all-below-risk-free"




def risk_free_mix(tg: PortfolioStats | None, rf: float, cap: float, n: int) -> PortfolioStats:
    """CAL mix: scale the tangency by y = min(1, cap/sigma_T), rest in the risk-free asset."""
    if tg is None:
        return PortfolioStats(np.zeros(n), 1.0, rf, 0.0, 0.0)
    y = min(1.0, cap / tg.volatility)
    return PortfolioStats(
        tg.weights * y, 1 - y, rf + y * (tg.expected_return - rf), y * tg.volatility, tg.sharpe
    )


def optimal_cal_mix(
    tg: PortfolioStats | None, rf: float, risk_aversion: float
) -> tuple[PortfolioStats, float]:
    """Utility-maximising CAL point: y* = (muT - rf)/(A sigmaT^2) in [0, 1].

    Returns (stats, utility) with U = mu - (A/2) sigma^2.
    """
    if tg is None:
        return risk_free_mix(None, rf, 0.0, 0), rf
    y = float(np.clip((tg.expected_return - rf) / (risk_aversion * tg.volatility**2), 0.0, 1.0))
    mix = risk_free_mix(tg, rf, y * tg.volatility, len(tg.weights))
    return mix, mix.expected_return - 0.5 * risk_aversion * mix.volatility**2


def equal_weight(inputs: MarketInputs) -> PortfolioStats:
    return evaluate_portfolio(np.full(len(inputs.mu), 1.0 / len(inputs.mu)), inputs)


def random_cloud(inputs: MarketInputs, count: int, seed: int) -> np.ndarray:
    """Random long-only portfolios, z = -ln(1-U), w = z/sum(z). Returns [count, 2] = (sigma, mu)."""
    rng = np.random.default_rng(seed)
    z = -np.log(1.0 - rng.random((count, len(inputs.mu))))
    w = z / z.sum(axis=1, keepdims=True)
    mu = w @ inputs.mu
    sigma = np.sqrt(np.maximum(0.0, np.einsum("ij,jk,ik->i", w, inputs.cov, w)))
    return np.column_stack([sigma, mu])
