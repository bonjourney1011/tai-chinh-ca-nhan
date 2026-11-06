"""Orchestrator: SheetInputs -> Assets / Prices_Latest / Plan / Tracking rows (no I/O to Sheet)."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import UTC, date, datetime
from pathlib import Path

from taichinh.engine.budget_rules import budget_metrics
from taichinh.engine.cma import blend_with_history, load_cma, load_profiles
from taichinh.engine.planner import plan_goal
from taichinh.engine.types import BudgetMetrics, CapitalMarketAssumptions, Goal, GoalPlan
from taichinh.report.market_rows import assets_rows, price_records, prices_rows
from taichinh.report.plan_rows import plan_row
from taichinh.report.tracking_rows import holdings_value, months_between, tracking_row
from taichinh.sheets.read_inputs import SheetInputs, budget_inputs, liquid_assets, parse_date
from taichinh.sheets.tabs import PLAN_OPTIONS
from taichinh.universe import (
    CORE_CMA,
    FOREIGN_CMA,
    catalog,
    cma_to_asset,
    load_assets_cfg,
    monthly_returns_by_cma_key,
    user_stock_ids,
)

SAFE_SLEEVE = ("deposit_12m", "bond_fund")
OPTION_PROFILE = {"chi_gui": "bao_thu", "can_bang": "can_bang", "tang_truong": "tang_truong"}
TRUTHY = ("1", "true", "co", "có", "yes", "x")


@dataclass
class ComputeResult:
    plan_rows: list[list] = field(default_factory=list)
    tracking_rows: list[list] = field(default_factory=list)
    prices_rows: list[list] = field(default_factory=list)
    assets_rows: list[list] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _cma_for(keys: list[str], stocks: list[str], hist, scenario: str) -> CapitalMarketAssumptions:
    cma = load_cma(scenario=scenario, asset_ids=keys, stock_ids=stocks)
    return blend_with_history(cma, hist) if hist is not None and not hist.empty else cma


def _option_cma(option: str, goal: Goal, cfg: dict, stocks: list[str], hist, scenario: str):
    if option == "chi_gui":
        return _cma_for(list(SAFE_SLEEVE), [], hist, scenario)
    foreign = goal.currency == "USD" or cfg.get("tai_san_nuoc_ngoai", "").lower() in TRUTHY
    keys = list(CORE_CMA) + (list(FOREIGN_CMA) if foreign else [])
    return _cma_for(keys, stocks, hist, scenario)


def _plan_options(
    goal: Goal, cfg: dict, stocks: list[str], hist, bm_inputs, fx_spot, today: date, seed: int
) -> dict[str, GoalPlan]:
    scenario = cfg.get("kich_ban", "base") if cfg.get("kich_ban") in ("low", "base", "high") \
        else "base"
    profiles = load_profiles()
    cmas = {o: _option_cma(o, goal, cfg, stocks, hist, scenario) for o in PLAN_OPTIONS}
    kw = {"fx_spot": fx_spot, "seed": seed, "today": today}
    metrics: BudgetMetrics | None = None
    if bm_inputs is not None:  # pilot plan (few paths) gives pmt for the feasibility ratio
        pilot = plan_goal(goal, profiles["can_bang"], cmas["can_bang"], n_paths=2000, **kw)
        metrics = budget_metrics(bm_inputs, pilot.pmt_required)
    return {
        o: plan_goal(goal, profiles[OPTION_PROFILE[o]], cmas[o], budget_metrics=metrics, **kw)
        for o in PLAN_OPTIONS
    }


def compute(
    inputs: SheetInputs, today: date, seed: int = 0, data_dir: Path | None = None,
    run_at: str | None = None,
) -> ComputeResult:
    run_at = run_at or datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    res = ComputeResult()
    cfg_assets = load_assets_cfg()
    cat = catalog(cfg_assets)
    to_asset = cma_to_asset(cfg_assets)
    stocks = user_stock_ids(cfg_assets)
    recs = price_records(cat, inputs.manual_prices, data_dir)
    price_vnd = {a: r["gia_vnd"] for a, r in recs.items() if r["gia_vnd"] is not None}
    price_vnd |= {a["asset_id"]: 1.0 for a in cat if a.get("loai_gia") == "lai_suat"}
    groups = {a["asset_id"]: a.get("nhom", "khac") for a in cat}
    res.assets_rows = assets_rows(cat)
    res.prices_rows = prices_rows(cat, recs, run_at)
    fx_spot = price_vnd.get("USDVND")

    bi = None
    if inputs.budget_rows:
        bi = budget_inputs(inputs.budget_rows, liquid_assets(inputs.holdings, price_vnd, groups))
    hist = monthly_returns_by_cma_key(list(CORE_CMA) + list(FOREIGN_CMA) + stocks, cfg_assets)
    fx_days = hist.attrs.get("fx_history_days")
    if fx_days is not None and fx_days < 365:
        res.warnings.append(
            f"Lịch sử tỷ giá chỉ {fx_days} ngày: biến động của tài sản USD chưa gồm rủi ro tỷ giá"
        )

    for goal, raw in zip(inputs.goals, inputs.goals_raw, strict=True):
        if (raw.get("trang_thai") or "dang").strip().lower() != "dang":
            continue
        if goal.currency == "USD" and not fx_spot:
            res.warnings.append(f"{goal.id}: chưa có tỷ giá USD/VND nên bỏ qua mục tiêu này")
            continue
        if goal.deadline is None:
            res.warnings.append(f"{goal.id}: thiếu ngày đích nên bỏ qua mục tiêu này")
            continue
        actual, by_asset, missing = holdings_value(inputs.holdings, goal.id, price_vnd)
        # Plan from today: pv = money set aside at creation (goal currency) + holdings (VND).
        pv_vnd = goal.current_pv * (fx_spot if goal.currency == "USD" else 1.0) + actual
        plans = _plan_options(
            replace(goal, current_pv=pv_vnd), inputs.config, stocks, hist, bi, fx_spot, today, seed
        )
        for o, p in plans.items():
            res.plan_rows.append(plan_row(goal.id, o, p, to_asset, run_at))
            res.warnings += [f"{goal.id}/{o}: {w}" for w in p.warnings]
        chosen = raw.get("phuong_an_chon", "").strip()
        chosen = chosen if chosen in plans else "can_bang"
        plan = plans[chosen]
        if missing:
            res.warnings.append(f"{goal.id}: thiếu giá cho {', '.join(sorted(set(missing)))}")
        target = {to_asset.get(k, k): w for k, w in plan.mix.weights.items() if w > 0}
        elapsed = months_between(parse_date(raw.get("tao_luc")), today)
        res.tracking_rows.append(tracking_row(
            goal.id, today, actual, by_asset, plan, goal.current_pv, elapsed, target, run_at))
    return res
