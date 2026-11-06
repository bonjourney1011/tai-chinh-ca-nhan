// Tab 3 Ghi sổ: three big actions, holdings grouped by goal, the 30 latest contributions.
import { el, card, mount, formatVnd, formatShort } from './dom-and-format-helpers.js';
import { goalName, ledgerRow } from './goal-display-helpers.js';

function holdingRow(h, ctx) {
  const qty = Number(h.so_luong) || 0;
  return el('button', { type: 'button', class: 'holding-row', onclick: () => ctx.openAction('holding_set', {
    asset_id: h.asset_id, goal_id: h.goal_id, so_luong: qty, gia_von_vnd: h.gia_von_vnd || undefined }) },
  el('span', {}, el('b', { text: h.ten }), el('small', { text: `Đang giữ ${String(qty).replace('.', ',')}${h.cap_nhat ? ` · cập nhật ${h.cap_nhat.slice(8, 10)}/${h.cap_nhat.slice(5, 7)}` : ''}` })),
  el('b', { text: formatShort(h.gia_tri_vnd) }));
}

function holdingsCards(payload, ctx) {
  const groups = new Map();
  for (const h of payload.holdings || []) groups.set(h.goal_id, [...(groups.get(h.goal_id) || []), h]);
  if (!groups.size) return card('Mo đang giữ gì', el('p', { class: 'muted', text: 'Chưa có số liệu. Bấm "Cập nhật số đang giữ" để thêm.' }));
  return [...groups].map(([goalId, rows]) => card(goalName(payload, goalId),
    ...rows.map((h) => holdingRow(h, ctx)),
    el('p', { class: 'card__hint', text: `Tổng ${formatVnd(rows.reduce((sum, h) => sum + (Number(h.gia_tri_vnd) || 0), 0))}` })));
}

export function renderLedger(view, payload, ctx) {
  const recent = [...(payload.recent || [])].sort((a, b) => String(b.ngay).localeCompare(String(a.ngay))).slice(0, 30);
  mount(view,
    el('div', { class: 'actions-main' },
      el('button', { type: 'button', class: 'action-tile action-tile--primary', onclick: () => ctx.openAction('contribution_gui') }, el('span', { text: '➕' }), 'Gửi tiền'),
      el('button', { type: 'button', class: 'action-tile', onclick: () => ctx.openAction('contribution_rut') }, el('span', { text: '➖' }), 'Rút tiền')),
    el('button', { type: 'button', class: 'btn btn--ghost btn--wide', text: '📦 Cập nhật số đang giữ', onclick: () => ctx.openAction('holding_set') }),
    holdingsCards(payload, ctx),
    card('30 lần ghi gần nhất', recent.length ? recent.map((row) => ledgerRow(payload, row)) : el('p', { class: 'muted', text: 'Chưa có lần ghi nào.' })));
}
