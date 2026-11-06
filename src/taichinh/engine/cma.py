"""Capital-market assumptions: load from yaml, blend with history, overrides, profiles."""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

from taichinh.engine.types import AssetAssumption, CapitalMarketAssumptions, RiskProfile
from taichinh.settings import CONFIG_DIR, load_yaml

STOCK_STOCK_CORR = 0.5  # prior correlation between two user stocks (not listed in cma.yml)


def _read(path: Path | str | None) -> dict:
    p = Path(path) if path else CONFIG_DIR / "cma.yml"
    with p.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _pair_corr(prior: dict, a: str, b: str) -> float:
    if a == b:
        return 1.0
    if a == "stock_default" and b == "stock_default":
        return STOCK_STOCK_CORR
    return float(prior.get(a, {}).get(b, prior.get(b, {}).get(a, 0.0)))


def _psd_corr(corr: np.ndarray) -> np.ndarray:
    from taichinh.engine.covariance import nearest_psd

    m = np.asarray(nearest_psd(corr), float)
    d = np.sqrt(np.diag(m).clip(1e-12))
    m = m / np.outer(d, d)
    np.fill_diagonal(m, 1.0)
    return (m + m.T) / 2


def load_cma(
    path: Path | str | None = None,
    scenario: str = "base",
    asset_ids: list[str] | None = None,
    stock_ids: list[str] | None = None,
) -> CapitalMarketAssumptions:
    raw = _read(path)
    fields = set(AssetAssumption.__dataclass_fields__) - {"id", "history_months"}
    base = {k: v for k, v in raw["assets"].items()}
    default = base.pop("stock_default")

    def make(aid: str, spec: dict) -> AssetAssumption:
        return AssetAssumption(id=aid, **{k: v for k, v in spec.items() if k in fields})

    assets = {k: make(k, v) for k, v in base.items()}
    ids = [a for a in (asset_ids if asset_ids is not None else list(base)) if a in assets]
    source = {a: a for a in ids}
    for t in stock_ids or []:
        assets[t] = make(t, default)
        ids.append(t)
        source[t] = "stock_default"
    prior = raw.get("prior_correlation", {})
    n = len(ids)
    corr = np.eye(n)
    for i in range(n):
        for j in range(i + 1, n):
            corr[i, j] = corr[j, i] = _pair_corr(prior, source[ids[i]], source[ids[j]])
    return CapitalMarketAssumptions(
        assets={a: assets[a] for a in ids},
        asset_ids=ids,
        corr=_psd_corr(corr),
        inflation=float(raw["inflation"][scenario]),
        rf=float(raw["risk_free"]),
        scenario=scenario,
    )


def blend_with_history(
    prior: CapitalMarketAssumptions,
    monthly_returns: pd.DataFrame,
    full_window: int = 120,
    min_window: int = 24,
) -> CapitalMarketAssumptions:
    """Blend prior sigma/corr with history; mu stays at the prior.

    Each asset's sigma comes from its own non-NaN window and each correlation from the pairwise
    overlap of the two series (never a joint dropna), so a short-lived asset cannot shrink the
    sample of the others. Weight on history = clip((n - min_window) / (full - min_window), 0, 1)
    with n = own window (sigma) or pairwise overlap (corr). The blended matrix is PSD-repaired.
    """
    ids = prior.asset_ids
    hist = monthly_returns.tail(full_window)
    counts = {a: int(hist[a].notna().sum()) if a in hist.columns else 0 for a in ids}
    assets = {a: replace(prior.assets[a], history_months=counts[a]) for a in ids}
    use = [a for a in ids if counts[a] > min_window]
    if not use:
        return replace(prior, assets=assets)
    span = max(full_window - min_window, 1)

    def weight(n: int) -> float:
        return float(np.clip((n - min_window) / span, 0.0, 1.0))

    for a in use:
        s_h = float(hist[a].dropna().std(ddof=1)) * np.sqrt(12.0)
        lam = weight(counts[a])
        assets[a] = replace(assets[a], sigma=float(lam * s_h + (1 - lam) * prior.assets[a].sigma))
    corr = prior.corr.copy()
    for i, a in enumerate(ids):
        for j in range(i + 1, len(ids)):
            b = ids[j]
            if a not in use or b not in use:
                continue
            pair = hist[[a, b]].dropna()
            if len(pair) <= min_window:
                continue
            c_h = float(np.nan_to_num(pair[a].corr(pair[b])))
            lp = weight(len(pair))
            corr[i, j] = corr[j, i] = lp * c_h + (1 - lp) * prior.corr[i, j]
    return replace(prior, assets=assets, corr=_psd_corr(corr))


def apply_overrides(cma: CapitalMarketAssumptions, mu_overrides: dict) -> CapitalMarketAssumptions:
    """Override the active-scenario mu for the given asset ids."""
    key = {"low": "mu_low", "base": "mu_base", "high": "mu_high"}[cma.scenario]
    assets = dict(cma.assets)
    for a, v in mu_overrides.items():
        if a in assets:
            assets[a] = replace(assets[a], **{key: float(v)})
    return replace(cma, assets=assets)


def real_rate(nominal: float, inflation: float) -> float:
    return (1.0 + nominal) / (1.0 + inflation) - 1.0


def load_profiles() -> dict[str, RiskProfile]:
    out = {}
    for k, v in load_yaml("profiles.yml")["profiles"].items():
        out[k] = RiskProfile(
            name=k,
            max_equity=v["max_equity"],
            max_drawdown=v["max_drawdown"],
            var_limit=v["var_limit"],
            risk_aversion=v["risk_aversion"],
            capacity_cap_no_emergency=v.get("capacity_cap_no_emergency", 0.3),
        )
    return out


def load_thresholds() -> dict:
    return dict(load_yaml("profiles.yml")["budget_thresholds"])


def load_horizon_table() -> list[list[float]]:
    return [list(row) for row in load_yaml("profiles.yml")["horizon_caps"]]
