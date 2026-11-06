// Small shared helpers. All dynamic text goes through textContent, never innerHTML.

export const formatVnd = (amount) => {
  const value = Math.round(Number(amount) || 0);
  return `${value < 0 ? '-' : ''}${String(Math.abs(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
};

/** 12500000 -> "12,5tr", 800000 -> "800k": how the owner talks about prices. */
export const formatShort = (amount) => {
  const value = Math.round(Number(amount) || 0);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}${String(Math.round(abs / 1e7) / 100).replace('.', ',')} tỷ`;
  if (abs >= 1e6) return `${sign}${String(Math.round(abs / 1e5) / 10).replace('.', ',')}tr`;
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}k`;
  return `${sign}${abs}đ`;
};

export const formatUsd = (amount) => `${Number(amount) < 0 ? '-' : ''}$${String(Math.round(Math.abs(Number(amount) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

/** Money in a goal's own currency: VND short ("1,5 tỷ") or USD ("$20,000"). */
export const formatMoney = (amount, currency) => (currency === 'USD' ? formatUsd(amount) : formatShort(amount));

/** 30 -> "2 năm 6 tháng", 5 -> "5 tháng". */
export function formatMonths(months) {
  const total = Math.max(0, Math.round(Number(months) || 0));
  const years = Math.floor(total / 12);
  const rest = total % 12;
  if (!years) return `${rest} tháng`;
  return rest ? `${years} năm ${rest} tháng` : `${years} năm`;
}

/** Percent already on a 0..100 scale -> clamped to 0..100. */
export const clampPct = (value) => Math.max(0, Math.min(100, Number(value) || 0));

/** Ratio (0..1) or percent (>1) -> percent number. */
export const ratioToPct = (value) => { const n = Number(value) || 0; return n > 1 ? n : n * 100; };

export const formatDate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

export const formatSigned = (amount) => (amount > 0 ? `+${formatShort(amount)}` : formatShort(amount));

export const formatPct = (ratio, digits = 0) =>
  `${(Math.round((Number(ratio) || 0) * 100 * 10 ** digits) / 10 ** digits).toString().replace('.', ',')}%`;

export const formatDayMonth = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

export const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** el('p', { class: 'note', text: 'hi' }, child1, child2) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child != null && child !== false) node.append(child);
  }
  return node;
}

export function card(title, ...children) {
  return el('section', { class: 'card' }, title ? el('h2', { class: 'card__title', text: title }) : null, ...children);
}

/** Horizontal progress bar; tone = 'good' | 'warn' | ''. */
export function progressBar(pct, tone = '') {
  const fill = el('i', { class: `progress__fill${tone ? ` progress__fill--${tone}` : ''}` });
  fill.style.width = `${clampPct(pct)}%`;
  return el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(clampPct(pct))) }, fill);
}

/** replaceChildren that skips null/false entries (a bare null would be written as the text "null"). */
export const mount = (parent, ...nodes) => parent.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false));
