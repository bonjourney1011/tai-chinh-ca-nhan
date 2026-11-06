import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, freshState, run, stateWithMarket, plain, TODAY } from './load-apps-script-sandbox.mjs';

const gs = loadGs();
const line = (id, loai, ten, so_tien, extra = {}) => ({ budget_id: id, loai, ten, so_tien, chu_ky: 'thang', lai_suat_nam: '', tra_toi_thieu: '', trang_thai: 'dang', ghi_chu: '', ...extra });

function household(overrides = {}) {
  return stateWithMarket(gs, {
    budget: [
      line('B001', 'thu_nhap', 'Lương', 30000000),
      line('B002', 'thu_nhap', 'Thưởng', 24000000, { chu_ky: 'nam' }),
      line('B003', 'chi_co_dinh', 'Tiền nhà', 10000000),
      line('B004', 'chi_co_dinh', 'Bảo hiểm', 6000000, { chu_ky: 'nam' }),
      line('B005', 'chi_bien_doi', 'Ăn uống', 5000000),
      line('B006', 'chi_bien_doi', 'Du lịch', 12000000, { chu_ky: 'nam' }),
      line('B007', 'no', 'Thẻ tín dụng', 20000000, { lai_suat_nam: 0.24, tra_toi_thieu: 1000000 }),
      line('B008', 'no', 'Vay xe', 100000000, { lai_suat_nam: 0.1, tra_toi_thieu: 3000000 }),
      line('B009', 'chi_bien_doi', 'Đã xoá', 9000000, { trang_thai: 'xoa' })
    ],
    holdings: [{ asset_id: 'TK12', goal_id: 'G001', so_luong: 33000000, gia_von_vnd: 33000000, cap_nhat_luc: '' }],
    ...overrides
  });
}

test('budget_save creates B001; debt rate is stored as a decimal, other lines drop debt fields', () => {
  const s = freshState(gs);
  assert.equal(run(gs, s, 'budget_save', { loai: 'no', ten: 'Thẻ tín dụng', so_tien: 20000000, lai_suat_nam: 24, tra_toi_thieu: 1000000 }).ok, true);
  assert.equal(s.budget[0].budget_id, 'B001');
  assert.equal(s.budget[0].lai_suat_nam, 0.24);
  assert.equal(s.budget[0].chu_ky, 'thang');
  run(gs, s, 'budget_save', { loai: 'chi_co_dinh', ten: 'Tiền nhà', so_tien: 10000000, lai_suat_nam: 50 });
  assert.equal(s.budget[1].budget_id, 'B002');
  assert.equal(s.budget[1].lai_suat_nam, '');
  assert.equal(s.seq.budget, 2);
});

test('budget_save validation: type, cycle, rate range, amount cap, min payment above balance', () => {
  const s = freshState(gs);
  assert.match(run(gs, s, 'budget_save', { loai: 'khac', ten: 'Abc', so_tien: 1000 }).error, /loại khoản/);
  assert.match(run(gs, s, 'budget_save', { loai: 'thu_nhap', ten: 'Lương', so_tien: 1000, chu_ky: 'tuan' }).error, /chu kỳ/);
  assert.match(run(gs, s, 'budget_save', { loai: 'no', ten: 'Vay', so_tien: 1000000, lai_suat_nam: 101 }).error, /Lãi suất/);
  assert.match(run(gs, s, 'budget_save', { loai: 'chi_co_dinh', ten: 'Nhà', so_tien: 6000000000 }).error, /quá lớn/);
  assert.match(run(gs, s, 'budget_save', { loai: 'no', ten: 'Vay', so_tien: 1000000, tra_toi_thieu: 2000000 }).error, /Trả tối thiểu/);
  assert.match(run(gs, s, 'budget_save', { loai: 'thu_nhap', ten: 'Lương', so_tien: 0 }).error, /lớn hơn 0/);
  assert.equal(s.budget.length, 0);
});

test('budget_save with budget_id edits that line; budget_delete is a soft delete', () => {
  const s = household();
  run(gs, s, 'budget_save', { budget_id: 'B001', loai: 'thu_nhap', ten: 'Lương mới', so_tien: 35000000 });
  assert.equal(s.budget[0].ten, 'Lương mới');
  assert.equal(s.budget.length, 9);
  run(gs, s, 'budget_delete', { budget_id: 'b003' });
  assert.equal(s.budget[2].trang_thai, 'xoa');
  assert.equal(s.budget.length, 9);
  assert.match(run(gs, s, 'budget_delete', { budget_id: 'B404' }).error, /Không tìm thấy/);
});

test('metrics: yearly lines count 1/12, deleted lines are ignored, debt minimums reduce the surplus', () => {
  const m = plain(gs.buildDashboardPayload(household(), TODAY).budget.metrics);
  assert.equal(m.thu_thang, 32000000);
  assert.equal(m.chi_thang, 16500000);
  assert.equal(m.tra_no_toi_thieu, 4000000);
  assert.equal(m.du_thang, 11500000);
  assert.equal(m.ty_le_tiet_kiem, 0.359);
});

test('emergency fund months = tien_gui + trai_phieu holdings / monthly spending', () => {
  const m = gs.buildDashboardPayload(household(), TODAY).budget.metrics;
  assert.equal(m.quy_khan_cap_thang, 2);
  const none = gs.buildDashboardPayload(household({ budget: [line('B001', 'thu_nhap', 'Lương', 30000000)] }), TODAY).budget.metrics;
  assert.equal(none.quy_khan_cap_thang, null);
});

test('can_gui sums the chosen plans (else the quick estimate); feasibility compares with the surplus', () => {
  const easy = household();
  const m = gs.buildDashboardPayload(easy, TODAY).budget.metrics;
  assert.ok(m.can_gui > 8000000 && m.can_gui < 11000000, String(m.can_gui));
  assert.equal(m.kha_thi, true);
  assert.equal(m.thieu, 0);
  const planned = household();
  planned.goals[0].phuong_an_chon = 'tang_truong';
  planned.planRows.push({ goal_id: 'G001', phuong_an: 'tang_truong', gui_hang_thang: 20000000, phan_bo_json: '[]' });
  const hard = gs.buildDashboardPayload(planned, TODAY).budget.metrics;
  assert.equal(hard.can_gui, 20000000);
  assert.equal(hard.kha_thi, false);
  assert.equal(hard.thieu, 20000000 - 11500000);
});

test('direction: raise income when essentials > 75% of income or saving < 10%, else cut spending', () => {
  assert.equal(gs.buildDashboardPayload(household(), TODAY).budget.metrics.huong, 'cat_chi');
  const tight = household({ budget: [line('B001', 'thu_nhap', 'Lương', 20000000), line('B002', 'chi_co_dinh', 'Nhà + ăn', 16000000)] });
  const m = gs.buildDashboardPayload(tight, TODAY).budget.metrics;
  assert.equal(m.huong, 'tang_thu');
  assert.match(m.ly_do, /80%/);
  const lowSaving = household({ budget: [line('B001', 'thu_nhap', 'Lương', 20000000), line('B002', 'chi_co_dinh', 'Nhà', 5000000), line('B003', 'chi_bien_doi', 'Tiêu', 14000000)] });
  assert.equal(gs.buildDashboardPayload(lowSaving, TODAY).budget.metrics.huong, 'tang_thu');
});

test('direction: a shortfall bigger than a 20% cut of variable spending also means raise income', () => {
  const planned = household();
  planned.goals[0].phuong_an_chon = 'tang_truong';
  planned.planRows.push({ goal_id: 'G001', phuong_an: 'tang_truong', gui_hang_thang: 20000000, phan_bo_json: '[]' });
  const m = gs.buildDashboardPayload(planned, TODAY).budget.metrics;
  assert.equal(m.huong, 'tang_thu');
  assert.match(m.ly_do, /tăng thu nhập/);
});

test('levers: raising income by 1, 2 and 5 million is offered next to the cuts', () => {
  const levers = plain(gs.buildDashboardPayload(household(), TODAY).budget.levers);
  const five = levers.find((l) => l.ten === 'Tăng thu nhập +5 triệu/tháng, gửi hết phần tăng');
  assert.equal(five.tiet_kiem_thang, 5000000);
  assert.ok(five.som_hon_thang > levers.find((l) => l.ten === 'Giảm 20% Ăn uống').som_hon_thang);
});

test('levers: -20% on each variable line and early payoff of debts above 15%/year only', () => {
  const levers = plain(gs.buildDashboardPayload(household(), TODAY).budget.levers);
  const food = levers.find((l) => l.ten === 'Giảm 20% Ăn uống');
  assert.equal(food.tiet_kiem_thang, 1000000);
  assert.ok(food.som_hon_thang > 0);
  assert.equal(food.goal_id, 'G001');
  assert.ok(levers.some((l) => /Trả sớm Thẻ tín dụng/.test(l.ten) && l.tiet_kiem_thang === 400000));
  assert.ok(!levers.some((l) => /Vay xe/.test(l.ten)));
  assert.ok(!levers.some((l) => /Đã xoá/.test(l.ten)));
  const sorted = levers.map((l) => l.som_hon_thang);
  assert.deepEqual(sorted, [...sorted].sort((a, b) => b - a));
});

test('months-to-goal inverts the required deposit; never-reached returns null', () => {
  const pmt = gs.requiredPmt(500000000, 20000000, 60, 0.08);
  assert.ok(Math.abs(gs.monthsToGoal(500000000, 20000000, pmt, 0.08) - 60) < 0.01);
  assert.equal(gs.monthsToGoal(500000000, 0, 0, 0.08), null);
  assert.equal(gs.monthsToGoal(100, 200, 0, 0.08), 0);
  assert.ok(gs.monthsSaved(500000000, 20000000, 5000000, 1000000, 0.08) > 0);
});

test('no goals or no budget: metrics and levers are empty, never throw', () => {
  const m = gs.buildDashboardPayload(freshState(gs), TODAY).budget;
  assert.equal(m.metrics.thu_thang, 0);
  assert.equal(m.metrics.huong, 'tang_thu');
  assert.deepEqual(plain(m.levers), []);
});
