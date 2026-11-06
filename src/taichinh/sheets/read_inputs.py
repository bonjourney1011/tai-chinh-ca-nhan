"""Parse Sheet input tabs (string cells, Vietnamese number formats) into engine inputs."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

import pandas as pd

from taichinh.engine.types import BudgetInputs, Debt, Goal
from taichinh.sheets import tabs
from taichinh.sheets.client import read_tab

PRIORITY = {"cao": 1, "vua": 2, "thap": 3}
LIQUID_GROUPS = ("tien_gui", "trai_phieu")


def parse_number(v, default: float = 0.0) -> float:
    """'1.000.000' -> 1e6, '5,4%' -> 0.054, '0,054' -> 0.054, '1,234.5' -> 1234.5, '' -> default."""
    if v is None:
        return default
    if isinstance(v, int | float):
        return float(v)
    s = str(v).strip().replace(" ", "").replace(" ", "")
    pct = s.endswith("%")
    s = re.sub(r"[^\d.,\-+]", "", s)
    if not re.search(r"\d", s):
        return default
    if "," in s and "." in s:
        dec = "," if s.rfind(",") > s.rfind(".") else "."
        s = s.replace("." if dec == "," else ",", "").replace(dec, ".")
    elif "," in s:
        tail = s.split(",")[-1]
        one = s.count(",") == 1 and len(tail) != 3
        s = s.replace(",", ".") if one or (s.count(",") == 1 and s.split(",")[0] in ("0", "-0")) \
            else s.replace(",", "")
    elif "." in s:
        head, tail = s.split(".", 1)[0], s.rsplit(".", 1)[1]
        if s.count(".") > 1 or (len(tail) == 3 and head.lstrip("+-") not in ("0", "")):
            s = s.replace(".", "")
    try:
        x = float(s)
    except ValueError:
        return default
    return x / 100.0 if pct else x


def parse_rate(v, default: float = 0.0) -> float:
    """Annual rate -> decimal. '5,4%' -> 0.054; '0,054' -> 0.054; bare '5,4' (>1) -> 0.054."""
    raw = str(v).strip() if v is not None else ""
    x = parse_number(v, default)
    if raw and not raw.endswith("%") and abs(x) > 1.0:
        x /= 100.0
    return x


def parse_date(v) -> date | None:
    s = str(v or "").strip()[:10]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


@dataclass
class SheetInputs:
    config: dict = field(default_factory=dict)
    goals: list[Goal] = field(default_factory=list)
    goals_raw: list[dict] = field(default_factory=list)
    budget_rows: list[dict] = field(default_factory=list)
    contributions: pd.DataFrame = field(default_factory=pd.DataFrame)
    holdings: pd.DataFrame = field(default_factory=pd.DataFrame)
    manual_prices: pd.DataFrame = field(default_factory=pd.DataFrame)


def parse_goal(r: dict) -> Goal:
    ccy = (r.get("tien_te") or "VND").strip().upper()
    return Goal(
        id=r["goal_id"].strip(), name=(r.get("ten") or "").strip() or r["goal_id"].strip(),
        target_amount=parse_number(r.get("so_tien_dich")),
        currency="USD" if ccy == "USD" else "VND", deadline=parse_date(r.get("ngay_dich")),
        current_pv=parse_number(r.get("tien_co_san")),
        priority=PRIORITY.get((r.get("uu_tien") or "").strip().lower(), 2),
    )


def _df(rows: list[dict], name: str, numeric: tuple[str, ...]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=list(tabs.HEADERS[name]))
    for c in numeric:
        df[c] = df[c].map(lambda x: parse_number(x, float("nan"))).astype(float)
    return df


def _manual_df(rows: list[dict]) -> pd.DataFrame:
    df = _df(rows, tabs.MANUAL_PRICES, ("gia",))
    df["lai_suat_nam"] = df["lai_suat_nam"].map(lambda x: parse_rate(x, float("nan"))).astype(float)
    return df


def build_inputs(tab_rows: dict[str, list[dict]]) -> SheetInputs:
    g = [r for r in tab_rows.get(tabs.GOALS, []) if (r.get("goal_id") or "").strip()]
    cfg = {r["key"].strip(): str(r.get("value", "")).strip()
           for r in tab_rows.get(tabs.CONFIG, []) if (r.get("key") or "").strip()}
    return SheetInputs(
        config=cfg,
        goals=[parse_goal(r) for r in g],
        goals_raw=g,
        budget_rows=tab_rows.get(tabs.BUDGET, []),
        contributions=_df(tab_rows.get(tabs.CONTRIBUTIONS, []), tabs.CONTRIBUTIONS,
                          ("so_tien_vnd", "so_luong", "gia_don_vi")),
        holdings=_df(tab_rows.get(tabs.HOLDINGS, []), tabs.HOLDINGS, ("so_luong", "gia_von_vnd")),
        manual_prices=_manual_df(tab_rows.get(tabs.MANUAL_PRICES, [])),
    )


def read_inputs(sh) -> SheetInputs:
    return build_inputs({t: read_tab(sh, t) for t in tabs.INPUT_TABS})


def load_inputs_json(path: str | Path) -> SheetInputs:
    """Fixture loader: JSON object {tab_name: [row dicts keyed by header]}."""
    return build_inputs(json.loads(Path(path).read_text(encoding="utf-8")))


def liquid_assets(
    holdings: pd.DataFrame, prices: dict[str, float], groups: dict[str, str]
) -> float:
    """VND value of holdings in tien_gui + trai_phieu. prices: asset_id -> VND per unit
    (deposits are priced 1.0 since so_luong is already VND)."""
    total = 0.0
    for _, h in holdings.iterrows():
        if groups.get(h["asset_id"]) in LIQUID_GROUPS and pd.notna(h["so_luong"]):
            total += float(h["so_luong"]) * prices.get(h["asset_id"], 0.0)
    return total


def budget_inputs(rows: list[dict], liquid: float) -> BudgetInputs:
    """Yearly income goes to annual_bonus (a yearly amount; the engine lever divides by 12)."""
    income = bonus = essential = variable = invest = 0.0
    debts: list[Debt] = []
    for r in rows:
        if (r.get("trang_thai") or "dang").strip().lower() not in ("dang", ""):
            continue
        amt = parse_number(r.get("so_tien"))
        yearly = (r.get("chu_ky") or "thang").strip().lower() == "nam"
        kind = (r.get("loai") or "").strip().lower()
        if kind == "thu_nhap":
            if yearly:
                bonus += amt
            else:
                income += amt
        elif kind == "chi_co_dinh":
            essential += amt / 12.0 if yearly else amt
        elif kind == "chi_bien_doi":
            variable += amt / 12.0 if yearly else amt
        elif kind == "dau_tu_thu_nhap":
            invest += amt / 12.0 if yearly else amt
        elif kind == "no":
            debts.append(Debt((r.get("ten") or "").strip(), amt, parse_rate(r.get("lai_suat_nam")),
                              parse_number(r.get("tra_toi_thieu"))))
    return BudgetInputs(income, essential, variable, liquid, debts, annual_bonus=bonus,
                        income_investment=invest)
