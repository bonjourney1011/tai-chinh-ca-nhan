import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, freshState, run, stateWithMarket, plain, NOW } from './load-apps-script-sandbox.mjs';

const gs = loadGs();
const deposit = { goal_id: 'G001', asset_id: 'E1VFVN30', loai: 'gui', so_tien_vnd: 3500000 };

test('deposit uses the latest price for the quantity and writes ledger + holding', () => {
  const s = stateWithMarket(gs);
  const r = run(gs, s, 'contribution_add', deposit, { requestId: 'req-1' });
  assert.equal(r.ok, true);
  assert.equal(s.contributions.length, 1);
  assert.equal(s.contributions[0].so_luong, 100);
  assert.equal(s.contributions[0].gia_don_vi, 35000);
  assert.equal(s.contributions[0].request_id, 'req-1');
  assert.deepEqual(plain(s.holdings), [{ asset_id: 'E1VFVN30', goal_id: 'G001', so_luong: 100, gia_von_vnd: 3500000, cap_nhat_luc: plain(NOW) }]);
});

test('second deposit updates the same holding (upsert on asset_id + goal_id)', () => {
  const s = stateWithMarket(gs);
  run(gs, s, 'contribution_add', deposit, { requestId: 'a' });
  run(gs, s, 'contribution_add', { ...deposit, so_tien_vnd: 700000 }, { requestId: 'b' });
  assert.equal(s.holdings.length, 1);
  assert.equal(s.holdings[0].so_luong, 120);
  assert.equal(s.holdings[0].gia_von_vnd, 4200000);
});

test('deposit asset (lai_suat): quantity is the đồng amount, unit price 1', () => {
  const s = stateWithMarket(gs);
  run(gs, s, 'contribution_add', { ...deposit, asset_id: 'TK12', so_tien_vnd: 50000000 });
  assert.equal(s.holdings[0].so_luong, 50000000);
  assert.equal(s.contributions[0].gia_don_vi, 1);
});

test('typed quantity or unit price override the market price', () => {
  const s = stateWithMarket(gs);
  run(gs, s, 'contribution_add', { ...deposit, so_luong: 90 });
  assert.equal(s.contributions[0].so_luong, 90);
  assert.equal(s.contributions[0].gia_don_vi, 38888.89);
  run(gs, s, 'contribution_add', { ...deposit, so_tien_vnd: 1000000, gia_don_vi: 40000 }, { requestId: 'z' });
  assert.equal(s.contributions[1].so_luong, 25);
});

test('no price and no quantity: asks for one; unknown asset and closed goal are refused', () => {
  const s = stateWithMarket(gs, { prices: [] });
  assert.match(run(gs, s, 'contribution_add', deposit).error, /Chưa có giá/);
  assert.match(run(gs, s, 'contribution_add', { ...deposit, asset_id: 'NOPE' }).error, /Chưa có tài sản/);
  s.goals[0].trang_thai = 'da_dat';
  assert.match(run(gs, s, 'contribution_add', { ...deposit, so_luong: 1 }).error, /không còn/);
  assert.equal(s.contributions.length, 0);
});

test('withdraw more than the holding is rejected; partial and full withdraw adjust cost proportionally', () => {
  const s = stateWithMarket(gs);
  run(gs, s, 'contribution_add', { ...deposit, so_tien_vnd: 7000000 }, { requestId: 'in' });
  assert.match(run(gs, s, 'contribution_add', { ...deposit, loai: 'rut', so_tien_vnd: 7350000 }, { requestId: 'o1' }).error, /Rút nhiều hơn/);
  assert.equal(s.contributions.length, 1);
  run(gs, s, 'contribution_add', { ...deposit, loai: 'rut', so_tien_vnd: 3500000 }, { requestId: 'o2' });
  assert.equal(s.holdings[0].so_luong, 100);
  assert.equal(s.holdings[0].gia_von_vnd, 3500000);
  run(gs, s, 'contribution_add', { ...deposit, loai: 'rut', so_tien_vnd: 3500000 }, { requestId: 'o3' });
  assert.equal(s.holdings[0].so_luong, 0);
  assert.equal(s.holdings[0].gia_von_vnd, 0);
  assert.match(run(gs, s, 'contribution_add', { ...deposit, loai: 'rut', so_tien_vnd: 35000 }, { requestId: 'o4' }).error, /Rút nhiều hơn/);
});

test('withdraw from an asset never held is rejected', () => {
  const s = stateWithMarket(gs);
  assert.match(run(gs, s, 'contribution_add', { ...deposit, loai: 'rut' }).error, /Rút nhiều hơn/);
});

test('"tr" vs "k" mistake: an amount above gui_toi_da_1_lan is refused', () => {
  const s = stateWithMarket(gs);
  const r = run(gs, s, 'contribution_add', { ...deposit, so_tien_vnd: 12000000000 });
  assert.equal(r.ok, false);
  assert.match(r.error, /quá lớn.*"tr" hay "k"/);
  assert.equal(run(gs, s, 'contribution_add', { ...deposit, so_tien_vnd: 5000000000 }).ok, true);
  assert.match(run(gs, s, 'contribution_add', { ...deposit, so_tien_vnd: 0 }).error, /lớn hơn 0/);
});

test('replay by request_id: same id returns replayed with an empty plan and nothing is written twice', () => {
  const s = stateWithMarket(gs);
  assert.equal(run(gs, s, 'contribution_add', deposit, { requestId: 'form-42' }).ok, true);
  const again = run(gs, s, 'contribution_add', deposit, { requestId: 'form-42' });
  assert.equal(again.ok, true);
  assert.equal(again.replayed, true);
  assert.equal(again.message, 'Đã ghi trước đó.');
  assert.equal(gs.planIsEmpty(again.plan), true);
  assert.equal(s.contributions.length, 1);
  assert.equal(s.holdings[0].so_luong, 100);
});

test('ledger is planned before holdings and the write order puts Contributions first', () => {
  const s = stateWithMarket(gs);
  const result = gs.planAction('contribution_add', deposit, gs.buildPlanContext(s, NOW, 'x'));
  assert.deepEqual(Object.keys(result.plan.appends), ['Contributions', 'Holdings']);
  const order = plain(gs.WRITE_ORDER);
  assert.ok(order.indexOf('Contributions') < order.indexOf('Holdings'));
});

test('future dates are refused, back-dating is allowed', () => {
  const s = stateWithMarket(gs);
  assert.match(run(gs, s, 'contribution_add', { ...deposit, ngay: '2026-11-07' }).error, /tương lai/);
  assert.equal(run(gs, s, 'contribution_add', { ...deposit, ngay: '2026-10-01' }).ok, true);
  assert.equal(gs.formatIsoDate(s.contributions[0].ngay), '2026-10-01');
});

test('holding_set overwrites quantity and keeps the cost unless given', () => {
  const s = stateWithMarket(gs);
  run(gs, s, 'contribution_add', deposit, { requestId: 'q' });
  assert.equal(run(gs, s, 'holding_set', { asset_id: 'E1VFVN30', goal_id: 'G001', so_luong: 80 }).ok, true);
  assert.equal(s.holdings[0].so_luong, 80);
  assert.equal(s.holdings[0].gia_von_vnd, 3500000);
  run(gs, s, 'holding_set', { asset_id: 'E1VFVN30', goal_id: 'G001', so_luong: 80, gia_von_vnd: 2800000 });
  assert.equal(s.holdings[0].gia_von_vnd, 2800000);
  assert.match(run(gs, s, 'holding_set', { asset_id: 'E1VFVN30', goal_id: 'G001', so_luong: -1 }).error, /Số lượng/);
  assert.equal(s.holdings.length, 1);
});

test('holding_set creates a holding priced at market when none exists', () => {
  const s = stateWithMarket(gs);
  run(gs, s, 'holding_set', { asset_id: 'SJC', goal_id: 'G001', so_luong: 2 });
  assert.equal(s.holdings[0].gia_von_vnd, 300000000);
  assert.match(run(gs, freshState(gs), 'holding_set', {}).error, /Không tìm thấy mục tiêu/);
});
