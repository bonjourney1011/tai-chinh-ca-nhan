// Tab 2 Mục tiêu: list of goal cards + "＋ Mục tiêu mới". A tapped goal opens the plan view.
import { el, card, mount, formatMoney, formatDate } from './dom-and-format-helpers.js';
import { goalProgressRow, isActive, planLine, RISK_LABELS } from './goal-display-helpers.js';
import { renderGoalDetail } from './goal-plan-detail.js';

function goalCard(goal, ctx) {
  return el('section', { class: 'card' },
    goalProgressRow(goal, ctx.openGoal),
    el('p', { class: 'card__hint', text: planLine(goal) }),
    el('p', { class: 'card__hint', text: `Hạn ${formatDate(goal.ngay_dich)} · ${RISK_LABELS[goal.ho_so_rui_ro] || ''} · cần ${formatMoney(goal.so_tien_dich, goal.tien_te)}` }));
}

export function renderGoals(view, payload, ctx) {
  const goal = ctx.state.goalId && payload.goals.find((g) => g.goal_id === ctx.state.goalId);
  if (goal) { renderGoalDetail(view, goal, payload, ctx); return; }
  ctx.state.goalId = null;
  const active = payload.goals.filter(isActive);
  const closed = payload.goals.filter((g) => !isActive(g));
  mount(view,
    el('button', { type: 'button', class: 'btn', text: '＋ Mục tiêu mới', onclick: () => ctx.openAction('goal_save', {}) }),
    !active.length ? card(null, el('p', { class: 'muted', text: 'Mo chưa có mục tiêu nào đang chạy.' })) : null,
    active.map((g) => goalCard(g, ctx)),
    closed.length ? el('details', { class: 'card more' }, el('summary', { text: `Đã đạt hoặc đã hủy (${closed.length})` }),
      closed.map((g) => el('p', { class: 'muted', text: `${g.ten}: ${g.trang_thai === 'da_dat' ? 'đã đạt' : 'đã hủy'}` }))) : null);
}
