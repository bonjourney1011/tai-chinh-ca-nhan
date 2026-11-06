// Tab 4 Ngân sách: monthly numbers, advice (cut spending or earn more), editable lists by kind.
import { el, card, mount, formatShort, ratioToPct, formatMonths } from './dom-and-format-helpers.js';
import { BUDGET_KINDS, budgetPrefill } from './form-specs-budget-and-settings.js';
import { goalName } from './goal-display-helpers.js';

const kpi = (label, value, tone = '') => el('div', { class: 'kpi' }, el('p', { class: 'kpi__label', text: label }), el('p', { class: `kpi__value ${tone}`, text: value }));

function metricsCard(m) {
  const verdict = m.kha_thi ? `Đủ gửi ${formatShort(m.can_gui)}/tháng ✓` : `Thiếu ${formatShort(m.thieu)}/tháng`;
  return card('Mỗi tháng của anh',
    el('div', { class: 'kpis' },
      kpi('Thu', formatShort(m.thu_thang), 'pos'), kpi('Chi', formatShort(m.chi_thang)),
      kpi('Còn dư', formatShort(m.du_thang), m.du_thang < 0 ? 'neg' : ''), kpi('Tiết kiệm được', `${Math.round(ratioToPct(m.ty_le_tiet_kiem))}%`),
      kpi('Quỹ khẩn cấp', `${String(Math.round((Number(m.quy_khan_cap_thang) || 0) * 10) / 10).replace('.', ',')} tháng chi`)),
    el('p', { class: `verdict ${m.kha_thi ? 'verdict--ok' : 'verdict--short'}`, text: verdict }));
}

function adviceCard(budget, payload) {
  const { metrics: m, levers = [] } = budget;
  if (!m.ly_do && !levers.length) return null;
  const title = m.huong === 'tang_thu' ? 'Anh nên tăng thu nhập' : 'Anh nên cắt bớt chi';
  return card(title, m.ly_do ? el('p', { text: m.ly_do }) : null,
    levers.length ? el('ol', { class: 'levers' }, levers.map((l) => el('li', {},
      el('b', { text: l.ten }),
      el('small', { text: `Tiết kiệm ${formatShort(l.tiet_kiem_thang)}/tháng${l.som_hon_thang ? `, đạt "${goalName(payload, l.goal_id)}" sớm hơn ${formatMonths(l.som_hon_thang)}` : ''}` })))) : null);
}

function kindCard(kind, rows, ctx) {
  return card(kind.label,
    ...rows.map((r) => el('div', { class: 'budget-row' },
      el('button', { type: 'button', class: 'budget-row__main', onclick: () => ctx.openAction('budget_save', budgetPrefill(r)) },
        el('b', { text: r.ten }),
        el('small', { text: `${r.chu_ky === 'nam' ? 'mỗi năm' : 'mỗi tháng'}${r.lai_suat_nam ? ` · lãi ${r.lai_suat_nam}%/năm` : ''}` })),
      el('b', { text: formatShort(r.so_tien) }),
      el('button', { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': `Xóa ${r.ten}`, text: 'Xóa',
        onclick: () => { if (window.confirm(`Xóa "${r.ten}"?`)) ctx.submit('budget_delete', { budget_id: r.budget_id }); } }))),
    !rows.length ? el('p', { class: 'muted', text: 'Chưa có khoản nào.' }) : null,
    el('button', { type: 'button', class: 'btn btn--ghost', text: `＋ Thêm ${kind.label.toLowerCase()}`, onclick: () => ctx.openAction('budget_save', { loai: kind.value }) }));
}

export function renderBudget(view, payload, ctx) {
  const budget = payload.budget || { rows: [], metrics: {}, levers: [] };
  mount(view,
    metricsCard(budget.metrics || {}), adviceCard(budget, payload),
    BUDGET_KINDS.map((k) => kindCard(k, (budget.rows || []).filter((r) => r.loai === k.value), ctx)));
}
