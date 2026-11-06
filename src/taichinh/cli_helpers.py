"""Shared helpers for the Sheet-facing CLI commands (inputs, manual prices, compute, push)."""

from __future__ import annotations

from datetime import date


def _load_inputs(inputs_json: str | None):
    from taichinh.settings import load_settings
    from taichinh.sheets.client import open_sheet
    from taichinh.sheets.read_inputs import load_inputs_json, read_inputs

    if inputs_json:
        return load_inputs_json(inputs_json), None
    sh = open_sheet(load_settings())
    return read_inputs(sh), sh


def _pull_manual(inputs) -> dict[str, int]:
    from taichinh.store.manual_prices import manual_to_csv
    from taichinh.universe import catalog

    return manual_to_csv(inputs.manual_prices, catalog())


def _compute(inputs):
    from taichinh.pipeline import compute

    return compute(inputs, date.today(), seed=0)


def _push(sh, res, trigger: str, sources_ok: str, sources_failed: str, status: str, msg: str):
    import os
    from datetime import UTC, datetime

    from taichinh.sheets import tabs
    from taichinh.sheets.client import append_row, replace_tab

    n = 0
    for name, rows in ((tabs.ASSETS, res.assets_rows), (tabs.PRICES_LATEST, res.prices_rows),
                       (tabs.PLAN, res.plan_rows), (tabs.TRACKING, res.tracking_rows)):
        n += replace_tab(sh, name, rows)
    run_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    append_row(sh, tabs.RUN_LOG, [run_at, trigger, status, sources_ok, sources_failed, n,
                                  os.getenv("GITHUB_SHA", ""), msg])
    return n


def _trigger() -> str:
    import os

    return os.getenv("GITHUB_EVENT_NAME") or "local"
