// Tab 1 Tổng quan: total assets + trend, "this month to save", alerts, goal progress.
import { el, card, mount, formatShort, formatVnd, formatSigned } from './dom-and-format-helpers.js';
import { renderTrendChart, GROUPS } from './trend-chart.js';
import { goalProgressRow, isActive } from './goal-display-helpers.js';

function heroCard(payload) {
  const { summary, data_as_of: asOf } = payload;
  const change = Number(summary.doi_dau_thang) || 0;
  const canvas = el('canvas', { 'aria-label': 'Biểu đồ tài sản theo nhóm', role: 'img' });
  const box = el('div', { class: 'chart-box' }, canvas);
  const node = el('section', { class: 'card hero' },
    el('p', { class: 'hero__label', text: 'Tổng tài sản' }),
    el('p', { class: 'hero__value', text: formatShort(summary.tong_tai_san) }),
    el('p', { class: 'muted', text: formatVnd(summary.tong_tai_san) }),
    el('div', { class: 'hero__sub' },
      el('div', { class: 'hero__pill' }, el('b', { class: change < 0 ? 'neg' : 'pos', text: formatSigned(change) }), el('small', { text: 'so với đầu tháng' })),
      el('div', { class: 'hero__pill' }, el('b', { text: formatShort(summary.no) }), el('small', { text: 'đang nợ' }))),
    box,
    asOf?.stale_days > 0 ? el('p', { class: 'card__hint', text: `Giá cập nhật lần cuối ${asOf.stale_days} ngày trước.` }) : null);
  requestAnimationFrame(() => {
    if (!renderTrendChart(canvas, payload.trend)) box.replaceChildren(el('p', { class: 'pick-empty', text: 'Chưa đủ số liệu để vẽ biểu đồ.' }));
  });
  return node;
}

function groupLegend(summary) {
  const items = GROUPS.filter((g) => Number(summary.theo_nhom?.[g.key]) > 0);
  if (!items.length) return null;
  return card('Tiền đang nằm ở đâu', el('ul', { class: 'legend' }, items.map((g) => el('li', {},
    el('i', { class: `swatch swatch--${g.key}` }), el('span', { text: g.label }), el('span', { class: 'value', text: formatShort(summary.theo_nhom[g.key]) })))));
}

function monthlyCard(payload, ctx) {
  const goals = payload.goals.filter((g) => isActive(g) && g.gui_thang_nay?.de_xuat > 0);
  if (!goals.length) return null;
  const { summary } = payload;
  const rows = goals.map((g) => {
    const { de_xuat: need, da_gui: sent } = g.gui_thang_nay;
    const done = Number(sent) || 0;
    const paid = done >= need;
    return el('li', { class: 'save-row' },
      el('span', { class: paid ? 'save-row__mark save-row__mark--done' : 'save-row__mark', text: paid ? '✓' : '○', 'aria-hidden': 'true' }),
      el('span', { class: 'save-row__text' }, el('b', { text: g.ten }),
        el('small', { text: paid ? `Đã gửi ${formatShort(done)}` : `Còn gửi ${formatShort(need - done)} (đề xuất ${formatShort(need)})` })),
      paid ? null : el('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Ghi',
        onclick: () => ctx.openAction('contribution_gui', { goal_id: g.goal_id, so_tien_vnd: Math.round(need - done) }) }));
  });
  return card('Tháng này cần gửi',
    el('p', { class: 'muted', text: `Đã gửi ${formatShort(summary.da_gui_thang_nay)} trên ${formatShort(summary.can_gui_thang_nay)}.` }),
    el('ul', { class: 'save-list' }, rows));
}

function alertsCard(alerts, ctx) {
  if (!alerts?.length) return null;
  const mark = { do: '!', vang: '!', xanh: '✓' };
  return card('Cần chú ý', el('ul', { class: 'recs' }, alerts.map((a) => el('li', {},
    el(a.goal_id ? 'button' : 'div', { class: `rec rec--${a.level}`, type: a.goal_id ? 'button' : null, onclick: a.goal_id ? () => ctx.openGoal(a.goal_id) : null },
      el('span', { class: 'rec__icon', text: mark[a.level] || '!', 'aria-hidden': 'true' }),
      el('span', {}, el('span', { class: 'rec__title', text: a.title }), a.detail ? el('span', { class: 'rec__detail', text: a.detail }) : null))))));
}

export function renderOverview(view, payload, ctx) {
  if (!payload.goals.length) {
    mount(view, 
      card(null, el('p', { class: 'empty-title', text: 'Mo chưa có mục tiêu nào.' }),
        el('p', { class: 'muted', text: 'Tạo một mục tiêu, máy tính sẽ cho Mo biết mỗi tháng cần gửi bao nhiêu.' }),
        el('button', { type: 'button', class: 'btn', text: 'Tạo mục tiêu đầu tiên', onclick: () => ctx.openAction('goal_save', {}, 'goals') })),
      heroCard(payload));
    return;
  }
  const active = payload.goals.filter(isActive);
  mount(view, heroCard(payload), groupLegend(payload.summary), monthlyCard(payload, ctx), alertsCard(payload.alerts, ctx),
    active.length ? card('Tiến độ mục tiêu', ...active.map((g) => goalProgressRow(g, ctx.openGoal))) : null);
}
