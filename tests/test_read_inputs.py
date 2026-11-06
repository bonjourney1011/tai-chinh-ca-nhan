from pathlib import Path

import pytest

from taichinh.sheets import tabs
from taichinh.sheets.read_inputs import (
    budget_inputs,
    build_inputs,
    load_inputs_json,
    parse_goal,
    parse_number,
    parse_rate,
)

FIX = Path(__file__).parent / "fixtures" / "sheet-inputs-sample.json"


@pytest.mark.parametrize("raw,want", [
    ("1.000.000", 1e6), ("1,000,000", 1e6), ("5,4%", 0.054), ("0,054", 0.054),
    ("1,234.5", 1234.5), ("1.234,5", 1234.5), ("12.500", 12500.0), ("0.5", 0.5),
    ("", 0.0), ("abc", 0.0), (" 300 000 ", 300000.0), (7, 7.0), ("2,5", 2.5),
])
def test_parse_number(raw, want):
    assert parse_number(raw) == pytest.approx(want)


@pytest.mark.parametrize("raw,want", [("5,4%", 0.054), ("0,054", 0.054), ("5,4", 0.054), ("", 0.0)])
def test_parse_rate(raw, want):
    assert parse_rate(raw) == pytest.approx(want)


def test_goal_enums_and_currency():
    g = parse_goal({"goal_id": "A", "ten": "x", "so_tien_dich": "1.000.000", "tien_te": "usd",
                    "ngay_dich": "31/12/2030", "tien_co_san": "", "uu_tien": "thap"})
    assert (g.currency, g.priority, g.deadline.year, g.current_pv) == ("USD", 3, 2030, 0.0)
    assert parse_goal({"goal_id": "B", "uu_tien": "cao"}).priority == 1
    assert parse_goal({"goal_id": "C", "uu_tien": ""}).priority == 2


def test_fixture_loads_and_budget_mapping():
    inp = load_inputs_json(FIX)
    assert len(inp.goals) == 2 and inp.goals[1].currency == "USD"
    b = budget_inputs(inp.budget_rows, liquid=5e6)
    assert b.income_monthly == 30e6 and b.annual_bonus == 60e6
    assert (b.essential_expenses, b.variable_expenses) == (8e6, 7e6)
    assert b.debts[0].rate_pa == pytest.approx(0.18) and b.debts[0].min_payment == 1e6
    assert inp.manual_prices["lai_suat_nam"].dropna().iloc[-1] == pytest.approx(0.054)


def test_missing_optional_tabs():
    inp = build_inputs({tabs.GOALS: [{"goal_id": "A", "so_tien_dich": "5"}]})
    assert inp.holdings.empty and inp.manual_prices.empty and inp.budget_rows == []
    assert list(inp.holdings.columns) == list(tabs.HEADERS[tabs.HOLDINGS])
