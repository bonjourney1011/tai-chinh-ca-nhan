"""Portfolio and performance metrics."""

from __future__ import annotations

import numpy as np
from scipy.stats import norm

from taichinh.engine.returns import TRADING_DAYS, simple_returns
from taichinh.engine.types import PerformanceSummary


def portfolio_mu_sigma(w: np.ndarray, mu: np.ndarray, cov: np.ndarray) -> tuple[float, float]:
    return float(w @ mu), float(np.sqrt(max(0.0, w @ cov @ w)))


def sharpe(mu: float, sigma: float, rf: float) -> float:
    return (mu - rf) / sigma if sigma >= 1e-12 else 0.0


def max_drawdown(wealth: np.ndarray) -> float:
    """Largest peak-to-trough fall as a positive fraction."""
    w = np.asarray(wealth, dtype=float)
    return float(np.max(1.0 - w / np.maximum.accumulate(w)))


def summarize_wealth(
    wealth: np.ndarray, rf: float, periods: int = TRADING_DAYS
) -> PerformanceSummary:
    r = simple_returns(wealth)
    ann = float(np.mean(r) * periods)
    vol = float(np.sqrt(max(0.0, np.var(r, ddof=1)) * periods))
    return PerformanceSummary(
        ann, vol, sharpe(ann, vol, rf), max_drawdown(wealth), float(wealth[-1] / wealth[0] - 1)
    )


def buy_and_hold_wealth(
    closes: np.ndarray,
    weights: np.ndarray,
    rf_weight: float,
    rf: float,
    periods: int = TRADING_DAYS,
) -> np.ndarray:
    """Growth of 1 invested at closes[:, 0], no rebalancing; cash accrues rf/periods per step."""
    c = np.asarray(closes, dtype=float)
    risky = (np.asarray(weights)[:, None] * c / c[:, :1]).sum(axis=0)
    t = np.arange(c.shape[1])
    return risky + rf_weight * (1.0 + rf / periods) ** t


def regress_on_market(y: np.ndarray, x: np.ndarray) -> tuple[float, float, float]:
    """(alpha, beta, r2) = Excel INTERCEPT / SLOPE / RSQ of y on x."""
    c = np.cov(x, y, ddof=1)
    beta = c[0, 1] / c[0, 0]
    alpha = np.mean(y) - beta * np.mean(x)
    return float(alpha), float(beta), float(c[0, 1] ** 2 / (c[0, 0] * c[1, 1]))


def portfolio_beta(w: np.ndarray, betas: np.ndarray) -> float:
    return float(np.dot(w, betas))


def parametric_var_es(mu: float, sigma: float, alpha: float = 0.95) -> tuple[float, float]:
    """Normal VaR/ES as positive losses: VaR = z*s - mu, ES = s*phi(z)/(1-alpha) - mu."""
    z = norm.ppf(alpha)
    return float(z * sigma - mu), float(sigma * norm.pdf(z) / (1.0 - alpha) - mu)


def historical_var_es(returns: np.ndarray, alpha: float = 0.95) -> tuple[float, float]:
    r = np.asarray(returns, dtype=float)
    q = np.quantile(r, 1.0 - alpha)
    return float(-q), float(-r[r <= q].mean())


def ewma_vol(returns: np.ndarray, lam: float = 0.94) -> float:
    """RiskMetrics EWMA volatility (per period) after the last return; seeded with sample var."""
    r = np.asarray(returns, dtype=float)
    var = float(np.var(r, ddof=1)) if len(r) > 1 else float(r[0] ** 2)
    for x in r:
        var = lam * var + (1.0 - lam) * x * x
    return float(np.sqrt(var))
