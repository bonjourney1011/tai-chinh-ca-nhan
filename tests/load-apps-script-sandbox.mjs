// Loads the real pure .gs files into one Node sandbox, like Apps Script's shared global scope.
// sheet-repository / handlers / menu / setup use Google services and are not loaded here.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Same time zone as appsscript.json, so calendar-day maths matches Apps Script.
process.env.TZ = 'Asia/Ho_Chi_Minh';

const PURE_FILES = [
  'formatting-and-date-helpers.gs',
  'domain-constants.gs',
  'goal-math.gs',
  'portfolio-valuation.gs',
  'action-planner-common.gs',
  'goal-planners.gs',
  'budget-planners.gs',
  'contribution-and-holding-planners.gs',
  'market-and-config-planners.gs',
  'budget-metrics-engine.gs',
  'dashboard-goal-views.gs',
  'dashboard-alert-rules.gs',
  'dashboard-payload-builder.gs'
];

export function loadGs() {
  const gs = vm.createContext({});
  for (const file of PURE_FILES) {
    vm.runInContext(readFileSync(new URL(`../apps-script/${file}`, import.meta.url), 'utf8'), gs, { filename: file });
  }
  return gs;
}

export const day = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const NOW = new Date(2026, 10, 6, 9, 0);
export const TODAY = day('2026-11-06');

/** Objects built inside the vm have another Object.prototype: compare through JSON. */
export const plain = (value) => JSON.parse(JSON.stringify(value));

export function freshState(gs, overrides = {}) {
  return {
    config: gs.resolveConfig({}), configRows: [], goals: [], budget: [], contributions: [], holdings: [],
    manualPrices: [], snapshots: [], assets: [], prices: [], planRows: [], tracking: [], seq: { goal: 0, budget: 0 },
    ...overrides
  };
}

const SEQ_KIND = { GOAL_SEQ: 'goal', BUDGET_SEQ: 'budget' };

/** Applies a plan to in-memory state the way sheet-repository applies it to the Sheet. */
export function applyPlan(gs, state, plan) {
  for (const tab of gs.WRITE_ORDER) {
    for (const row of plan.appends[tab] || []) state[gs.STATE_KEYS[tab]].push({ ...row });
  }
  for (const tab of gs.WRITE_ORDER) {
    for (const update of plan.updates[tab] || []) {
      const rows = state[gs.STATE_KEYS[tab]];
      const keyOf = (r) => gs.TAB_KEYS[tab].map((f) => String(r[f]).toUpperCase()).join('|');
      const target = rows.find((r) => keyOf(r) === String(update.key).toUpperCase());
      if (!target) throw new Error(`no row ${update.key} in ${tab}`);
      Object.assign(target, update.changes);
    }
  }
  for (const [prop, value] of Object.entries(plan.seq || {})) state.seq[SEQ_KIND[prop]] = value;
}

/** Plans one action and, when it succeeds, applies it. Returns the planAction result. */
export function run(gs, state, action, data, { now = NOW, requestId = '' } = {}) {
  const result = gs.planAction(action, data, gs.buildPlanContext(state, now, requestId));
  if (result.ok) applyPlan(gs, state, result.plan);
  return result;
}

/** Walks a value and reports the first Date (or non-finite number) found. */
export function findNonJson(value, path = '$') {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? null : path;
  if (typeof value !== 'object') return null;
  if (typeof value.getTime === 'function') return path;
  for (const [key, child] of Object.entries(value)) {
    const found = findNonJson(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

export const ASSETS = [
  { asset_id: 'TK12', ten: 'Tiền gửi 12 tháng', nhom: 'tien_gui', tien_te: 'VND', loai_gia: 'lai_suat', nhap_tay: true, mo_ta: '' },
  { asset_id: 'QTP', ten: 'Quỹ trái phiếu', nhom: 'trai_phieu', tien_te: 'VND', loai_gia: 'gia', nhap_tay: true, mo_ta: '' },
  { asset_id: 'E1VFVN30', ten: 'ETF VN30', nhom: 'co_phieu', tien_te: 'VND', loai_gia: 'gia', nhap_tay: false, mo_ta: '' },
  { asset_id: 'SJC', ten: 'Vàng SJC', nhom: 'vang', tien_te: 'VND', loai_gia: 'gia', nhap_tay: false, mo_ta: '' },
  { asset_id: 'USDVND', ten: 'Tỷ giá USD/VND', nhom: 'usd', tien_te: 'VND', loai_gia: 'gia', nhap_tay: false, mo_ta: '' },
  { asset_id: 'USDCASH', ten: 'Tiền USD', nhom: 'usd', tien_te: 'USD', loai_gia: 'gia', nhap_tay: true, mo_ta: '' }
];

export function priceRow(asset_id, gia, ngay_gia = '2026-11-05', extra = {}) {
  const asset = ASSETS.find((a) => a.asset_id === asset_id);
  return { asset_id, ten: asset.ten, nhom: asset.nhom, tien_te: asset.tien_te, gia, lai_suat_nam: '', ngay_gia, nguon: 'test', cap_nhat_luc: '', ...extra };
}

export const PRICES = [
  priceRow('TK12', '', '2026-11-05', { lai_suat_nam: 0.055 }),
  priceRow('QTP', 12000),
  priceRow('E1VFVN30', 35000),
  priceRow('SJC', 150000000),
  priceRow('USDVND', 26000),
  priceRow('USDCASH', 1)
];

/** State with the Python tabs filled and one active goal G001 (2.000.000.000 VND in 10 years). */
export function stateWithMarket(gs, overrides = {}) {
  return freshState(gs, {
    assets: ASSETS.map((a) => ({ ...a })), prices: PRICES.map((p) => ({ ...p })),
    goals: [{
      goal_id: 'G001', ten: 'Mua nhà', so_tien_dich: 2000000000, tien_te: 'VND', ngay_dich: day('2036-11-06'), tien_co_san: 100000000,
      ho_so_rui_ro: 'can_bang', uu_tien: 'cao', phuong_an_chon: '', trang_thai: 'dang', ghi_chu: '', tao_luc: NOW, cap_nhat_luc: NOW
    }],
    ...overrides
  });
}
