import json
from datetime import date
from pathlib import Path

import pytest

from taichinh.pipeline import compute
from taichinh.sheets import tabs
from taichinh.sheets.read_inputs import load_inputs_json

FIX = Path(__file__).parent / "fixtures" / "sheet-inputs-sample.json"


@pytest.fixture(scope="module")
def result():
    return compute(load_inputs_json(FIX), date(2026, 11, 6), seed=1, run_at="2026-11-06T00:00:00Z")


def test_row_counts_and_widths(result):
    assert len(result.plan_rows) == 6 and len(result.tracking_rows) == 2
    assert {r[1] for r in result.plan_rows} == set(tabs.PLAN_OPTIONS)
    assert all(len(r) == len(tabs.HEADERS[tabs.PLAN]) for r in result.plan_rows)
    assert all(len(r) == len(tabs.HEADERS[tabs.TRACKING]) for r in result.tracking_rows)
    assert all(len(r) == len(tabs.HEADERS[tabs.PRICES_LATEST]) for r in result.prices_rows)
    assert "USDVND" in {r[0] for r in result.prices_rows}


def test_chi_gui_uses_only_safe_sleeve(result):
    for r in result.plan_rows:
        ids = {x["asset_id"] for x in json.loads(r[8])}
        if r[1] == "chi_gui":
            assert ids <= {"TK12", "QTP"}
    g2 = {r[1]: json.loads(r[8]) for r in result.plan_rows if r[0] == "G2"}
    assert any(x["asset_id"] in ("VOO", "BTC") or x["asset_id"] == "E1VFVN30"
               for x in g2["tang_truong"])


def test_tracking_values(result):
    t = {r[0]: r for r in result.tracking_rows}
    # G1: 15,000,000 deposit + 500 * latest E1VFVN30 price
    assert t["G1"][2] > 15_000_000
    assert t["G1"][1] == "2026-11-06" and isinstance(t["G1"][4], bool)
    assert t["G2"][2] > 0  # QTP manual price 12,500 x 1000 = 12.5m
    assert t["G2"][2] == 12_500_000
