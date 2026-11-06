// Tab 5 Thị trường: how fresh the data is + one table of prices and rates; stale rows flagged.
import { el, card, mount, formatVnd, formatUsd, formatDate } from './dom-and-format-helpers.js';
import { GROUP_LABELS } from './goal-display-helpers.js';

const rate = (value) => `${String(Number(value) || 0).replace('.', ',')}%/năm`;

function valueText(row) {
  if (row.loai_gia === 'lai_suat') return rate(row.lai_suat_nam);
  return row.tien_te === 'USD' ? formatUsd(row.gia) : formatVnd(row.gia);
}

function marketRow(row) {
  return el('tr', { class: row.cu ? 'is-stale' : null },
    el('td', {}, el('b', { text: row.ten }), el('small', { text: `${GROUP_LABELS[row.nhom] || row.nhom || ''}${row.nhap_tay ? ' · nhập tay' : ''}` })),
    el('td', { text: valueText(row) }),
    el('td', {}, row.cu ? el('span', { class: 'stale-flag', text: '⚠ ' }) : null, formatDate(row.ngay_gia).slice(0, 5) || '—'));
}

export function renderMarket(view, payload, ctx) {
  const asOf = payload.data_as_of || {};
  const stale = (payload.market || []).filter((r) => r.cu).length;
  const canEnter = (payload.lists?.assets || []).some((a) => a.nhap_tay);
  mount(view,
    card('Số liệu cập nhật đến đâu',
      el('ul', { class: 'bridge' },
        el('li', {}, el('span', { text: 'Giá và lãi suất' }), el('b', { text: formatDate(asOf.prices) || 'chưa có' })),
        el('li', {}, el('span', { text: 'Kế hoạch gần nhất' }), el('b', { text: formatDate(asOf.plan) || 'chưa có' })),
        el('li', {}, el('span', { text: 'Số anh đang giữ' }), el('b', { text: formatDate(asOf.tracking) || 'chưa có' }))),
      asOf.stale_days > 0 || stale ? el('p', { class: 'warn-note', text: `⚠ Có ${stale || 'một số'} giá đã cũ${asOf.stale_days > 0 ? ` (${asOf.stale_days} ngày)` : ''}. Anh nhập giá mới để kế hoạch chính xác hơn.` }) : null),
    canEnter ? el('button', { type: 'button', class: 'btn', text: 'Nhập giá / lãi suất', onclick: () => ctx.openAction('price_manual_add') }) : null,
    card('Giá và lãi suất',
      (payload.market || []).length
        ? el('div', { class: 'table-scroll' }, el('table', { class: 'mini-table market-table' },
          el('thead', {}, el('tr', {}, el('th', { text: 'Loại' }), el('th', { text: 'Giá / lãi' }), el('th', { text: 'Ngày' }))),
          el('tbody', {}, payload.market.map(marketRow))))
        : el('p', { class: 'muted', text: 'Chưa có giá nào.' })));
}
