"""Deterministic goal maths. Rates are annual decimals; monthly r = (1+R)^(1/12) - 1."""

from __future__ import annotations

import math

import numpy as np

_EPS = 1e-9


def monthly(annual_rate: float) -> float:
    return (1.0 + annual_rate) ** (1.0 / 12.0) - 1.0


def required_pmt(goal_amount: float, pv: float, n_months: int, annual_rate: float) -> float:
    """End-of-month contribution that grows pv to goal_amount in n_months (floored at 0)."""
    if n_months <= 0:
        return max(0.0, goal_amount - pv)
    r = monthly(annual_rate)
    if abs(r) < _EPS:
        return max(0.0, (goal_amount - pv) / n_months)
    g = (1.0 + r) ** n_months
    return max(0.0, (goal_amount - pv * g) * r / (g - 1.0))


def future_value(
    pv: float, pmt: float, n_months: int, annual_rate: float, lumps: dict[int, float] | None = None
) -> float:
    """FV with end-of-month contributions; lumps {month: amount} compound from their month."""
    r = monthly(annual_rate)
    if abs(r) < _EPS:
        fv = pv + pmt * n_months
    else:
        g = (1.0 + r) ** n_months
        fv = pv * g + pmt * (g - 1.0) / r
    for m, amt in (lumps or {}).items():
        if 0 < m <= n_months:
            fv += amt * (1.0 + r) ** (n_months - m)
    return fv


def months_to_goal(goal_amount: float, pv: float, pmt: float, annual_rate: float) -> float | None:
    """Fractional months to reach goal; 0 if already there; None if never."""
    if pv >= goal_amount:
        return 0.0
    r = monthly(annual_rate)
    if abs(r) < _EPS:
        return (goal_amount - pv) / pmt if pmt > 0 else None
    num, den = goal_amount * r + pmt, pv * r + pmt
    if abs(den) < _EPS or num / den <= 0:
        return None
    n = math.log(num / den) / math.log(1.0 + r)  # valid for r < 0 too (both logs negative)
    return n if n > 0 else None


def inflate_target(g0: float, inflation: float, n_months: int) -> float:
    return g0 * (1.0 + inflation) ** (n_months / 12.0)


def fx_adjusted_target(g_foreign: float, fx_spot: float, fx_drift: float, n_months: int) -> float:
    """Foreign-currency goal converted to VND at the drifted future spot."""
    return g_foreign * fx_spot * (1.0 + fx_drift) ** (n_months / 12.0)


def plan_trajectory(
    pv: float, pmt: float, n_months: int, annual_rate: float, lumps: dict[int, float] | None = None
) -> np.ndarray:
    r = monthly(annual_rate)
    out = np.empty(max(n_months, 0) + 1)
    out[0] = pv
    lumps = lumps or {}
    for t in range(1, n_months + 1):
        out[t] = out[t - 1] * (1.0 + r) + pmt + lumps.get(t, 0.0)
    return out
