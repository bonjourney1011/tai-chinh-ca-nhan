import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, day, freshState, run, stateWithMarket, plain, TODAY } from './load-apps-script-sandbox.mjs';

const gs = loadGs();

test('price_manual_add: only assets with nhap_tay, known in Assets', () => {
  const s = stateWithMarket(gs);
  assert.match(run(gs, s, 'price_manual_add', { asset_id: 'E1VFVN30', gia: 36000 }).error, /giá tự động/);
  assert.match(run(gs, s, 'price_manual_add', { asset_id: 'NOPE', gia: 1 }).error, /Chưa có tài sản/);
  assert.equal(run(gs, s, 'price_manual_add', { asset_id: 'QTP', gia: 12300, ghi_chu: 'NAV cuối tuần' }).ok, true);
  assert.equal(s.manualPrices.length, 1);
  assert.equal(s.manualPrices[0].gia, 12300);
  assert.equal(s.manualPrices[0].lai_suat_nam, '');
});

test('price_manual_add rejects a price that jumps more than 30% from the last known', () => {
  const s = stateWithMarket(gs);
  assert.match(run(gs, s, 'price_manual_add', { asset_id: 'QTP', gia: 120000 }).error, /lệch quá 30%/);
  assert.match(run(gs, s, 'price_manual_add', { asset_id: 'QTP', gia: 8000 }).error, /lệch quá 30%/);
  assert.equal(run(gs, s, 'price_manual_add', { asset_id: 'QTP', gia: 15000 }).ok, true);
  assert.match(run(gs, s, 'price_manual_add', { asset_id: 'QTP', gia: 0 }).error, /Giá/);
});

test('price_manual_add for a deposit asset needs a 0-30% rate and stores a decimal', () => {
  const s = stateWithMarket(gs);
  assert.match(run(gs, s, 'price_manual_add', { asset_id: 'TK12' }).error, /Lãi suất/);
  assert.match(run(gs, s, 'price_manual_add', { asset_id: 'TK12', lai_suat_nam: 31 }).error, /Lãi suất/);
  run(gs, s, 'price_manual_add', { asset_id: 'TK12', lai_suat_nam: 5.8, ngay: '2026-11-04' });
  assert.equal(s.manualPrices[0].lai_suat_nam, 0.058);
  assert.equal(s.manualPrices[0].gia, '');
  assert.match(run(gs, s, 'price_manual_add', { asset_id: 'QTP', gia: 12100, ngay: '2026-12-01' }).error, /tương lai/);
});

test('price index: a newer manual price overrides Prices_Latest, an older one is ignored', () => {
  const s = stateWithMarket(gs);
  s.manualPrices.push({ ngay: day('2026-11-06'), asset_id: 'QTP', gia: 12500, lai_suat_nam: '' });
  s.manualPrices.push({ ngay: day('2026-10-01'), asset_id: 'SJC', gia: 1, lai_suat_nam: '' });
  const index = gs.buildPriceIndex(s.assets, s.prices, s.manualPrices, s.config, TODAY);
  assert.equal(index.byId.QTP.gia, 12500);
  assert.equal(index.byId.QTP.nguon, 'Nhập tay');
  assert.equal(index.byId.SJC.gia, 150000000);
  assert.equal(index.tyGia, 26000);
});

test('USD fallback rate is used when the USDVND row is missing', () => {
  const s = stateWithMarket(gs, { prices: [] });
  assert.equal(gs.buildPriceIndex(s.assets, s.prices, [], s.config, TODAY).tyGia, 25000);
});

test('config_save: whitelist, ranges, percent text, append vs update', () => {
  const s = freshState(gs, { configRows: [{ key: 'cpi_pct', value: '0.045' }] });
  assert.match(run(gs, s, 'config_save', { values: { site_url: 'https://x.test' } }).error, /Không được sửa/);
  assert.match(run(gs, s, 'config_save', { values: { hack: '1' } }).error, /Không được sửa/);
  assert.match(run(gs, s, 'config_save', { values: { cpi_pct: '0.9' } }).error, /phải từ/);
  assert.match(run(gs, s, 'config_save', { values: { ho_so_mac_dinh: 'lieu' } }).error, /hồ sơ/);
  assert.match(run(gs, s, 'config_save', { values: {} }).error, /Không có thiết lập/);
  assert.equal(run(gs, s, 'config_save', { values: { cpi_pct: '4,5%', du_lieu_cu_ngay: 20, ho_so_mac_dinh: 'tang_truong' } }).ok, true);
  assert.equal(s.configRows.find((r) => r.key === 'cpi_pct').value, '0.045');
  assert.equal(s.configRows.find((r) => r.key === 'du_lieu_cu_ngay').value, '20');
  assert.equal(s.configRows.length, 3);
  const config = gs.resolveConfig(gs.configRowsToRaw(s.configRows));
  assert.equal(config.du_lieu_cu_ngay, 20);
  assert.equal(config.ho_so_mac_dinh, 'tang_truong');
  assert.equal(plain(gs.CONFIG_EDITABLE_KEYS).includes('sheet_url'), false);
});

test('resolveConfig: defaults, Vietnamese decimals and percents, bad values fall back', () => {
  const c = gs.resolveConfig({ cpi_pct: '5%', lech_phan_bo_pp: '7,5', du_lieu_cu_ngay: 'abc', ho_so_mac_dinh: 'xyz', site_url: ' https://a.test/ ' });
  assert.equal(c.cpi_pct, 0.05);
  assert.equal(c.lech_phan_bo_pp, 7.5);
  assert.equal(c.du_lieu_cu_ngay, 35);
  assert.equal(c.ho_so_mac_dinh, 'can_bang');
  assert.equal(c.site_url, 'https://a.test/');
  assert.equal(gs.resolveConfig({}).gui_toi_da_1_lan, 5000000000);
});

test('valuation: USD x rate, values by group, missing price falls back to cost', () => {
  const s = stateWithMarket(gs);
  s.holdings = [
    { asset_id: 'USDCASH', goal_id: 'G001', so_luong: 1000, gia_von_vnd: 25000000 },
    { asset_id: 'E1VFVN30', goal_id: 'G001', so_luong: 100, gia_von_vnd: 3000000 },
    { asset_id: 'TK12', goal_id: 'G001', so_luong: 50000000, gia_von_vnd: 50000000 },
    { asset_id: 'QTP', goal_id: 'G001', so_luong: 0, gia_von_vnd: 0 }
  ];
  s.prices = s.prices.filter((p) => p.asset_id !== 'SJC');
  s.holdings.push({ asset_id: 'SJC', goal_id: 'G001', so_luong: 1, gia_von_vnd: 140000000 });
  const index = gs.buildPriceIndex(s.assets, s.prices, [], s.config, TODAY);
  const valued = gs.valueHoldings(s.holdings, index.byId, index.tyGia);
  assert.equal(valued.length, 4);
  const sums = plain(gs.sumByGroup(valued));
  assert.equal(sums.usd, 26000000);
  assert.equal(sums.co_phieu, 3500000);
  assert.equal(sums.tien_gui, 50000000);
  assert.equal(sums.vang, 140000000);
  assert.equal(valued.find((v) => v.asset_id === 'SJC').thieu_gia, true);
});

test('phan_bo parsing: fractions or percents, array or map; drift vs holdings', () => {
  const frac = plain(gs.parsePhanBo('[{"asset_id":"E1VFVN30","pct":0.6},{"asset_id":"TK12","pct":0.4,"ly_do":"an toàn"}]', {}));
  assert.deepEqual(frac.map((p) => p.pct), [60, 40]);
  const map = plain(gs.parsePhanBo('{"E1VFVN30": 70, "TK12": 30}', {}));
  assert.deepEqual(map.map((p) => p.pct), [70, 30]);
  assert.deepEqual(plain(gs.parsePhanBo('not json', {})), []);
  const drift = plain(gs.computeDrift({ total: 100, byAsset: { E1VFVN30: 80, TK12: 20 } }, frac));
  assert.deepEqual(drift.find((d) => d.asset_id === 'E1VFVN30'), { asset_id: 'E1VFVN30', muc_tieu_pct: 60, hien_tai_pct: 80 });
  assert.equal(gs.maxDriftPp(drift), 20);
  assert.deepEqual(plain(gs.computeDrift({ total: 0, byAsset: {} }, frac)), []);
});

function alertsFor(state) {
  return plain(gs.buildDashboardPayload(state, TODAY).alerts);
}
const codes = (alerts) => alerts.map((a) => a.code);

test('alerts: all green when there is nothing to report', () => {
  const s = stateWithMarket(gs);
  s.goals = [];
  const a = alertsFor(s);
  assert.deepEqual(codes(a), ['on_track']);
  assert.equal(a[0].level, 'xanh');
});

test('alerts: emergency fund below minimum; "do" when under half of it', () => {
  const s = stateWithMarket(gs, {
    budget: [{ budget_id: 'B001', loai: 'chi_co_dinh', ten: 'Nhà', so_tien: 10000000, chu_ky: 'thang', trang_thai: 'dang' }],
    holdings: [{ asset_id: 'TK12', goal_id: 'G001', so_luong: 20000000, gia_von_vnd: 20000000 }]
  });
  const mid = alertsFor(s).find((a) => a.code === 'quy_khan_cap');
  assert.equal(mid.level, 'vang');
  s.holdings[0].so_luong = 10000000;
  assert.equal(alertsFor(s).find((a) => a.code === 'quy_khan_cap').level, 'do');
  s.holdings[0].so_luong = 40000000;
  assert.ok(!codes(alertsFor(s)).includes('quy_khan_cap'));
});

test('alerts: stale prices beyond du_lieu_cu_ngay, and no prices at all', () => {
  const s = stateWithMarket(gs, { prices: [] });
  assert.ok(codes(alertsFor(s)).includes('du_lieu_cu'));
  const old = stateWithMarket(gs);
  old.prices.forEach((p) => { p.ngay_gia = '2026-09-20'; });
  const stale = alertsFor(old).find((a) => a.code === 'du_lieu_cu');
  assert.match(stale.title, /47 ngày/);
  const fresh = stateWithMarket(gs);
  assert.ok(!codes(alertsFor(fresh)).includes('du_lieu_cu'));
});

test('alerts: behind schedule, plan not chosen, nothing deposited this month, drift over threshold', () => {
  const s = stateWithMarket(gs);
  s.planRows.push({ goal_id: 'G001', phuong_an: 'can_bang', gui_hang_thang: 10000000, phan_bo_json: '[{"asset_id":"E1VFVN30","pct":0.5},{"asset_id":"TK12","pct":0.5}]' });
  assert.ok(codes(alertsFor(s)).includes('chua_chon_phuong_an'));
  s.goals[0].phuong_an_chon = 'can_bang';
  s.tracking.push({ goal_id: 'G001', ngay: '2026-11-05', on_track: false, lech_thang: -8, gui_thang_nay_de_xuat: '' });
  s.holdings.push({ asset_id: 'E1VFVN30', goal_id: 'G001', so_luong: 1000, gia_von_vnd: 30000000 });
  s.holdings.push({ asset_id: 'TK12', goal_id: 'G001', so_luong: 5000000, gia_von_vnd: 5000000 });
  const a = alertsFor(s);
  assert.ok(!codes(a).includes('chua_chon_phuong_an'));
  assert.equal(a.find((x) => x.code === 'cham_tien_do').level, 'do');
  assert.ok(codes(a).includes('lech_phan_bo'));
  assert.ok(codes(a).includes('chua_gui_thang_nay'));
  assert.equal(a[0].level, 'do');
  s.contributions.push({ ngay: day('2026-11-02'), loai: 'gui', goal_id: 'G001', asset_id: 'TK12', so_tien_vnd: 10000000 });
  assert.ok(!codes(alertsFor(s)).includes('chua_gui_thang_nay'));
});

test('alerts are ordered do, then vang, then xanh', () => {
  const s = stateWithMarket(gs, { prices: [] });
  s.planRows.push({ goal_id: 'G001', phuong_an: 'chi_gui', gui_hang_thang: 1, phan_bo_json: '[]' });
  s.tracking.push({ goal_id: 'G001', ngay: '2026-11-05', on_track: false, lech_thang: -9 });
  const levels = alertsFor(s).map((a) => a.level);
  assert.deepEqual(levels, [...levels].sort((x, y) => ['do', 'vang', 'xanh'].indexOf(x) - ['do', 'vang', 'xanh'].indexOf(y)));
  assert.equal(levels[0], 'do');
});
