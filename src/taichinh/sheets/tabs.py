"""Google Sheet tab names and header order. Mirror of apps-script/domain-constants.gs.

Columns are matched BY POSITION on both sides: only ever append new columns at the end.
"""

from __future__ import annotations

# --- tabs written by Apps Script (Python reads only) ---
CONFIG = "Config"
GOALS = "Goals"
BUDGET = "Budget"
CONTRIBUTIONS = "Contributions"
HOLDINGS = "Holdings"
MANUAL_PRICES = "Manual_Prices"
SNAPSHOT = "Snapshot"

# --- tabs written by Python (Apps Script reads only) ---
ASSETS = "Assets"
PRICES_LATEST = "Prices_Latest"
PLAN = "Plan"
TRACKING = "Tracking"
RUN_LOG = "Run_Log"

HEADERS: dict[str, tuple[str, ...]] = {
    CONFIG: ("key", "value", "ghi_chu"),
    GOALS: (
        "goal_id", "ten", "so_tien_dich", "tien_te", "ngay_dich", "tien_co_san",
        "ho_so_rui_ro", "uu_tien", "phuong_an_chon", "trang_thai", "ghi_chu",
        "tao_luc", "cap_nhat_luc",
    ),
    BUDGET: (
        "budget_id", "loai", "ten", "so_tien", "chu_ky", "lai_suat_nam",
        "tra_toi_thieu", "trang_thai", "ghi_chu", "cap_nhat_luc",
    ),
    CONTRIBUTIONS: (
        "thoi_gian", "ngay", "loai", "goal_id", "asset_id", "so_tien_vnd",
        "so_luong", "gia_don_vi", "ghi_chu", "request_id",
    ),
    HOLDINGS: ("asset_id", "goal_id", "so_luong", "gia_von_vnd", "cap_nhat_luc"),
    MANUAL_PRICES: ("thoi_gian", "ngay", "asset_id", "gia", "lai_suat_nam", "ghi_chu"),
    SNAPSHOT: ("ngay", "tong", "tien_gui", "trai_phieu", "co_phieu", "vang", "usd", "khac", "no"),
    ASSETS: ("asset_id", "ten", "nhom", "tien_te", "loai_gia", "nhap_tay", "mo_ta"),
    PRICES_LATEST: (
        "asset_id", "ten", "nhom", "tien_te", "gia", "lai_suat_nam", "ngay_gia",
        "nguon", "cap_nhat_luc",
    ),
    PLAN: (
        "goal_id", "phuong_an", "gui_hang_thang", "gui_de_dat_80", "xac_suat_dat",
        "ket_qua_thap", "ket_qua_co_so", "ket_qua_cao", "phan_bo_json", "ly_do", "run_at",
    ),
    TRACKING: (
        "goal_id", "ngay", "gia_tri_hien_tai", "gia_tri_ky_vong", "on_track", "lech_thang",
        "lech_phan_bo_json", "gui_thang_nay_de_xuat", "run_at",
    ),
    RUN_LOG: (
        "run_at", "trigger", "status", "sources_ok", "sources_failed", "rows_pushed",
        "commit_sha", "message",
    ),
}

INPUT_TABS = (CONFIG, GOALS, BUDGET, CONTRIBUTIONS, HOLDINGS, MANUAL_PRICES, SNAPSHOT)
RESULT_TABS = (ASSETS, PRICES_LATEST, PLAN, TRACKING, RUN_LOG)

RISK_PROFILES = ("bao_thu", "can_bang", "tang_truong")
PLAN_OPTIONS = ("chi_gui", "can_bang", "tang_truong")
GOAL_STATUS = ("dang", "da_dat", "huy")
BUDGET_TYPES = ("thu_nhap", "chi_co_dinh", "chi_bien_doi", "no")
