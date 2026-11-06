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
    """Blend prior sigma/corr with history (Ledoit-Wolf); mu stays at the prior."""
    from taichinh.engine.covariance import ledoit_wolf_cov

    ids = prior.asset_ids
    hist = monthly_returns.tail(full_window)
    counts = {a: int(hist[a].notna().sum()) if a in hist.columns else 0 for a in ids}
    use = [a for a in ids if counts[a] > min_window]
    assets = {a: replace(prior.assets[a], history_months=counts[a]) for a in ids}
    if len(use) < 1:
        return replace(prior, assets=assets)
    sub = hist[use].dropna()
    if len(sub) < 3:
        return replace(prior, assets=assets)
    cov_m, _ = ledoit_wolf_cov(sub.to_numpy())
    cov_a = np.asarray(cov_m, float) * 12.0
    s_h = np.sqrt(np.diag(cov_a))
    c_h = cov_a / np.outer(s_h, s_h)
    span = max(full_window - min_window, 1)
    lam = {a: float(np.clip((counts[a] - min_window) / span, 0.0, 1.0)) for a in ids}
    corr = prior.corr.copy()
    pos = {a: i for i, a in enumerate(use)}
    for i, a in enumerate(ids):
        for j, b in enumerate(ids):
            if i != j and a in pos and b in pos:
                lp = float(np.clip((min(counts[a], counts[b]) - min_window) / span, 0.0, 1.0))
                corr[i, j] = lp * c_h[pos[a], pos[b]] + (1 - lp) * prior.corr[i, j]
    for a in use:
        sig = lam[a] * s_h[pos[a]] + (1 - lam[a]) * prior.assets[a].sigma
        assets[a] = replace(assets[a], sigma=float(sig))
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
