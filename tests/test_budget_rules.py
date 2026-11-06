import pytest

from taichinh.engine import budget_rules as br
from taichinh.engine.cma import load_thresholds
from taichinh.engine.types import BudgetInputs, BudgetMetrics, Debt

TH = load_thresholds()


def make_metrics(**kw):
    base = {"savings_rate": 0.3, "disposable": 3e6, "feasibility": 0.2, "essential_ratio": 0.4,
            "emergency_months": 6, "debt_service_ratio": 0.0}
    base.update(kw)
    return BudgetMetrics(**base)


def test_metrics():
    b = BudgetInputs(20e6, 8e6, 4e6, 16e6, debts=[Debt("a", 1e6, 0.1, 1e6)])
    m = br.budget_metrics(b, 4e6)
    assert m.disposable == 8e6 and m.savings_rate == pytest.approx(0.4)
    assert m.feasibility == 0.5 and m.essential_ratio == 0.4
    assert m.emergency_months == 2 and m.debt_service_ratio == pytest.approx(0.05)


@pytest.mark.parametrize("kw,months,expected", [
    ({"essential_ratio": 0.8}, 24, "income_first"),
    ({"savings_rate": 0.05}, 24, "income_first"),
    ({"emergency_months": 1}, 24, "build_emergency"),
    ({"emergency_months": 1}, 6, "on_track"),
    ({"feasibility": 0.25}, 24, "on_track"),
    ({"feasibility": 0.4}, 24, "stretch"),
    ({"feasibility": 0.9}, 24, "infeasible"),
])
def test_verdict(kw, months, expected):
    assert br.verdict(make_metrics(**kw), months, TH) == expected


def test_levers_sorted_and_vietnamese():
    b = BudgetInputs(20e6, 8e6, 6e6, 30e6, annual_bonus=24e6)
    lv = br.rank_levers(500e6, 20e6, 0.07, b, 4e6)
    saved = [x.months_saved for x in lv]
    assert saved == sorted(saved, reverse=True)
    kinds = {x.kind for x in lv}
    want = {"cut_variable", "extend_horizon", "lower_target", "raise_income", "annual_bonus"}
    assert want <= kinds
    assert all(x.description_vi for x in lv) and lv[0].months_saved > 0


def test_debt_avalanche_not_worse():
    debts = [Debt("the", 20e6, 0.30, 1e6), Debt("xe", 50e6, 0.08, 1.5e6),
             Debt("nho", 5e6, 0.12, 0.5e6)]
    ava, sno = br.debt_plans(debts, 2e6)
    assert ava.total_interest <= sno.total_interest + 1e-6
    assert set(ava.order) == {"the", "xe", "nho"}
    assert ava.payoff_months <= sno.payoff_months + 1
    assert ava.payoff_months < br.DEBT_CAP_MONTHS


def test_diagnose():
    b = BudgetInputs(20e6, 8e6, 4e6, 40e6)
    d = br.diagnose(b, 2e6, 200e6, 10e6, 0.07, 36, TH)
    assert d.verdict == "on_track" and d.debt_avalanche is None and d.explanations
