// "Lịch sử gửi" of one goal, loaded 20 rows at a time from the history action.
import { el } from './dom-and-format-helpers.js';
import { ledgerRow } from './goal-display-helpers.js';

const PAGE = 20;

export function renderHistoryCard(goal, payload, ctx) {
  const list = el('div');
  const status = el('p', { class: 'card__hint' });
  const more = el('button', { type: 'button', class: 'btn btn--ghost', text: 'Xem thêm', hidden: true });
  const open = el('button', { type: 'button', class: 'btn btn--ghost', text: 'Lịch sử gửi' });
  const body = el('div', { hidden: true }, list, status, more);
  let offset = 0;

  async function loadPage() {
    more.disabled = true;
    status.textContent = 'Đang tải…';
    const res = await ctx.call('history', { goal_id: goal.goal_id, offset, limit: PAGE });
    more.disabled = false;
    if (!res.ok) { status.textContent = res.error; return; }
    for (const row of res.rows || []) list.append(ledgerRow(payload, row, false));
    offset += (res.rows || []).length;
    const total = Number(res.total) || offset;
    status.textContent = total ? `Đã hiện ${offset} trên ${total} lần ghi.` : 'Chưa có lần gửi nào.';
    more.hidden = offset >= total;
  }

  more.addEventListener('click', loadPage);
  open.addEventListener('click', () => {
    body.hidden = !body.hidden;
    if (!body.hidden && !offset) loadPage();
  });
  return el('section', { class: 'card' }, open, body);
}
