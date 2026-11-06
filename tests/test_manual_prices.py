import pandas as pd

from taichinh.store.loaders import load_csv
from taichinh.store.manual_prices import manual_to_csv
from taichinh.store.schemas import BOND_YIELDS_MONTHLY, DEPOSIT_RATES_MONTHLY, FUND_NAV_MONTHLY
from taichinh.universe import catalog

NAN = float("nan")
DF = pd.DataFrame([
    {"ngay": "2026-10-03", "asset_id": "TK12", "gia": NAN, "lai_suat_nam": 0.052},
    {"ngay": "2026-10-20", "asset_id": "TK12", "gia": NAN, "lai_suat_nam": 0.054},
    {"ngay": "2026-10-20", "asset_id": "QTP", "gia": 12500.0, "lai_suat_nam": NAN},
    {"ngay": "2026-10-20", "asset_id": "BOND10Y", "gia": NAN, "lai_suat_nam": 0.043},
    {"ngay": "2026-10-20", "asset_id": "VOO", "gia": 500.0, "lai_suat_nam": NAN},
])


def test_manual_upsert_idempotent(tmp_path):
    first = manual_to_csv(DF, catalog(), tmp_path)
    assert first == {"deposit_rates_monthly.csv": 1, "fund_nav_monthly.csv": 1,
                     "bond_yields_monthly.csv": 1}
    assert manual_to_csv(DF, catalog(), tmp_path) == {
        "deposit_rates_monthly.csv": 0, "fund_nav_monthly.csv": 0, "bond_yields_monthly.csv": 0}
    dep = load_csv(DEPOSIT_RATES_MONTHLY, tmp_path)
    assert dep.iloc[0]["rate_pa"] == 0.054 and dep.iloc[0]["bank"] == "MANUAL"  # newest wins
    assert dep.iloc[0]["source"] == "manual" and dep.iloc[0]["term_months"] == "12"
    assert load_csv(FUND_NAV_MONTHLY, tmp_path).iloc[0]["fund_code"] == "QTP"
    assert load_csv(BOND_YIELDS_MONTHLY, tmp_path).iloc[0]["tenor_years"] == "10"
