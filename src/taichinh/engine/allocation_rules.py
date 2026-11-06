"""Equity-cap rules: horizon, drawdown, VaR, tolerance (profile) and capacity."""

from __future__ import annotations

import numpy as np

from taichinh.engine.types import (
    BudgetMetrics,
    CapitalMarketAssumptions,
    EquityCaps,
    RiskProfile,
)
from taichinh.settings import load_yaml


def _default_table() -> list[list[float]]:
    return load_yaml("profiles.yml")["horizon_caps"]


def cap_horizon(months: float, table: list[list[float]] | None = None) -> float:
    for upper, cap in table if table is not None else _default_table():
        if months <= upper:
            return float(cap)
    return float(table[-1][1] if table else 1.0)


def cap_drawdown(d_max: float, dd_risky: float, dd_safe: float) -> float:
    """Largest w with w*DD_r + (1-w)*DD_s >= -d_max (drawdowns are negative)."""
    den = dd_risky - dd_safe
    if abs(den) < 1e-12:
        return 1.0 if dd_risky >= -d_max else 0.0
    return float(np.clip((-d_max - dd_safe) / den, 0.0, 1.0))


def _port(w, mu_r, sig_r, mu_s, sig_s, rho):
    mu = w * mu_r + (1 - w) * mu_s
    var = (w * sig_r) ** 2 + ((1 - w) * sig_s) ** 2 + 2 * w * (1 - w) * rho * sig_r * sig_s
    return mu, np.sqrt(np.maximum(var, 0.0))


def cap_var(loss_limit, mu_r, sig_r, mu_s, sig_s, rho, z: float = 1.645) -> float:
    """Largest w in [0,1] with z*sigma_p(w) - mu_p(w) <= loss_limit."""
    def excess(w: float) -> float:
        mu, sg = _port(w, mu_r, sig_r, mu_s, sig_s, rho)
        return float(z * sg - mu - loss_limit)

    if excess(0.0) > 0:
        return 0.0
    grid = np.arange(0.0, 1.0 + 1e-9, 0.005)
    best = 0.0
    for i, w in enumerate(grid):
        if excess(w) <= 0:
            best = float(w)
            continue
        lo, hi = float(grid[i - 1]), float(w)
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            lo, hi = (mid, hi) if excess(mid) <= 0 else (lo, mid)
        return lo
    return min(best, 1.0)


def cap_capacity(budget_metrics: BudgetMetrics | None, profile: RiskProfile) -> float:
    if budget_metrics is None:
        return 1.0
    cap = 1.0
    if budget_metrics.emergency_months < 3:
        cap = min(cap, profile.capacity_cap_no_emergency)
    if budget_metrics.feasibility > 0.5:
        cap = min(cap, 0.4)
    return cap


def sleeves(cma: CapitalMarketAssumptions) -> tuple[list[str], list[str]]:
    risky = [a for a in cma.asset_ids if cma.assets[a].sleeve == "risky"]
    safe = [a for a in cma.asset_ids if cma.assets[a].sleeve == "safe"]
    return risky, safe


def _sleeve_stats(cma: CapitalMarketAssumptions, ids: list[str]):
    """Equal-weight sleeve (mu, sigma, maxDD) used only for cap calculations."""
    if not ids:
        return 0.0, 0.0, 0.0
    idx = [cma.asset_ids.index(a) for a in ids]
    w = np.full(len(idx), 1.0 / len(idx))
    mu = float(w @ cma.mu()[idx])
    sig = float(np.sqrt(w @ cma.cov()[np.ix_(idx, idx)] @ w))
    dd = float(w @ np.array([cma.assets[a].max_drawdown for a in ids]))
    return mu, sig, dd


def equity_cap(
    horizon_months: float,
    profile: RiskProfile,
    cma: CapitalMarketAssumptions,
    budget_metrics: BudgetMetrics | None = None,
) -> EquityCaps:
    risky, safe = sleeves(cma)
    mu_r, sig_r, dd_r = _sleeve_stats(cma, risky)
    mu_s, sig_s, dd_s = _sleeve_stats(cma, safe)
    if risky and safe:
        ir, js = [cma.asset_ids.index(a) for a in risky], [cma.asset_ids.index(a) for a in safe]
        wr, ws = np.full(len(ir), 1 / len(ir)), np.full(len(js), 1 / len(js))
        c = wr @ cma.cov()[np.ix_(ir, js)] @ ws
        rho = float(c / (sig_r * sig_s)) if sig_r * sig_s > 0 else 0.0
    else:
        rho = 0.0
    caps = {
        "horizon": cap_horizon(horizon_months),
        "drawdown": cap_drawdown(profile.max_drawdown, dd_r, dd_s),
        "var": cap_var(profile.var_limit, mu_r, sig_r, mu_s, sig_s, rho),
        "tolerance": profile.max_equity,
        "capacity": cap_capacity(budget_metrics, profile),
    }
    binding = min(caps, key=lambda k: caps[k])
    return EquityCaps(w_eq=float(caps[binding]), binding=binding, **caps)
