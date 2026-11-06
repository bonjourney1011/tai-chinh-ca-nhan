import pytest

from taichinh.engine.lots import drift_after_lots, money_to_lots

PRICES = {"A": 25_000.0, "B": 90_000.0, "C": 0.0}
LOTS = {"A": 100, "B": 100}


def test_lots_conserve_cash_and_multiples():
    amt = 50_000_000.0
    r = money_to_lots(amt, PRICES, {"A": 0.5, "B": 0.3, "C": 0.2}, LOTS)
    assert sum(r.cost.values()) + r.leftover_cash == pytest.approx(amt)
    assert all(u % 100 == 0 for u in r.units.values())
    assert "C" not in r.units and r.leftover_cash >= 0
    assert sum(r.realised_weights.values()) == pytest.approx(1)


def test_lots_too_small_budget():
    r = money_to_lots(1_000.0, PRICES, {"A": 1.0}, LOTS)
    assert r.units["A"] == 0 and r.leftover_cash == 1_000.0


def test_drift():
    d = drift_after_lots({"A": 0.5, "B": 0.5}, {"A": 0.55, "B": 0.45})
    assert d["A"] == pytest.approx(0.05) and d["B"] == pytest.approx(-0.05)
