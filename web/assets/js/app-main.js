// Entry point: token gate, 5 tabs, load/refresh, and the submit → re-render loop. ?demo=1 skips the network.
import { el } from './dom-and-format-helpers.js';
import { isApiConfigured, captureToken, forgetToken, setToken, callApi } from './api-client-with-token.js';
import { renderOverview } from './overview-renderers.js';
import { renderGoals } from './goals-list-renderer.js';
import { renderLedger } from './ledger-tab-renderer.js';
import { renderBudget } from './budget-tab-renderer.js';
import { renderMarket } from './market-tab-renderer.js';
import { openActionForm } from './action-form-controller.js';
import { specFor } from './form-specs-registry.js';
import { openSettings } from './settings-panel.js';
import { demoCall } from './demo-api.js';

const RENDERERS = { overview: renderOverview, goals: renderGoals, ledger: renderLedger, budget: renderBudget, market: renderMarket };
const isDemo = new URLSearchParams(window.location.search).get('demo') === '1';
const api = isDemo ? demoCall : callApi;
const gate = document.getElementById('gate');
const tabbar = document.getElementById('tabbar');
const dateLabel = document.getElementById('today-label');
const state = { tab: 'overview', goalId: null };
// Each tab = a form host on top (forms open here) + a body that is rebuilt on every refresh.
const tabs = Object.fromEntries(Object.keys(RENDERERS).map((name) => {
  const view = document.getElementById(`view-${name}`);
  const host = el('div', { class: 'form-host' });
  const body = el('div');
  view.append(host, body);
  return [name, { view, host, body }];
}));
let payload = null;
let toastTimer = null;

function showGate(title, text) {
  gate.replaceChildren(el('h2', { text: title }), el('p', { class: 'muted', text }));
  gate.hidden = false;
  tabbar.hidden = true;
  Object.values(tabs).forEach((t) => { t.view.hidden = true; });
}

function toast(message, isError) {
  const box = document.getElementById('toast');
  box.textContent = message;
  box.className = `toast${isError ? ' toast--error' : ''}`;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, isError ? 6000 : 4000);
}

function selectTab(name) {
  state.tab = name;
  for (const [key, t] of Object.entries(tabs)) t.view.hidden = key !== name;
  tabbar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  window.scrollTo({ top: 0 });
}

function renderAll() {
  gate.hidden = true;
  tabbar.hidden = false;
  const [y, m, d] = payload.today.split('-');
  dateLabel.textContent = `${d}/${m}/${y}`;
  for (const [name, render] of Object.entries(RENDERERS)) render(tabs[name].body, payload, ctx);
}

/** unauthorized -> token is wrong, drop it. locked -> too many tries, keep the token and wait. */
function handleFailure(result) {
  if (result.locked) { showGate('Tạm khóa', result.error); return true; }
  if (result.unauthorized) { forgetToken(); showGate('Cần link riêng', result.error); return true; }
  return false;
}

async function load() {
  const result = await api('dashboard');
  if (!result.ok) {
    if (!handleFailure(result)) { if (payload) toast(result.error, true); else showGate('Chưa tải được', result.error); }
    return;
  }
  payload = result;
  renderAll();
  selectTab(state.tab);
}

async function submit(action, data, requestId = crypto.randomUUID()) {
  const result = await api(action, data, requestId);
  if (!result.ok) { handleFailure(result); if (result.error) toast(result.error, true); return result; }
  toast(result.message || 'Đã lưu.');
  if (result.summary) { payload = result; renderAll(); } else await load();
  return result;
}

function openAction(action, prefill = {}, tab = state.tab) {
  if (tab !== state.tab) selectTab(tab);
  const spec = specFor(action);
  const host = tabs[tab].host;
  openActionForm(host, action, spec, payload, { ...spec.defaults?.(payload), ...prefill }, {
    onSubmit: async (serverAction, data, requestId) => {
      const result = await submit(serverAction, data, requestId);
      if (result.ok) host.replaceChildren();
      return result;
    },
    onClose: () => host.replaceChildren()
  });
}

const ctx = {
  state, submit, toast, call: api, openAction,
  openGoal(id) { state.goalId = id; selectTab('goals'); renderGoals(tabs.goals.body, payload, ctx); },
  closeGoal() { state.goalId = null; tabs.goals.host.replaceChildren(); renderGoals(tabs.goals.body, payload, ctx); window.scrollTo({ top: 0 }); }
};

function init() {
  tabbar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tab]');
    if (button) selectTab(button.dataset.tab);
  });
  document.getElementById('refresh').addEventListener('click', () => { toast('Đang tải lại…'); load(); });
  document.getElementById('settings').addEventListener('click', () => { if (payload) openSettings(tabs[state.tab].host, payload, ctx); });
  if (isDemo) {
    toast('Đang xem thử. Số liệu mẫu, chưa lưu gì cả.');
    load();
    return;
  }
  if (!isApiConfigured()) {
    showGate('Chưa kết nối Google Sheet', 'Điền apiUrl trong assets/js/site-config.js sau khi triển khai Apps Script.');
    return;
  }
  const token = captureToken();
  if (!token) {
    showGate('Cần link riêng', 'Mở link có #t= mà Mo tạo từ Google Sheet. Mở 1 lần là điện thoại tự nhớ.');
    return;
  }
  setToken(token);
  tabs.overview.body.replaceChildren(el('p', { class: 'loading', text: 'Đang tải số liệu…' }));
  tabs.overview.view.hidden = false;
  load();
}

init();
