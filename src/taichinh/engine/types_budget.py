"""Budget / tracking dataclasses (split from types.py; re-exported there)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Literal

Verdict = Literal["on_track", "stretch", "income_first", "build_emergency", "infeasible"]


@dataclass(frozen=True)
class Debt:
    name: str
    balance: float
    rate_pa: float
    min_payment: float


@dataclass(frozen=True)
class BudgetInputs:
    income_monthly: float
    essential_expenses: float
    variable_expenses: float
    liquid_assets: float
    debts: list[Debt] = field(default_factory=list)
    annual_bonus: float = 0.0


@dataclass(frozen=True)
class BudgetMetrics:
    savings_rate: float
    disposable: float
    feasibility: float
    essential_ratio: float
    emergency_months: float
    debt_service_ratio: float


@dataclass(frozen=True)
class Lever:
    kind: str
    param: float
    months_saved: float
    pmt_delta: float
    new_pmt: float
    description_vi: str


@dataclass(frozen=True)
class DebtPlan:
    strategy: str
    order: list[str]
    payoff_months: int
    total_interest: float


@dataclass(frozen=True)
class BudgetDiagnosis:
    metrics: BudgetMetrics
    verdict: Verdict
    levers: list[Lever]
    debt_avalanche: DebtPlan | None
    debt_snowball: DebtPlan | None
    explanations: list[str]


@dataclass(frozen=True)
class Trade:
    asset: str
    units: float
    side: Literal["buy", "sell"]
    amount: float


@dataclass(frozen=True)
class TrackingStatus:
    as_of: date
    months_elapsed: int
    plan_value: float
    band_p25: float
    band_p75: float
    actual_value: float
    gap: float
    on_track: bool
    contributed_to_date: float
    planned_to_date: float
    pmt_required_now: float
    drift: dict[str, float]
    rebalance: list[Trade]
