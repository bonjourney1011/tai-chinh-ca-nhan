// Small lookups and one reusable goal progress row, shared by the tabs.
import { el, formatMoney, formatMonths, formatShort, formatDayMonth, progressBar, clampPct, ratioToPct } from './dom-and-format-helpers.js';

export const PLAN_LABELS = { chi_gui: 'Chỉ gửi tiền', can_bang: 'Cân bằng', tang_truong: 'Tăng trưởng' };
export const RISK_LABELS = { bao_thu: 'Thận trọng', can_bang: 'Cân bằng', tang_truong: 'Tăng trưởng' };
export const GROUP_LABELS = { tien_gui: 'Tiền gửi', trai_phieu: 'Trái phiếu', co_phieu: 'Cổ phiếu', vang: 'Vàng', usd: 'USD', khac: 'Khác' };

export const goalName = (payload, id) => payload.goals?.find((g) => g.goal_id === id)?.ten
  || payload.lists?.goals_active?.find((g) => g.goal_id === id)?.ten || 'Mục tiêu đã xóa';
export const assetName = (payload, id) => payload.holdings?.find((h) => h.asset_id === id)?.ten
  || payload.lists?.assets?.find((a) => a.asset_id === id)?.ten || id;

export const isActive = (goal) => goal.trang_thai === 'dang';

export function trackText(goal) {
  if (goal.on_track) return 'đúng tiến độ';
  const late = Math.abs(Math.round(Number(goal.lech_thang) || 0));
  return late ? `chậm ${late} tháng` : 'chậm tiến độ';
}

/** One tappable goal: name, progress bar, "x / y", on-track text. */
export function goalProgressRow(goal, onOpen) {
  const pct = clampPct(goal.tien_do_pct);
  const tone = goal.on_track ? 'good' : 'warn';
  return el('button', { type: 'button', class: 'goal-row', onclick: () => onOpen(goal.goal_id) },
    el('span', { class: 'goal-row__head' },
      el('b', { text: goal.ten }),
      el('span', { class: `goal-row__track goal-row__track--${tone}`, text: trackText(goal) })),
    progressBar(pct, tone),
    el('span', { class: 'goal-row__meta' },
      el('span', { text: `${formatMoney(goal.gia_tri_hien_tai, goal.tien_te)} / ${formatMoney(goal.so_tien_dich, goal.tien_te)}` }),
      el('span', { text: `${Math.round(pct)}% · còn ${formatMonths(goal.con_thang)}` })));
}

/** One contribution line: dd/mm, where it went, signed amount (rút shows minus). */
export function ledgerRow(payload, row, showGoal = true) {
  const out = row.loai === 'rut';
  const amount = Math.abs(Number(row.so_tien_vnd) || 0);
  const where = [showGoal ? goalName(payload, row.goal_id) : null, assetName(payload, row.asset_id)].filter(Boolean).join(' · ');
  return el('div', { class: 'ledger-row' },
    el('span', { class: 'muted', text: formatDayMonth(row.ngay) }),
    el('span', {}, el('b', { text: `${out ? 'Rút' : 'Gửi'} · ${where}` }), row.ghi_chu ? el('small', { class: 'ledger-note', text: row.ghi_chu }) : null),
    el('b', { class: out ? 'neg' : 'pos', text: `${out ? '-' : '+'}${formatShort(amount)}` }));
}

/** Goal card line: chosen plan, "pick one", or the quick estimate while the calculator has not run. */
export function planLine(goal) {
  const plans = goal.plans || [];
  const chosen = plans.find((p) => p.phuong_an === goal.phuong_an_chon);
  if (chosen) return `Đang chọn: ${PLAN_LABELS[chosen.phuong_an]}. Gửi ${formatShort(chosen.gui_hang_thang)}/tháng, khả năng đạt ${Math.round(ratioToPct(chosen.xac_suat_dat))}%.`;
  if (plans.length) return 'Anh chưa chọn phương án. Mở mục tiêu để chọn.';
  const quick = goal.uoc_tinh_nhanh ? ` Ước tính nhanh: ${formatShort(goal.uoc_tinh_nhanh)}/tháng.` : '';
  return `Chưa có kế hoạch. Máy tính sẽ chạy cuối tháng.${quick}`;
}
