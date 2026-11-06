import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, day, freshState, run, stateWithMarket, TODAY } from './load-apps-script-sandbox.mjs';

const gs = loadGs();
const goalData = { ten: 'Mua nhà', so_tien_dich: 2000000000, tien_te: 'VND', ngay_dich: '2036-11-06', tien_co_san: 100000000, ho_so_rui_ro: 'can_bang', uu_tien: 'cao' };

test('goal_save creates G001 with defaults and a quick estimate', () => {
  const s = freshState(gs);
  const r = run(gs, s, 'goal_save', goalData);
  assert.equal(r.ok, true);
  assert.equal(s.goals.length, 1);
  assert.equal(s.goals[0].goal_id, 'G001');
  assert.equal(s.goals[0].trang_thai, 'dang');
  assert.equal(s.goals[0].phuong_an_chon, '');
  assert.equal(s.seq.goal, 1);
  assert.match(r.message, /Ước tính [\d,]+ triệu\/tháng/);
});

test('quick estimate equals the closed-form monthly deposit', () => {
  // 120tr in 12 months at 8%/year: r = 1.08^(1/12) - 1, pmt = target * r / (1.08 - 1)
  const pmt = gs.requiredPmt(120000000, 0, 12, 0.08);
  assert.ok(Math.abs(pmt - 9650000) < 20000, String(pmt));
  const s = freshState(gs);
  const r = run(gs, s, 'goal_save', { ...goalData, ten: 'Du lịch', so_tien_dich: 120000000, tien_co_san: 0, ngay_dich: '', so_thang: 12 });
  assert.match(r.message, /Ước tính 9,7 triệu\/tháng/);
});

test('so_thang becomes ngay_dich; past and >40 years dates are rejected', () => {
  const s = freshState(gs);
  run(gs, s, 'goal_save', { ...goalData, ngay_dich: '', so_thang: 18 });
  assert.equal(gs.formatIsoDate(s.goals[0].ngay_dich), '2028-05-06');
  assert.match(run(gs, s, 'goal_save', { ...goalData, ngay_dich: '2026-11-06' }).error, /sau hôm nay/);
  assert.match(run(gs, s, 'goal_save', { ...goalData, ngay_dich: '2070-01-01' }).error, /xa quá 40 năm/);
  assert.match(run(gs, s, 'goal_save', { ...goalData, ngay_dich: '', so_thang: 481 }).error, /Số tháng/);
  assert.match(run(gs, s, 'goal_save', { ...goalData, ngay_dich: '', so_thang: '' }).error, /ngày đích hoặc số tháng/);
  assert.equal(s.goals.length, 1);
});

test('goal_save validation: name, amount caps per currency, negative savings', () => {
  const s = freshState(gs);
  assert.match(run(gs, s, 'goal_save', { ...goalData, ten: 'A' }).error, /ít nhất 2/);
  assert.match(run(gs, s, 'goal_save', { ...goalData, ten: 'x'.repeat(61) }).error, /dài quá 60/);
  assert.match(run(gs, s, 'goal_save', { ...goalData, so_tien_dich: 0 }).error, /lớn hơn 0/);
  assert.match(run(gs, s, 'goal_save', { ...goalData, so_tien_dich: 60000000000 }).error, /quá lớn/);
  assert.match(run(gs, s, 'goal_save', { ...goalData, tien_te: 'USD', so_tien_dich: 2000001 }).error, /quá lớn/);
  assert.equal(run(gs, s, 'goal_save', { ...goalData, tien_te: 'USD', so_tien_dich: 50000, tien_co_san: 0 }).ok, true);
  assert.match(run(gs, s, 'goal_save', { ...goalData, tien_co_san: -1 }).error, /Tiền có sẵn/);
  assert.match(run(gs, s, 'goal_save', { ...goalData, ho_so_rui_ro: 'lieu' }).error, /hồ sơ rủi ro/);
});

test('goal_save with goal_id updates in place and keeps status and chosen plan', () => {
  const s = stateWithMarket(gs);
  s.goals[0].phuong_an_chon = 'can_bang';
  const r = run(gs, s, 'goal_save', { ...goalData, goal_id: 'g001', ten: 'Mua nhà Hà Nội', so_tien_dich: 2500000000 });
  assert.equal(r.ok, true);
  assert.equal(s.goals.length, 1);
  assert.equal(s.goals[0].ten, 'Mua nhà Hà Nội');
  assert.equal(s.goals[0].phuong_an_chon, 'can_bang');
  assert.equal(s.seq.goal, 0);
  assert.match(run(gs, s, 'goal_save', { ...goalData, goal_id: 'G099' }).error, /Không tìm thấy mục tiêu/);
});

test('new ids skip hand-typed ids and never reuse the stored counter', () => {
  const s = freshState(gs, { seq: { goal: 1, budget: 0 } });
  s.goals.push({ goal_id: 'G002', ten: 'Gõ tay', trang_thai: 'dang' });
  run(gs, s, 'goal_save', goalData);
  assert.equal(s.goals[1].goal_id, 'G003');
  assert.equal(s.seq.goal, 3);
});

test('goal_choose_plan needs a Plan row for that goal and option', () => {
  const s = stateWithMarket(gs);
  assert.match(run(gs, s, 'goal_choose_plan', { goal_id: 'G001', phuong_an: 'can_bang' }).error, /chưa được tính/);
  s.planRows.push({ goal_id: 'G001', phuong_an: 'can_bang', gui_hang_thang: 12000000 });
  assert.equal(run(gs, s, 'goal_choose_plan', { goal_id: 'G001', phuong_an: 'can_bang' }).ok, true);
  assert.equal(s.goals[0].phuong_an_chon, 'can_bang');
  assert.match(run(gs, s, 'goal_choose_plan', { goal_id: 'G001', phuong_an: 'lieu' }).error, /Chọn phương án/);
});

test('goal_set_status accepts the three states only; closed goals reject choose_plan', () => {
  const s = stateWithMarket(gs);
  assert.equal(run(gs, s, 'goal_set_status', { goal_id: 'G001', trang_thai: 'da_dat' }).ok, true);
  assert.equal(s.goals[0].trang_thai, 'da_dat');
  assert.match(run(gs, s, 'goal_set_status', { goal_id: 'G001', trang_thai: 'xoa' }).error, /Chọn trạng thái/);
  s.planRows.push({ goal_id: 'G001', phuong_an: 'chi_gui' });
  assert.match(run(gs, s, 'goal_choose_plan', { goal_id: 'G001', phuong_an: 'chi_gui' }).error, /không còn/);
});

test('unknown and prototype action names are rejected', () => {
  const s = freshState(gs);
  assert.equal(run(gs, s, 'constructor', {}).ok, false);
  assert.equal(run(gs, s, 'toString', {}).ok, false);
  assert.equal(run(gs, s, 'drop_everything', {}).error, 'Thao tác không hợp lệ.');
});

test('date helpers: addMonths clamps month ends and monthsUntil rounds', () => {
  assert.equal(gs.formatIsoDate(gs.addMonths(day('2026-01-31'), 1)), '2026-02-28');
  assert.equal(gs.monthsUntil(TODAY, day('2027-11-06')), 12);
  assert.equal(gs.monthsUntil(TODAY, day('2026-11-07')), 1);
  assert.equal(gs.monthsUntil(TODAY, TODAY), 0);
  assert.equal(gs.monthsBetween(day('2026-01-15'), day('2026-03-14')), 1);
});
