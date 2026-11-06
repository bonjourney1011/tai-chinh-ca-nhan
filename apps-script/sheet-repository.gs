/**
 * Reads and writes the tabs of the bound spreadsheet. Rows become objects keyed by the headers in
 * domain-constants.gs; columns are matched by position. The Python tabs (Assets, Prices_Latest, Plan,
 * Tracking) are only ever read, and may be missing or empty.
 */
var REQUIRED_FIELD = {
  Config: 'key', Goals: 'goal_id', Budget: 'budget_id', Contributions: 'loai', Holdings: 'asset_id',
  Manual_Prices: 'asset_id', Snapshot: 'ngay', Assets: 'asset_id', Prices_Latest: 'asset_id', Plan: 'goal_id', Tracking: 'goal_id'
};

function getSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Thiếu tab "' + name + '". Chạy setupSheets() trước.');
  return sheet;
}

function rowToObject_(headers, row, rowNumber) {
  var item = { _row: rowNumber };
  headers.forEach(function (header, index) {
    var value = row[index];
    item[header] = typeof value === 'string' ? value.replace(/^'/, '').trim() : (value === undefined ? '' : value);
  });
  return item;
}

/** Plain values for the Sheet: text columns stay text, formula-looking text gets a leading ' (sanitizeCell). */
function objectToRow_(headers, item) {
  return headers.map(function (header) {
    var value = item[header];
    return value == null ? '' : sanitizeCell(value);
  });
}

/** Rows of one tab as objects with _row; a missing tab is [] when optional, blank rows are skipped. */
function readTab_(name, headers, optional) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    if (optional) return [];
    throw new Error('Thiếu tab "' + name + '". Chạy setupSheets() trước.');
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var width = Math.max(1, Math.min(headers.length, sheet.getMaxColumns()));
  var required = REQUIRED_FIELD[name];
  return sheet.getRange(2, 1, lastRow - 1, width).getValues()
    .map(function (row, i) { return rowToObject_(headers, row, i + 2); })
    .filter(function (item) { return !required || (item[required] !== '' && item[required] != null); });
}

function readState() {
  var props = PropertiesService.getScriptProperties();
  var state = {};
  Object.keys(STATE_KEYS).forEach(function (tab) {
    state[STATE_KEYS[tab]] = readTab_(tab, HEADERS[tab], PYTHON_TABS.indexOf(tab) !== -1);
  });
  state.config = resolveConfig(configRowsToRaw(state.configRows));
  state.seq = { goal: Number(props.getProperty(SEQUENCES.goal.prop)) || 0, budget: Number(props.getProperty(SEQUENCES.budget.prop)) || 0 };
  return state;
}

function commitSequences_(plan) {
  var props = PropertiesService.getScriptProperties();
  Object.keys(plan.seq || {}).forEach(function (prop) { props.setProperty(prop, String(plan.seq[prop])); });
}

function rowKey_(tab, item) {
  return TAB_KEYS[tab].map(function (field) { return String(item[field]).toUpperCase(); }).join('|');
}

/**
 * Writes a plan. All appends go first (one batch per tab, ledger tab first), then the keyed updates:
 * if a later write fails, the Contributions ledger is still complete and the balance can be re-set.
 */
function applyPlan(plan, state) {
  WRITE_ORDER.forEach(function (tab) {
    var rows = plan.appends[tab];
    if (!rows || !rows.length) return;
    var sheet = getSheet_(tab);
    var headers = HEADERS[tab];
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length)
      .setValues(rows.map(function (row) { return objectToRow_(headers, row); }));
  });
  WRITE_ORDER.forEach(function (tab) {
    (plan.updates[tab] || []).forEach(function (update) {
      var current = state[STATE_KEYS[tab]].filter(function (item) { return rowKey_(tab, item) === String(update.key).toUpperCase(); })[0];
      if (!current) throw new Error('Không tìm thấy dòng ' + update.key + ' trong tab ' + tab);
      var merged = Object.assign({}, current, update.changes);
      getSheet_(tab).getRange(current._row, 1, 1, HEADERS[tab].length).setValues([objectToRow_(HEADERS[tab], merged)]);
    });
  });
}

/** One snapshot per day: a second run on the same day overwrites it. */
function writeSnapshot(today, summary) {
  var sheet = getSheet_(T.snapshot);
  var row = [today, summary.tong_tai_san];
  ASSET_GROUPS.forEach(function (group) { row.push(summary.theo_nhom[group]); });
  row.push(summary.no);
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var lastDate = sheet.getRange(lastRow, 1).getValue();
    if (isValidDate(lastDate) && daysBetween(lastDate, today) === 0) {
      sheet.getRange(lastRow, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sheet.getRange(lastRow + 1, 1, 1, row.length).setValues([row]);
}
