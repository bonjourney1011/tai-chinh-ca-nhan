// The Sheet is the contract between Apps Script and Python: compare domain-constants.gs with tabs.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadGs, plain } from './load-apps-script-sandbox.mjs';

const gs = loadGs();
const python = readFileSync(new URL('../src/taichinh/sheets/tabs.py', import.meta.url), 'utf8');

const quoted = (text) => [...text.matchAll(/"([^"]*)"/g)].map((m) => m[1]);

function tabNames() {
  const names = {};
  for (const m of python.matchAll(/^([A-Z_]+) = "(\w+)"$/gm)) names[m[1]] = m[2];
  return names;
}

function pythonHeaders() {
  const names = tabNames();
  const block = python.slice(python.indexOf('HEADERS: dict'));
  const headers = {};
  for (const m of block.matchAll(/^\s{4}([A-Z_]+): \(([^)]*)\),?$/gms)) headers[names[m[1]]] = quoted(m[2]);
  return headers;
}

test('every tab header list equals tabs.py, in the same order', () => {
  const py = pythonHeaders();
  assert.equal(Object.keys(py).length, 12);
  for (const [tab, headers] of Object.entries(py)) assert.deepEqual(plain(gs.HEADERS[tab]), headers, tab);
  assert.deepEqual(Object.keys(plain(gs.HEADERS)).sort(), Object.keys(py).sort());
});

test('tab ownership matches INPUT_TABS / RESULT_TABS and enums match tabs.py', () => {
  const names = tabNames();
  const tuple = (name) => quoted(python.match(new RegExp(`^${name} = \\(([^)]*)\\)`, 'm'))[1]);
  const pyTuple = (name) => python.match(new RegExp(`^${name} = \\(([^)]*)\\)`, 'm'))[1].split(',').map((s) => s.trim()).filter(Boolean).map((k) => names[k]);
  assert.deepEqual(plain(gs.APPS_SCRIPT_TABS), pyTuple('INPUT_TABS'));
  assert.deepEqual(plain(gs.PYTHON_TABS), pyTuple('RESULT_TABS'));
  assert.deepEqual(plain(gs.RISK_PROFILES), tuple('RISK_PROFILES'));
  assert.deepEqual(plain(gs.PLAN_OPTIONS), tuple('PLAN_OPTIONS'));
  assert.deepEqual(plain(gs.GOAL_STATUS), tuple('GOAL_STATUS'));
  assert.deepEqual(plain(gs.BUDGET_TYPES), tuple('BUDGET_TYPES'));
});

test('keys, text columns and write order only name real columns', () => {
  for (const [tab, keys] of Object.entries(plain(gs.TAB_KEYS))) for (const k of keys) assert.ok(gs.HEADERS[tab].includes(k), `${tab}.${k}`);
  for (const [tab, fields] of Object.entries(plain(gs.TEXT_FIELDS))) for (const f of fields) assert.ok(gs.HEADERS[tab].includes(f), `${tab}.${f}`);
  for (const tab of plain(gs.WRITE_ORDER)) assert.ok(plain(gs.APPS_SCRIPT_TABS).includes(tab), tab);
});

test('Config keys and defaults follow the agreed contract', () => {
  assert.deepEqual(plain(gs.CONFIG_DEFAULTS), {
    cpi_pct: 0.045, ho_so_mac_dinh: 'can_bang', quy_khan_cap_thang_min: 3, lech_phan_bo_pp: 5, du_lieu_cu_ngay: 35,
    ky_vong_loi_nhuan_bao_thu: 0.055, ky_vong_loi_nhuan_can_bang: 0.08, ky_vong_loi_nhuan_tang_truong: 0.11,
    ty_gia_usd_du_phong: 25000, gui_toi_da_1_lan: 5000000000, kich_ban: 'base', tai_san_nuoc_ngoai: 0, site_url: '', sheet_url: ''
  });
});

test('sanitizeCell blocks formula injection but leaves numbers and dates alone', () => {
  assert.equal(gs.sanitizeCell('=HYPERLINK("x")'), "'=HYPERLINK(\"x\")");
  assert.equal(gs.sanitizeCell('-5'), "'-5");
  assert.equal(gs.sanitizeCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(gs.sanitizeCell(-5), -5);
  assert.equal(gs.sanitizeCell('Mua nhà'), 'Mua nhà');
});
