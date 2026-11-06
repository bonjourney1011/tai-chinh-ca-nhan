// Turns a declarative spec into a one-thumb form. Field types: choice (buttons), select (native list),
// money (parsed, live preview), number (decimal pad, min/max), date, text.
// Every field keeps its value in its own slot, keyed by spec.key || spec.name (so two fields may
// be sent under the same name, only the visible one goes out). Hidden fields are never sent.
import { el, formatVnd } from './dom-and-format-helpers.js';
import { parseMoney } from './money-input-parser.js';

export const slotOf = (spec) => spec.key || spec.name;
const isRequired = (spec, values, payload) => (typeof spec.required === 'function' ? spec.required(values, payload) : Boolean(spec.required));
const isVisible = (spec, values, payload) => !spec.showIf || Boolean(spec.showIf(values, payload));
const resolve = (value, payload, values) => (typeof value === 'function' ? value(payload, values) : value);
const asOption = (o) => (typeof o === 'object' ? o : { value: o, label: String(o) });

function labelFor(spec, values, payload) {
  return el('span', { class: 'field__label' }, spec.label, isRequired(spec, values, payload) ? el('em', { text: ' *' }) : null);
}

function buildChoice(f, ctx) {
  const { spec } = f;
  const slot = slotOf(spec);
  const group = el('div', { class: 'segmented', role: 'group' });
  const note = el('p', { class: 'field__preview' });
  f.body = el('div', {}, group, note);
  f.refresh = () => {
    const options = (spec.options(ctx.payload, ctx.values) || []).map(asOption);
    const current = options.find((o) => o.value === ctx.values[slot]);
    note.textContent = current?.hint || '';
    group.replaceChildren(...(options.length ? options.map((option) => el('button', {
      type: 'button', 'aria-pressed': String(ctx.values[slot] === option.value), text: option.label,
      onclick: () => {
        const same = ctx.values[slot] === option.value;
        ctx.values[slot] = same && !isRequired(spec, ctx.values, ctx.payload) ? undefined : option.value;
        ctx.changed(true);
      }
    })) : [el('p', { class: 'pick-empty', text: 'Chưa có lựa chọn nào.' })]));
  };
}

function buildSelect(f, ctx) {
  const { spec } = f;
  const slot = slotOf(spec);
  const select = el('select', { class: 'select' });
  select.addEventListener('change', () => { ctx.values[slot] = select.value || undefined; ctx.changed(true); });
  f.body = select;
  f.refresh = () => {
    const options = (spec.options(ctx.payload, ctx.values) || []).map(asOption);
    if (ctx.values[slot] != null && !options.some((o) => o.value === ctx.values[slot])) ctx.values[slot] = undefined;
    // A required select with one choice picks it, so the owner does not tap for nothing.
    if (ctx.values[slot] == null && options.length === 1 && isRequired(spec, ctx.values, ctx.payload)) ctx.values[slot] = options[0].value;
    select.replaceChildren(el('option', { value: '', text: options.length ? (spec.placeholder || 'Chọn…') : 'Chưa có lựa chọn nào' }),
      ...options.map((o) => el('option', { value: o.value, text: o.label })));
    select.value = ctx.values[slot] ?? '';
  };
}

function buildTyped(f, ctx) {
  const { spec } = f;
  const slot = slotOf(spec);
  const isMoney = spec.type === 'money';
  const isNumber = spec.type === 'number';
  const isDate = spec.type === 'date';
  const input = el('input', {
    type: isDate ? 'date' : 'text', inputmode: isMoney ? 'decimal' : (isNumber ? (spec.integer ? 'numeric' : 'decimal') : null),
    placeholder: spec.placeholder || (isMoney ? 'VD 12tr5, 800k, 1,5 tỷ' : null),
    min: isDate ? resolve(spec.min, ctx.payload, ctx.values) : null, max: isDate ? resolve(spec.max, ctx.payload, ctx.values) : null,
    autocomplete: 'off', enterkeyhint: 'done'
  });
  const preview = isMoney || isNumber ? el('p', { class: 'field__preview' }) : null;
  const read = () => {
    const raw = input.value.trim();
    if (isMoney) {
      const amount = parseMoney(input.value, spec.unit);
      ctx.values[slot] = amount ?? undefined;
      preview.textContent = raw ? (amount == null ? 'Không đọc được số, VD 12tr5 hoặc 1,5 tỷ' : `= ${formatVnd(amount)}`) : '';
    } else if (isNumber) {
      const n = raw ? Number(raw.replace(',', '.')) : undefined;
      ctx.values[slot] = Number.isFinite(n) ? n : undefined;
      preview.textContent = raw && ctx.values[slot] === undefined ? 'Không đọc được số.' : (spec.suffix && raw ? spec.suffix : '');
    } else ctx.values[slot] = raw || undefined;
  };
  const prefill = ctx.values[slot];
  if (prefill != null) input.value = isNumber ? String(prefill).replace('.', ',') : String(prefill);
  input.addEventListener('input', () => { read(); ctx.changed(false); });
  if (prefill != null) read();
  f.body = el('div', {}, input, preview);
  f.clear = () => { input.value = ''; if (preview) preview.textContent = ''; };
}

function buildInput(f, ctx) {
  const { spec } = f;
  if (spec.type === 'choice') buildChoice(f, ctx);
  else if (spec.type === 'select') buildSelect(f, ctx);
  else buildTyped(f, ctx);
  if (spec.hint) f.body = el('div', {}, f.body, el('p', { class: 'field__preview', text: spec.hint }));
}

/** Returns an error text for a bad number, or ''. */
function rangeError(spec, value) {
  if (spec.type !== 'number' || value == null) return '';
  if ((spec.min != null && value < spec.min) || (spec.max != null && value > spec.max)) return `"${spec.label}" phải từ ${spec.min ?? '…'} đến ${spec.max ?? '…'}.`;
  return '';
}

export function openActionForm(container, action, spec, payload, prefill, { onSubmit, onClose }) {
  const { __send: extraSend, ...initial } = prefill || {};
  const values = { ...initial };
  // Same id for every retry of this form; a new form (after a save) gets a new id.
  const requestId = crypto.randomUUID();
  const fields = spec.fields.map((fieldSpec) => ({ spec: fieldSpec }));
  const hint = el('p', { class: 'form-hint' });
  const error = el('p', { class: 'form-error', role: 'alert' });
  const ctx = { payload, values, changed: () => {} };

  const sync = (structural) => {
    if (structural) {
      for (const f of fields) {
        const show = isVisible(f.spec, values, payload);
        if (!show && f.visible) { delete values[slotOf(f.spec)]; f.clear?.(); }
        f.visible = show;
        f.wrap.hidden = !show;
        f.wrap.querySelector('.field__label')?.replaceWith(labelFor(f.spec, values, payload));
        if (show) f.refresh?.();
      }
    }
    hint.textContent = spec.hint ? spec.hint(payload, values) || '' : '';
    error.textContent = '';
  };
  ctx.changed = sync;

  const main = el('div');
  const more = el('details', { class: 'more' }, el('summary', { text: 'Thêm chi tiết' }));
  for (const f of fields) {
    buildInput(f, ctx);
    f.wrap = el('div', { class: 'field' }, labelFor(f.spec, values, payload), f.body);
    (f.spec.more ? more : main).append(f.wrap);
    if (f.spec.more && values[slotOf(f.spec)] != null) more.open = true;
  }

  const submit = el('button', { class: 'btn', type: 'submit', text: spec.submit });
  const form = el('form', { class: 'card form-panel', novalidate: true },
    el('div', { class: 'form-panel__head' },
      el('h2', { class: 'form-panel__title', text: `${spec.icon} ${spec.title}` }),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Đóng', text: '✕', onclick: onClose })),
    main, fields.some((f) => f.spec.more) ? more : null, hint, error, submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    let data = { ...spec.fixed, ...extraSend };
    for (const f of fields.filter((item) => item.visible)) {
      const value = values[slotOf(f.spec)];
      const empty = value == null || value === '' || (Array.isArray(value) && !value.length);
      if (empty && isRequired(f.spec, values, payload)) { error.textContent = `Thiếu "${f.spec.label}".`; return; }
      const bad = rangeError(f.spec, value);
      if (bad) { error.textContent = bad; return; }
      if (!empty && !f.spec.local) data[f.spec.sendAs || f.spec.name] = value;
    }
    const problem = spec.validate?.(data, values, payload);
    if (problem) { error.textContent = problem; return; }
    if (spec.shape) data = spec.shape(data);
    submit.disabled = true;
    submit.textContent = 'Đang lưu…';
    const result = await onSubmit(spec.action || action, data, requestId);
    submit.disabled = false;
    submit.textContent = spec.submit;
    if (!result.ok) error.textContent = result.error;
  });

  container.replaceChildren(form);
  sync(true);
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

