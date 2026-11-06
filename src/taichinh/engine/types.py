"""Shared dataclasses for the analytics engine. Rates are ANNUAL decimals at every boundary."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Literal

import numpy as np

Sleeve = Literal["risky", "safe"]
CapStatus = Literal["within-cap", "capped", "infeasible", "all-below-risk-free"]


@dataclass(frozen=True)
class PriceSeries:
    symbol: str
    dates: list[str]
    closes: np.ndarray


@dataclass(frozen=True)
class AlignedPrices:
    symbols: list[str]
    dates: list[str]
    closes: np.ndarray  # shape [asset, day]


@dataclass(frozen=True)
class MarketInputs:
    mu: np.ndarray
    cov: np.ndarray
    rf: float


@dataclass(frozen=True)
class PortfolioStats:
    weights: np.ndarray
    risk_free_weight: float
    expected_return: float
    volatility: float
    sharpe: float


@dataclass(frozen=True)
class PerformanceSummary:
    annual_return: float
    volatility: float
    sharpe: float
    max_drawdown: float
    total_return: float


@dataclass(frozen=True)
class Goal:
    id: str
    name: str
    target_amount: float
    currency: Literal["VND", "USD"] = "VND"
    deadline: date | None = None
    horizon_months: int | None = None
    current_pv: float = 0.0
    inflation_adjust: bool = True
    annual_lumps: dict[int, float] = field(default_factory=dict)
    priority: int = 1
    fx_drift: float = 0.0


@dataclass(frozen=True)
class RiskProfile:
    name: str
    max_equity: float
    max_drawdown: float
    var_limit: float
    risk_aversion: float
    capacity_cap_no_emergency: float = 0.3
    pick: str = "p_success"  # p_success (lowest risk that reaches the goal) | max_return


@dataclass(frozen=True)
class AssetAssumption:
    id: str
    sleeve: Sleeve
    mu_low: float
    mu_base: float
    mu_high: float
    sigma: float
    max_drawdown: float
    min_weight: float
    max_weight: float
    currency: str = "VND"
    liquidity_days: int = 0
    fx_drift: float = 0.0
    history_months: int = 0


@dataclass(frozen=True)
class CapitalMarketAssumptions:
    assets: dict[str, AssetAssumption]
    asset_ids: list[str]
    corr: np.ndarray
    inflation: float
    rf: float
    scenario: str = "base"

    def mu(self) -> np.ndarray:
        key = {"low": "mu_low", "base": "mu_base", "high": "mu_high"}[self.scenario]
        return np.array([getattr(self.assets[a], key) for a in self.asset_ids])

    def sigma(self) -> np.ndarray:
        return np.array([self.assets[a].sigma for a in self.asset_ids])

    def cov(self) -> np.ndarray:
        s = self.sigma()
        return self.corr * np.outer(s, s)


@dataclass(frozen=True)
class EquityCaps:
    horizon: float
    drawdown: float
    var: float
    tolerance: float
    capacity: float
    w_eq: float
    binding: str


@dataclass(frozen=True)
class Mix:
    name: str
    method: str
    weights: dict[str, float]
    mu: float
    sigma: float
    est_max_drawdown: float
    w_eq: float


@dataclass(frozen=True)
class MonteCarloResult:
    p_success: float
    median_fv: float
    bands: dict[int, np.ndarray]
    expected_shortfall: float
    n_paths: int
    seed: int
    method: str


@dataclass(frozen=True)
class MixEvaluation:
    mix: Mix
    pmt_required: float
    mc: MonteCarloResult


@dataclass(frozen=True)
class AllocationResult:
    caps: EquityCaps
    candidates: list[MixEvaluation]
    recommended: MixEvaluation


@dataclass(frozen=True)
class LotAllocation:
    units: dict[str, float]
    cost: dict[str, float]
    leftover_cash: float
    realised_weights: dict[str, float]


@dataclass(frozen=True)
class GoalPlan:
    goal: Goal
    target_nominal: float
    horizon_months: int
    allocation: AllocationResult
    pmt_required: float
    pmt_for_80: float
    p_success: float
    bands: dict[int, np.ndarray]
    trajectory: np.ndarray
    mix: Mix
    lots: LotAllocation | None
    explanations: list[str]
    warnings: list[str]

from taichinh.engine.types_budget import (  # noqa: E402,F401 - re-exported
    BudgetDiagnosis,
    BudgetInputs,
    BudgetMetrics,
    Debt,
    DebtPlan,
    Lever,
    TrackingStatus,
    Trade,
    Verdict,
)
