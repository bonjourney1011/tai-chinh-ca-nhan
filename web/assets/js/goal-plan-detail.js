// Goal detail ("Plan view"): header, three plan options to compare, drift note, actions, history.
import { el, card, mount, formatShort, formatMoney, formatMonths, formatDate, ratioToPct, progressBar, clampPct } from './dom-and-format-helpers.js';
import { PLAN_LABELS, RISK_LABELS, trackText, assetName, planLine } from './goal-display-helpers.js';
import { goalPrefill } from './form-specs-goal.js';
import { renderHistoryCard } from './goal-history-panel.js';

const BAND = [['thap', 'Thấp'], ['co_so', 'Cơ sở'], ['cao', 'Cao']];

function planCard(plan, goal, payload, ctx) {
  const chosen = goal.phuong_an_chon === plan.phuong_an;
  const prob = Math.round(ratioToPct(plan.xac_suat_dat));
  return el('section', { class: `card plan${chosen ? ' plan--chosen' : ''}` },
    el('div', { class: 'plan__head' }, el('h3', { class: 'plan__title', text: PLAN_LABELS[plan.phuong_an] || plan.phuong_an }),
      chosen ? el('span', { class: 'chip chip--good', text: '✓ đang chọn' }) : null),
    el('p', { class: 'plan__money' }, el('b', { text: `${formatShort(plan.gui_hang_thang)}` }), ' mỗi tháng'),
    el('p', { class: 'muted', text: `Khả năng đạt mục tiêu: ${prob}%. Muốn chắc đạt 80% thì gửi ${formatShort(plan.gui_de_dat_80)}/tháng.` }),
    progressBar(prob, prob >= 70 ? 'good' : 'warn'),
    el('div', { class: 'bands' }, BAND.map(([key, label]) => el('div', { class: 'band' },
      el('small', { text: label }), el('b', { text: formatMoney(plan.ket_qua?.[key], goal.tien_te) })))),
    plan.ly_do ? el('p', { class: 'item__advice', text: plan.ly_do }) : null,
    plan.phan_bo?.length ? el('ul', { class: 'alloc' }, plan.phan_bo.map((a) => el('li', {},
      el('span', { class: 'alloc__pct', text: `${Math.round(a.pct)}%` }),
      el('span', {}, el('b', { text: a.ten || assetName(payload, a.asset_id) }), a.ly_do ? el('small', { text: a.ly_do }) : null)))) : null,
    chosen ? null : el('button', { type: 'button', class: 'btn btn--ghost', text: 'Chọn phương án này',
      onclick: () => ctx.submit('goal_choose_plan', { goal_id: goal.goal_id, phuong_an: plan.phuong_an }) }));
}

function driftCard(goal, payload) {
  const rows = (goal.lech_phan_bo || []).filter((r) => Math.abs(r.hien_tai_pct - r.muc_tieu_pct) >= (payload.settings?.lech_phan_bo_pp || 5));
  if (!rows.length) return null;
  return card('Chia tiền đang lệch', el('ul', { class: 'alloc' }, rows.map((r) => el('li', {},
    el('span', { class: 'alloc__pct', text: `${Math.round(r.hien_tai_pct)}%` }),
    el('span', {}, el('b', { text: assetName(payload, r.asset_id) }), el('small', { text: `Nên là ${Math.round(r.muc_tieu_pct)}%` }))))));
}

function setStatus(ctx, goal, status, question) {
  if (window.confirm(question)) ctx.submit('goal_set_status', { goal_id: goal.goal_id, trang_thai: status }).then((r) => { if (r.ok) ctx.closeGoal(); });
}

export function renderGoalDetail(view, goal, payload, ctx) {
  const plans = goal.plans || [];
  mount(view,
    el('button', { type: 'button', class: 'btn btn--ghost btn--back', text: '← Tất cả mục tiêu', onclick: ctx.closeGoal }),
    el('section', { class: 'card' },
      el('h2', { class: 'card__title', text: goal.ten }),
      el('p', { class: 'hero__value hero__value--md', text: formatMoney(goal.so_tien_dich, goal.tien_te) }),
      el('p', { class: 'muted', text: `Hạn ${formatDate(goal.ngay_dich)}, còn ${formatMonths(goal.con_thang)}. ${RISK_LABELS[goal.ho_so_rui_ro] || ''}.` }),
      progressBar(goal.tien_do_pct, goal.on_track ? 'good' : 'warn'),
      el('p', { class: 'muted', text: `Đã có ${formatMoney(goal.gia_tri_hien_tai, goal.tien_te)} (${Math.round(clampPct(goal.tien_do_pct))}%), ${trackText(goal)}.` }),
      el('p', { class: 'card__hint', text: planLine(goal) })),
    plans.length ? plans.map((p) => planCard(p, goal, payload, ctx)) : null,
    driftCard(goal, payload),
    el('div', { class: 'item__actions' },
      el('button', { type: 'button', class: 'btn btn--ghost', text: 'Sửa', onclick: () => ctx.openAction('goal_save', goalPrefill(goal)) }),
      el('button', { type: 'button', class: 'btn btn--ghost', text: 'Đánh dấu xong', onclick: () => setStatus(ctx, goal, 'da_dat', 'Mo đã đạt mục tiêu này?') }),
      el('button', { type: 'button', class: 'btn btn--ghost btn--danger', text: 'Hủy', onclick: () => setStatus(ctx, goal, 'huy', 'Hủy mục tiêu này? Lịch sử gửi vẫn được giữ.') })),
    renderHistoryCard(goal, payload, ctx));
}
