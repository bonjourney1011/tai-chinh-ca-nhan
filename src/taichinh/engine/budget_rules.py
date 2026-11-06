"""Budget metrics, verdict tree, improvement levers and debt payoff plans."""

from __future__ import annotations

import math
from dataclasses import replace

from taichinh.engine.goal_math import months_to_goal, required_pmt
from taichinh.engine.types import (
    BudgetDiagnosis,
    BudgetInputs,
    BudgetMetrics,
    Debt,
    DebtPlan,
    Lever,
    Verdict,
)

NEVER_MONTHS = 1200.0  # stand-in for "never reached" when comparing levers
DEBT_CAP_MONTHS = 600


def _trieu(x: float) -> str:
    return f"{x / 1e6:,.1f}".replace(".0", "") + " triệu"


def budget_metrics(b: BudgetInputs, pmt_required: float) -> BudgetMetrics:
    expenses = b.essential_expenses + b.variable_expenses + b.income_investment
    income = max(b.income_monthly, 1.0)
    debt_min = sum(d.min_payment for d in b.debts)
    disposable = b.income_monthly - expenses - debt_min  # same definition as the Apps Script side
    ess = b.essential_expenses
    return BudgetMetrics(
        savings_rate=disposable / income,
        disposable=disposable,
        feasibility=pmt_required / max(disposable, 1.0),
        essential_ratio=ess / income,
        emergency_months=b.liquid_assets / ess if ess > 0 else 99.0,
        debt_service_ratio=sum(d.min_payment for d in b.debts) / income,
    )


def verdict(m: BudgetMetrics, months_to_deadline: float, thresholds: dict) -> Verdict:
    """Order matters. Feasibility above the income_first cut with a healthy savings rate means
    the goal (not the household budget) is the problem -> infeasible; a weak savings rate or
    heavy essential spending -> income_first."""
    if m.essential_ratio > thresholds.get("essential_ratio_max", 0.75):
        return "income_first"
    if m.savings_rate < thresholds.get("min_savings_rate", 0.10):
        return "income_first"
    if m.emergency_months < thresholds.get("emergency_months_min", 3) and months_to_deadline > 12:
        return "build_emergency"
    if m.feasibility <= thresholds.get("on_track_feasibility", 0.25):
        return "on_track"
    if m.feasibility <= thresholds.get("income_first_feasibility", 0.5):
        return "stretch"
    return "infeasible"


def rank_levers(
    goal_amount: float, pv: float, annual_rate: float, b: BudgetInputs, pmt_afford: float
) -> list[Lever]:
    """Score each lever by months saved versus saving pmt_afford today. Extending the horizon
    saves no months (-k) but lowers the required PMT. Extra income is assumed fully saved."""
    base = months_to_goal(goal_amount, pv, pmt_afford, annual_rate)
    base_m = NEVER_MONTHS if base is None else base

    def saved(g: float, pmt: float) -> float:
        m = months_to_goal(g, pv, pmt, annual_rate)
        return base_m - (NEVER_MONTHS if m is None else m)

    out: list[Lever] = []

    def add(kind, param, g, extra, text):
        new = pmt_afford + extra
        out.append(Lever(kind, param, saved(g, new), extra, new, text))

    for p in (0.1, 0.2, 0.3):
        extra = p * b.variable_expenses
        add("cut_variable", p, goal_amount, extra,
            f"Cắt {int(p * 100)}% chi tiêu linh hoạt, tiết kiệm thêm {_trieu(extra)} mỗi tháng.")
    n0 = int(math.ceil(base_m)) if base is not None else 120
    old = required_pmt(goal_amount, pv, n0, annual_rate)
    for k in (6, 12, 24):
        new = required_pmt(goal_amount, pv, n0 + k, annual_rate)
        out.append(Lever("extend_horizon", k, -float(k), new - old, new,
                         f"Lùi hạn thêm {k} tháng, số tiền cần gửi còn {_trieu(new)} mỗi tháng."))
    for p in (0.1, 0.2):
        g = goal_amount * (1 - p)
        out.append(Lever("lower_target", p, saved(g, pmt_afford), 0.0, pmt_afford,
                         f"Giảm mục tiêu {int(p * 100)}% còn {_trieu(g)}."))
    for t in (1, 2, 5):
        add("raise_income", t, goal_amount, t * 1e6,
            f"Tăng thu nhập thêm {t} triệu mỗi tháng và gửi hết phần tăng.")
    if b.annual_bonus > 0:
        extra = b.annual_bonus / 12
        add("annual_bonus", b.annual_bonus, goal_amount, extra,
            f"Gửi thưởng năm {_trieu(b.annual_bonus)}, tương đương {_trieu(extra)} mỗi tháng.")
    return sorted(out, key=lambda lv: lv.months_saved, reverse=True)


def _simulate(debts: list[Debt], extra: float, strategy: str) -> DebtPlan:
    """Monthly amortisation (loan APR convention: rate_pa/12, not the geometric 12th root used
    for investment returns); freed minimums roll into the target debt."""
    bal = {d.name: d.balance for d in debts}
    rate = {d.name: d.rate_pa / 12.0 for d in debts}
    budget = sum(d.min_payment for d in debts) + extra
    key = (lambda n: -rate[n]) if strategy == "avalanche" else (lambda n: bal[n])
    order: list[str] = []
    interest = 0.0
    months = 0
    while any(v > 0.005 for v in bal.values()) and months < DEBT_CAP_MONTHS:
        months += 1
        for n in bal:
            if bal[n] > 0:
                i = bal[n] * rate[n]
                bal[n] += i
                interest += i
        pool = budget
        for d in debts:  # minimums first
            pay = min(d.min_payment, bal[d.name], pool)
            bal[d.name] -= pay
            pool -= pay
        for n in sorted((n for n in bal if bal[n] > 0.005), key=key):
            pay = min(bal[n], pool)
            bal[n] -= pay
            pool -= pay
        for n in bal:
            if bal[n] <= 0.005 and n not in order:
                bal[n] = 0.0
                order.append(n)
    return DebtPlan(strategy, order, months, interest)


def debt_plans(debts: list[Debt], extra_monthly: float) -> tuple[DebtPlan, DebtPlan]:
    extra = max(extra_monthly, 0.0)
    return _simulate(debts, extra, "avalanche"), _simulate(debts, extra, "snowball")


def diagnose(
    b: BudgetInputs,
    pmt_required: float,
    goal_amount: float,
    pv: float,
    annual_rate: float,
    months_to_deadline: float,
    thresholds: dict,
) -> BudgetDiagnosis:
    """`thresholds` comes from cma.load_thresholds() (config is read at the call site)."""
    from taichinh.engine.explain import explain_verdict

    m = budget_metrics(b, pmt_required)
    v = verdict(m, months_to_deadline, thresholds)
    levers = rank_levers(goal_amount, pv, annual_rate, b, max(m.disposable, 0.0))
    ava = sno = None
    if b.debts:
        ava, sno = debt_plans(b.debts, max(m.disposable - pmt_required, 0.0))
    diag = BudgetDiagnosis(m, v, levers, ava, sno, [])
    return replace(diag, explanations=explain_verdict(diag))
