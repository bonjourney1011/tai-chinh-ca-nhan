import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, day, freshState, run, stateWithMarket, plain, findNonJson, TODAY, NOW } from './load-apps-script-sandbox.mjs';

const gs = loadGs();

function fullState() {
  const s = stateWithMarket(gs);
  s.planRows.push(
    { goal_id: 'G001', phuong_an: 'chi_gui', gui_hang_thang: 16000000, gui_de_dat_80: 17000000, xac_suat_dat: 0.5, ket_qua_thap: 1.5e9, ket_qua_co_so: 2e9, ket_qua_cao: 2.6e9, phan_bo_json: '[{"asset_id":"TK12","pct":1}]', ly_do: 'chỉ gửi', run_at: '2026-11-06T01:00:00Z' },
    { goal_id: 'G001', phuong_an: 'can_bang', gui_hang_thang: 10000000, gui_de_dat_80: 12000000, xac_suat_dat: 0.8, ket_qua_thap: 1.7e9, ket_qua_co_so: 2.1e9, ket_qua_cao: 2.8e9, phan_bo_json: '[{"asset_id":"E1VFVN30","pct":0.5,"ten":"ETF VN30","ly_do":"tăng trưởng"},{"asset_id":"TK12","pct":0.5}]', ly_do: 'cân bằng', run_at: '2026-11-06T01:00:00Z' }
  );
  s.goals[0].phuong_an_chon = 'can_bang';
  s.tracking.push({ goal_id: 'G001', ngay: '2026-11-05', gia_tri_hien_tai: 130000000, gia_tri_ky_vong: 140000000, on_track: 'FALSE', lech_thang: 3, lech_phan_bo_json: '[]', gui_thang_nay_de_xuat: 11000000, run_at: '' });
  s.holdings = [
    { asset_id: 'E1VFVN30', goal_id: 'G001', so_luong: 1000, gia_von_vnd: 30000000, cap_nhat_luc: NOW },
    { asset_id: 'TK12', goal_id: 'G001', so_luong: 20000000, gia_von_vnd: 20000000, cap_nhat_luc: NOW }
  ];
  s.contributions = [
    { thoi_gian: new Date(2026, 9, 2, 8, 30), ngay: day('2026-10-02'), loai: 'gui', goal_id: 'G001', asset_id: 'E1VFVN30', so_tien_vnd: 3500000, so_luong: 100, gia_don_vi: 35000, ghi_chu: '', request_id: 'r0' },
    { thoi_gian: new Date(2026, 10, 2, 8, 30), ngay: day('2026-11-02'), loai: 'gui', goal_id: 'G001', asset_id: 'TK12', so_tien_vnd: 5000000, so_luong: 5000000, gia_don_vi: 1, ghi_chu: '', request_id: 'r1' }
  ];
  s.snapshots = [
    { ngay: day('2026-10-31'), tong: 60000000, tien_gui: 20000000, trai_phieu: 0, co_phieu: 40000000, vang: 0, usd: 0, khac: 0, no: 0 },
    { ngay: day('2026-11-06'), tong: 1, tien_gui: 1, trai_phieu: 0, co_phieu: 0, vang: 0, usd: 0, khac: 0, no: 0 }
  ];
  return s;
}

test('empty Sheet and empty Python tabs still give a valid payload', () => {
  const dash = plain(gs.buildDashboardPayload(freshState(gs), TODAY));
  assert.equal(dash.ok, true);
  assert.equal(dash.today, '2026-11-06');
  assert.equal(dash.summary.tong_tai_san, 0);
  assert.equal(dash.summary.doi_dau_thang, null);
  assert.deepEqual(dash.goals, []);
  assert.deepEqual(dash.data_as_of, { prices: '', plan: '', tracking: '', stale_days: null });
  assert.equal(dash.summary.theo_nhom.tien_gui, 0);
  assert.equal(dash.settings.ty_gia_usd, 25000);
  for (const key of ['alerts', 'goals', 'holdings', 'recent', 'budget', 'market', 'trend', 'lists', 'settings', 'summary']) assert.ok(key in dash, key);
});

test('payload is JSON-safe: no Date objects, no NaN/Infinity, survives a round trip', () => {
  const dash = gs.buildDashboardPayload(fullState(), TODAY);
  assert.equal(findNonJson(dash), null);
  assert.deepEqual(plain(plain(dash)), plain(dash));
  assert.equal(typeof dash.goals[0].ngay_dich, 'string');
  assert.match(dash.recent[0].thoi_gian, /^2026-11-02 08:30$/);
});

test('goal view: progress in goal currency, tracking fields, plans, drift and this-month deposits', () => {
  const dash = plain(gs.buildDashboardPayload(fullState(), TODAY));
  const g = dash.goals[0];
  assert.equal(g.goal_id, 'G001');
  assert.equal(g.ngay_dich, '2036-11-06');
  assert.equal(g.con_thang, 120);
  assert.equal(g.gia_tri_hien_tai, 100000000 + 35000000 + 20000000);
  assert.equal(g.tien_do_pct, 7.8);
  assert.equal(g.on_track, false);
  assert.equal(g.lech_thang, 3);
  assert.deepEqual(g.gui_thang_nay, { de_xuat: 11000000, da_gui: 5000000 });
  assert.deepEqual(g.plans.map((p) => p.phuong_an), ['chi_gui', 'can_bang']);
  assert.deepEqual(g.plans[1].ket_qua, { thap: 1.7e9, co_so: 2.1e9, cao: 2.8e9 });
  assert.deepEqual(g.plans[1].phan_bo[0], { asset_id: 'E1VFVN30', ten: 'ETF VN30', pct: 50, ly_do: 'tăng trưởng' });
  const etf = g.lech_phan_bo.find((d) => d.asset_id === 'E1VFVN30');
  assert.equal(etf.muc_tieu_pct, 50);
  assert.equal(etf.hien_tai_pct, 63.6);
  assert.ok(g.uoc_tinh_nhanh > 0);
  assert.equal(dash.summary.da_gui_thang_nay, 5000000);
  assert.equal(dash.summary.can_gui_thang_nay, 11000000);
});

test('USD goal: value and target stay in USD, deposits convert at the USD/VND rate', () => {
  const s = stateWithMarket(gs);
  s.goals[0] = { ...s.goals[0], tien_te: 'USD', so_tien_dich: 100000, tien_co_san: 1000 };
  s.holdings = [{ asset_id: 'TK12', goal_id: 'G001', so_luong: 26000000, gia_von_vnd: 26000000 }];
  const g = plain(gs.buildDashboardPayload(s, TODAY).goals[0]);
  assert.equal(g.tien_te, 'USD');
  assert.equal(g.gia_tri_hien_tai, 2000);
  assert.equal(g.tien_do_pct, 2);
});

test('summary: totals by group, month-start change from the last month-end snapshot, trend replaces today', () => {
  const dash = plain(gs.buildDashboardPayload(fullState(), TODAY));
  assert.equal(dash.summary.tong_tai_san, 35000000 + 20000000);
  assert.equal(dash.summary.theo_nhom.co_phieu, 35000000);
  assert.equal(dash.summary.theo_nhom.tien_gui, 20000000);
  assert.equal(dash.summary.doi_dau_thang, 55000000 - 60000000);
  assert.deepEqual(dash.trend.map((t) => t.ngay), ['2026-10-31', '2026-11-06']);
  assert.equal(dash.trend[1].tong, 55000000);
  assert.deepEqual(dash.data_as_of, { prices: '2026-11-05', plan: '2026-11-06', tracking: '2026-11-05', stale_days: 1 });
});

test('market list carries price age, source and the manual-entry flag', () => {
  const s = stateWithMarket(gs);
  s.manualPrices.push({ ngay: day('2026-11-06'), asset_id: 'QTP', gia: 12400, lai_suat_nam: '' });
  const market = plain(gs.buildDashboardPayload(s, TODAY).market);
  const qtp = market.find((m) => m.asset_id === 'QTP');
  assert.equal(qtp.gia, 12400);
  assert.equal(qtp.nhap_tay, true);
  assert.equal(qtp.cu, false);
  assert.equal(market.find((m) => m.asset_id === 'TK12').lai_suat_nam, 5.5);
  assert.equal(market.find((m) => m.asset_id === 'E1VFVN30').nhap_tay, false);
});

function bigState(reason, assetCount) {
  const s = stateWithMarket(gs);
  const ids = ['TK12', 'QTP', 'E1VFVN30', 'SJC', 'USDCASH', 'USDVND'].slice(0, assetCount);
  const alloc = JSON.stringify(ids.map((id) => ({ asset_id: id, pct: 1 / assetCount, ten: s.assets.find((a) => a.asset_id === id).ten, ly_do: reason })));
  s.goals = [];
  for (let i = 1; i <= 20; i++) {
    const goal_id = 'G' + String(i).padStart(3, '0');
    s.goals.push({ goal_id, ten: 'Mục tiêu số ' + i, so_tien_dich: 1e9, tien_te: 'VND', ngay_dich: day('2036-11-06'), tien_co_san: 1e7, ho_so_rui_ro: 'can_bang', uu_tien: 'vua', phuong_an_chon: 'can_bang', trang_thai: 'dang', ghi_chu: '' });
    for (const phuong_an of ['chi_gui', 'can_bang', 'tang_truong']) {
      s.planRows.push({ goal_id, phuong_an, gui_hang_thang: 5e6, gui_de_dat_80: 6e6, xac_suat_dat: 0.7, ket_qua_thap: 1e9, ket_qua_co_so: 1.2e9, ket_qua_cao: 1.5e9, phan_bo_json: alloc, ly_do: 'Giải thích phương án cho người dùng đọc, khoảng hai câu dài vừa phải.' });
    }
    s.holdings.push({ asset_id: 'TK12', goal_id, so_luong: 1e6, gia_von_vnd: 1e6 });
    s.tracking.push({ goal_id, ngay: '2026-11-05', on_track: true, lech_thang: 0, gui_thang_nay_de_xuat: 5e6 });
  }
  for (let i = 0; i < 150; i++) s.snapshots.push({ ngay: new Date(2026, 5, 1 + i), tong: 1e8 + i, tien_gui: 1e7, trai_phieu: 1e7, co_phieu: 1e7, vang: 1e7, usd: 1e7, khac: 1e7, no: 0 });
  for (let i = 0; i < 60; i++) s.contributions.push({ thoi_gian: NOW, ngay: day('2026-11-01'), loai: 'gui', goal_id: 'G001', asset_id: 'TK12', so_tien_vnd: 1e6, so_luong: 1e6, gia_don_vi: 1, ghi_chu: 'ghi chú' });
  return s;
}

const sizeOf = (dash) => Buffer.byteLength(JSON.stringify(dash), 'utf8');

test('size: 20 goals x 3 plans x 4 assets + 120 snapshots + 30 contributions stays under 100 KB, nothing trimmed', () => {
  const dash = gs.buildDashboardPayload(bigState('Lý do ngắn gọn cho từng tài sản', 4), TODAY);
  assert.ok(sizeOf(dash) < 100 * 1024, `payload is ${sizeOf(dash)} bytes`);
  assert.equal(dash.trend.length, 120);
  assert.equal(dash.recent.length, 30);
  assert.equal(dash.goals.length, 20);
  assert.equal(dash.goals[0].plans[0].phan_bo[0].ly_do, 'Lý do ngắn gọn cho từng tài sản');
});

test('size: an oversized account is trimmed (reasons, then trend) to stay under 100 KB', () => {
  const dash = gs.buildDashboardPayload(bigState('Lý do phân bổ rất dài để thử kích thước payload thật khi có quá nhiều dữ liệu', 6), TODAY);
  assert.ok(sizeOf(dash) < 100 * 1024, `payload is ${sizeOf(dash)} bytes`);
  assert.equal(dash.goals.length, 20);
  assert.equal(dash.goals[0].plans[0].phan_bo[0].ly_do, '');
  assert.equal(dash.goals[0].plans.length, 3);
});

test('history: newest first, goal filter, paging, limit cap', () => {
  const s = stateWithMarket(gs);
  for (let i = 1; i <= 7; i++) {
    s.contributions.push({ thoi_gian: NOW, ngay: day('2026-11-0' + i), loai: 'gui', goal_id: i % 2 ? 'G001' : 'G002', asset_id: 'TK12', so_tien_vnd: i * 1000000, so_luong: i, gia_don_vi: 1, ghi_chu: '', request_id: 'r' + i });
  }
  const all = plain(gs.buildHistory(s, {}));
  assert.equal(all.total, 7);
  assert.equal(all.rows[0].so_tien_vnd, 7000000);
  assert.equal(all.rows[0].ten_tai_san, 'Tiền gửi 12 tháng');
  assert.equal(all.rows[0].ten_muc_tieu, 'Mua nhà');
  assert.equal(all.rows[0].request_id, undefined);
  const g1 = plain(gs.buildHistory(s, { goal_id: 'g001', offset: 1, limit: 2 }));
  assert.equal(g1.total, 4);
  assert.deepEqual(g1.rows.map((r) => r.so_tien_vnd), [5000000, 3000000]);
  assert.equal(gs.buildHistory(s, { limit: 99999 }).rows.length, 7);
  assert.equal(findNonJson(gs.buildHistory(s, {})), null);
});

test('hand-edited Sheet rows (text numbers, odd flags, blank dates) do not crash the payload', () => {
  const s = fullState();
  s.holdings.push({ asset_id: 'GHOST', goal_id: 'G001', so_luong: '5', gia_von_vnd: '1000', cap_nhat_luc: '' });
  s.goals.push({ goal_id: 'G009', ten: 'Thiếu ngày', so_tien_dich: '1000000', tien_te: 'VND', ngay_dich: '', tien_co_san: '', ho_so_rui_ro: 'can_bang', uu_tien: '', phuong_an_chon: '', trang_thai: 'dang' });
  s.tracking.push({ goal_id: 'G009', ngay: '', on_track: 'maybe', lech_thang: '' });
  s.planRows.push({ goal_id: 'G009', phuong_an: 'can_bang', phan_bo_json: '{broken' });
  const dash = gs.buildDashboardPayload(s, TODAY);
  assert.equal(findNonJson(dash), null);
  assert.equal(dash.goals.find((g) => g.goal_id === 'G009').ngay_dich, '');
  assert.equal(dash.goals.find((g) => g.goal_id === 'G009').on_track, null);
});

test('units: rates leave as percent, Tracking lech_pct (0-1) becomes muc_tieu/hien_tai on 0-100, settings has decimal return', () => {
  const s = fullState();
  s.tracking[0].lech_phan_bo_json = '[{"asset_id":"E1VFVN30","lech_pct":0.1},{"asset_id":"TK12","lech_pct":-0.1}]';
  const dash = plain(gs.buildDashboardPayload(s, TODAY));
  assert.deepEqual(dash.goals[0].lech_phan_bo, [
    { asset_id: 'E1VFVN30', muc_tieu_pct: 50, hien_tai_pct: 60 }, { asset_id: 'TK12', muc_tieu_pct: 50, hien_tai_pct: 40 }
  ]);
  assert.equal(dash.settings.ky_vong_loi_nhuan, 0.08);
  assert.equal(dash.goals[0].plans[1].xac_suat_dat, 0.8);
  assert.equal(dash.goals[0].ghi_chu, '');
  assert.equal(dash.market.find((m) => m.asset_id === 'TK12').lai_suat_nam, 5.5);
});

test('new Config keys: kich_ban enum and tai_san_nuoc_ngoai 0/1 are editable', () => {
  const s = freshState(gs);
  assert.equal(run(gs, s, 'config_save', { values: { kich_ban: 'high', tai_san_nuoc_ngoai: 1 } }).ok, true);
  assert.match(run(gs, s, 'config_save', { values: { kich_ban: 'x' } }).error, /kịch bản/);
  assert.match(run(gs, s, 'config_save', { values: { tai_san_nuoc_ngoai: 2 } }).error, /phải từ|0 hoặc 1/);
  assert.equal(gs.resolveConfig(gs.configRowsToRaw(s.configRows)).kich_ban, 'high');
});
