/**
 * Shared vocabulary: tab names, column headers, enums, limits and Config defaults.
 * MIRRORS src/taichinh/sheets/tabs.py (tests/sheet-contract.test.mjs compares the two).
 * Columns are matched BY POSITION on both sides: add new headers only at the END of a list.
 * Rows are plain objects keyed by these header names.
 */
var T = {
  config: 'Config', goals: 'Goals', budget: 'Budget', contributions: 'Contributions', holdings: 'Holdings',
  manualPrices: 'Manual_Prices', snapshot: 'Snapshot',
  assets: 'Assets', pricesLatest: 'Prices_Latest', plan: 'Plan', tracking: 'Tracking', runLog: 'Run_Log'
};

var HEADERS = {
  Config: ['key', 'value', 'ghi_chu'],
  Goals: ['goal_id', 'ten', 'so_tien_dich', 'tien_te', 'ngay_dich', 'tien_co_san', 'ho_so_rui_ro', 'uu_tien',
    'phuong_an_chon', 'trang_thai', 'ghi_chu', 'tao_luc', 'cap_nhat_luc'],
  Budget: ['budget_id', 'loai', 'ten', 'so_tien', 'chu_ky', 'lai_suat_nam', 'tra_toi_thieu', 'trang_thai', 'ghi_chu',
    'cap_nhat_luc'],
  Contributions: ['thoi_gian', 'ngay', 'loai', 'goal_id', 'asset_id', 'so_tien_vnd', 'so_luong', 'gia_don_vi',
    'ghi_chu', 'request_id'],
  Holdings: ['asset_id', 'goal_id', 'so_luong', 'gia_von_vnd', 'cap_nhat_luc'],
  Manual_Prices: ['thoi_gian', 'ngay', 'asset_id', 'gia', 'lai_suat_nam', 'ghi_chu'],
  Snapshot: ['ngay', 'tong', 'tien_gui', 'trai_phieu', 'co_phieu', 'vang', 'usd', 'khac', 'no'],
  Assets: ['asset_id', 'ten', 'nhom', 'tien_te', 'loai_gia', 'nhap_tay', 'mo_ta'],
  Prices_Latest: ['asset_id', 'ten', 'nhom', 'tien_te', 'gia', 'lai_suat_nam', 'ngay_gia', 'nguon', 'cap_nhat_luc'],
  Plan: ['goal_id', 'phuong_an', 'gui_hang_thang', 'gui_de_dat_80', 'xac_suat_dat', 'ket_qua_thap', 'ket_qua_co_so',
    'ket_qua_cao', 'phan_bo_json', 'ly_do', 'run_at'],
  Tracking: ['goal_id', 'ngay', 'gia_tri_hien_tai', 'gia_tri_ky_vong', 'on_track', 'lech_thang', 'lech_phan_bo_json',
    'gui_thang_nay_de_xuat', 'run_at'],
  Run_Log: ['run_at', 'trigger', 'status', 'sources_ok', 'sources_failed', 'rows_pushed', 'commit_sha', 'message']
};

var APPS_SCRIPT_TABS = [T.config, T.goals, T.budget, T.contributions, T.holdings, T.manualPrices, T.snapshot];
var PYTHON_TABS = [T.assets, T.pricesLatest, T.plan, T.tracking, T.runLog];
// Written to the Sheet in this order: the ledger first, so a failure later never loses money records.
var WRITE_ORDER = [T.contributions, T.manualPrices, T.goals, T.budget, T.holdings, T.config];
var TAB_KEYS = { Config: ['key'], Goals: ['goal_id'], Budget: ['budget_id'], Holdings: ['asset_id', 'goal_id'] };
var STATE_KEYS = {
  Config: 'configRows', Goals: 'goals', Budget: 'budget', Contributions: 'contributions', Holdings: 'holdings',
  Manual_Prices: 'manualPrices', Snapshot: 'snapshots', Assets: 'assets', Prices_Latest: 'prices',
  Plan: 'planRows', Tracking: 'tracking'
};
// Kept as text so Sheets never turns "1/2" into a date, "86%" into a number or drops a leading 0.
var TEXT_FIELDS = {
  Config: ['key', 'value', 'ghi_chu'],
  Goals: ['goal_id', 'ten', 'tien_te', 'ho_so_rui_ro', 'uu_tien', 'phuong_an_chon', 'trang_thai', 'ghi_chu'],
  Budget: ['budget_id', 'loai', 'ten', 'chu_ky', 'trang_thai', 'ghi_chu'],
  Contributions: ['loai', 'goal_id', 'asset_id', 'ghi_chu', 'request_id'],
  Holdings: ['asset_id', 'goal_id'],
  Manual_Prices: ['asset_id', 'ghi_chu'],
  Assets: ['asset_id', 'ten', 'nhom', 'tien_te', 'loai_gia', 'mo_ta'],
  Prices_Latest: ['asset_id', 'ten', 'nhom', 'tien_te', 'nguon'],
  Plan: ['goal_id', 'phuong_an', 'phan_bo_json', 'ly_do'],
  Tracking: ['goal_id', 'lech_phan_bo_json'],
  Run_Log: ['trigger', 'status', 'sources_ok', 'sources_failed', 'commit_sha', 'message']
};

var RISK_PROFILES = ['bao_thu', 'can_bang', 'tang_truong'];
var PLAN_OPTIONS = ['chi_gui', 'can_bang', 'tang_truong'];
var GOAL_STATUS = ['dang', 'da_dat', 'huy'];
var SCENARIOS = ['low', 'base', 'high'];
var PRIORITIES = ['cao', 'vua', 'thap'];
var CURRENCIES = ['VND', 'USD'];
var BUDGET_TYPES = ['thu_nhap', 'chi_co_dinh', 'chi_bien_doi', 'dau_tu_thu_nhap', 'no'];
var BUDGET_CYCLES = ['thang', 'nam'];
var BUDGET_STATUS = ['dang', 'xoa'];
var CONTRIBUTION_TYPES = ['gui', 'rut'];
var ASSET_GROUPS = ['tien_gui', 'trai_phieu', 'co_phieu', 'vang', 'usd', 'khac'];
var LIQUID_GROUPS = ['tien_gui', 'trai_phieu'];

var LIMITS = {
  goalVnd: 50000000000, goalUsd: 2000000, goalYears: 40, goalMonths: 480, maxGoals: 40, maxBudgetRows: 200,
  budgetMonthly: 5000000000, budgetDebt: 50000000000, priceJump: 0.3, manualRateMax: 30
};

var SEQUENCES = { goal: { prop: 'GOAL_SEQ', prefix: 'G' }, budget: { prop: 'BUDGET_SEQ', prefix: 'B' } };

var CONFIG_DEFAULTS = {
  cpi_pct: 0.045,
  ho_so_mac_dinh: 'can_bang',
  quy_khan_cap_thang_min: 3,
  lech_phan_bo_pp: 5,
  du_lieu_cu_ngay: 35,
  ky_vong_loi_nhuan_bao_thu: 0.055,
  ky_vong_loi_nhuan_can_bang: 0.08,
  ky_vong_loi_nhuan_tang_truong: 0.11,
  ty_gia_usd_du_phong: 25000,
  gui_toi_da_1_lan: 5000000000,
  kich_ban: 'base',
  tai_san_nuoc_ngoai: 0,
  site_url: '',
  sheet_url: ''
};
// Editable from the web page; site_url and sheet_url are changed in the Sheet only.
var CONFIG_EDITABLE_KEYS = Object.keys(CONFIG_DEFAULTS).filter(function (key) {
  return key !== 'site_url' && key !== 'sheet_url';
});
var CONFIG_RULES = {
  cpi_pct: { min: 0, max: 0.3 }, quy_khan_cap_thang_min: { min: 0, max: 36 }, lech_phan_bo_pp: { min: 1, max: 50 },
  du_lieu_cu_ngay: { min: 1, max: 365 }, ky_vong_loi_nhuan_bao_thu: { min: 0, max: 0.3 },
  ky_vong_loi_nhuan_can_bang: { min: 0, max: 0.3 }, ky_vong_loi_nhuan_tang_truong: { min: 0, max: 0.3 },
  ty_gia_usd_du_phong: { min: 1000, max: 100000 }, gui_toi_da_1_lan: { min: 1000000, max: 100000000000 },
  tai_san_nuoc_ngoai: { min: 0, max: 1 }
};

/** "0,045" and "4,5%" both read as 0.045. */
function parseConfigNumber(value) {
  var text = String(value == null ? '' : value).trim().replace(',', '.');
  var number = /%$/.test(text) ? Number(text.slice(0, -1)) / 100 : Number(text);
  return text === '' || isNaN(number) ? NaN : number;
}

/** Config tab values over defaults; a bad value falls back to the default instead of breaking the page. */
function resolveConfig(raw) {
  var config = {};
  Object.keys(CONFIG_DEFAULTS).forEach(function (key) {
    var fallback = CONFIG_DEFAULTS[key];
    var value = raw && raw[key] !== undefined && raw[key] !== '' ? raw[key] : fallback;
    if (typeof fallback === 'number') {
      var number = parseConfigNumber(value);
      config[key] = isNaN(number) ? fallback : number;
    } else {
      config[key] = String(value).trim();
    }
  });
  if (RISK_PROFILES.indexOf(config.ho_so_mac_dinh) === -1) config.ho_so_mac_dinh = CONFIG_DEFAULTS.ho_so_mac_dinh;
  if (SCENARIOS.indexOf(config.kich_ban) === -1) config.kich_ban = CONFIG_DEFAULTS.kich_ban;
  return config;
}

function configRowsToRaw(rows) {
  var raw = {};
  (rows || []).forEach(function (row) {
    var key = String(row.key == null ? '' : row.key).trim();
    if (key) raw[key] = row.value;
  });
  return raw;
}

/** Next free id such as G001: the stored counter never repeats, hand-typed ids in the Sheet are skipped. */
function nextSeqId(kind, current, usedIds) {
  var used = {};
  (usedIds || []).forEach(function (id) { used[id] = true; });
  var next = (Number(current) || 0) + 1;
  while (used[SEQUENCES[kind].prefix + pad(next, 3)]) next += 1;
  return { id: SEQUENCES[kind].prefix + pad(next, 3), seq: next };
}

function expectedReturn(config, profile) {
  return Number(config['ky_vong_loi_nhuan_' + profile]) || config.ky_vong_loi_nhuan_can_bang;
}
