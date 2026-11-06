import json
from datetime import date

import pandas as pd

from taichinh.report.market_rows import assets_rows, price_records, prices_rows
from taichinh.sheets import tabs
from taichinh.universe import catalog


def test_assets_and_prices_rows_match_headers():
    cat = catalog()
    manual = pd.DataFrame([
        {"ngay": "2026-11-01", "asset_id": "TK12", "gia": float("nan"), "lai_suat_nam": 0.054},
        {"ngay": "2026-11-01", "asset_id": "QTP", "gia": 12500.0, "lai_suat_nam": float("nan")},
    ])
    a = assets_rows(cat)
    assert all(len(r) == len(tabs.HEADERS[tabs.ASSETS]) for r in a)
    recs = price_records(cat, manual)
    p = prices_rows(cat, recs, "2026-11-06T00:00:00Z")
    assert all(len(r) == len(tabs.HEADERS[tabs.PRICES_LATEST]) for r in p)
    by = {r[0]: r for r in p}
    assert by["TK12"][5] == 0.054 and by["TK12"][4] == "" and by["TK12"][7] == "manual"
    assert by["QTP"][4] == 12500.0
    assert "USDVND" in by and len(by["USDVND"][6]) == 10


def test_plan_and_tracking_row_shapes():
    from taichinh.engine.cma import load_cma, load_profiles
    from taichinh.engine.planner import plan_goal
    from taichinh.engine.types import Goal
    from taichinh.report.plan_rows import plan_row
    from taichinh.report.tracking_rows import tracking_row

    cma = load_cma(asset_ids=["deposit_12m", "bond_fund"])
    g = Goal(id="G", name="g", target_amount=1e8, horizon_months=24)
    plan = plan_goal(g, load_profiles()["bao_thu"], cma, n_paths=500, today=date(2026, 11, 6))
    row = plan_row("G", "chi_gui", plan, {"deposit_12m": "TK12", "bond_fund": "QTP"}, "t")
    assert len(row) == len(tabs.HEADERS[tabs.PLAN])
    alloc = json.loads(row[8])
    assert {x["asset_id"] for x in alloc} <= {"TK12", "QTP"}
    assert abs(sum(x["pct"] for x in alloc) - 1) < 0.005 and alloc[0]["ly_do"]
    t = tracking_row("G", date(2026, 11, 6), 5e6, {"TK12": 5e6}, plan, 0.0, 3, {"TK12": 1.0}, "t")
    assert len(t) == len(tabs.HEADERS[tabs.TRACKING])
