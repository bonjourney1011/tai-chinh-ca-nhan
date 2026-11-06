/**
 * Every write action is planned by a pure function that returns
 *   { appends: { Tab: [row, ...] }, updates: { Tab: [{ key, changes }] }, seq: { GOAL_SEQ: 7 } }
 * without touching the Sheet, so the logic is testable in Node. Only sheet-repository.gs writes a plan.
 * ctx = buildPlanContext(state, now, requestId).
 */
var ACTION_PLANNERS = {
  goal_save: function (data, ctx) { return planGoalSave(data, ctx); },
  goal_choose_plan: function (data, ctx) { return planGoalChoosePlan(data, ctx); },
  goal_set_status: function (data, ctx) { return planGoalSetStatus(data, ctx); },
  budget_save: function (data, ctx) { return planBudgetSave(data, ctx); },
  budget_delete: function (data, ctx) { return planBudgetDelete(data, ctx); },
  contribution_add: function (data, ctx) { return planContributionAdd(data, ctx); },
  holding_set: function (data, ctx) { return planHoldingSet(data, ctx); },
  price_manual_add: function (data, ctx) { return planPriceManualAdd(data, ctx); },
  config_save: function (data, ctx) { return planConfigSave(data, ctx); }
};

function planAction(action, data, ctx) {
  if (!Object.prototype.hasOwnProperty.call(ACTION_PLANNERS, action)) return { ok: false, error: 'Thao tác không hợp lệ.' };
  try {
    var result = ACTION_PLANNERS[action](data && typeof data === 'object' ? data : {}, ctx);
    return { ok: true, message: result.message, plan: result.plan, replayed: Boolean(result.replayed) };
  } catch (err) {
    if (err && err.userError) return { ok: false, error: err.userError };
    throw err;
  }
}

function fail(message) {
  throw { userError: message };
}

function emptyPlan() {
  return { appends: {}, updates: {}, seq: {} };
}

function appendTo(plan, tab, row) {
  (plan.appends[tab] = plan.appends[tab] || []).push(row);
}

function updateIn(plan, tab, key, changes) {
  (plan.updates[tab] = plan.updates[tab] || []).push({ key: key, changes: changes });
}

function planIsEmpty(plan) {
  return !Object.keys(plan.appends).length && !Object.keys(plan.updates).length;
}

/** Everything a planner may look at, taken from one read of the Sheet. state.seq = { goal, budget } counters. */
function buildPlanContext(state, now, requestId) {
  var today = startOfDay(now);
  var index = buildPriceIndex(state.assets || [], state.prices || [], state.manualPrices || [], state.config, today);
  var configKeys = {};
  (state.configRows || []).forEach(function (row) { configKeys[String(row.key).trim()] = true; });
  return {
    config: state.config, goals: state.goals || [], budget: state.budget || [], contributions: state.contributions || [],
    holdings: state.holdings || [], planRows: state.planRows || [], assets: state.assets || [],
    configKeys: configKeys, index: index.byId, tyGia: index.tyGia, seq: state.seq || {},
    today: today, now: now, requestId: requestId || ''
  };
}

function readText(value, label, min, max, required) {
  var text = cleanText(value, max + 1);
  if (!text && !required) return '';
  if (text.length < min) fail(label + ' cần ít nhất ' + min + ' ký tự.');
  if (text.length > max) fail(label + ' dài quá ' + max + ' ký tự.');
  return text;
}

/** Number with range checks; optional ones return the fallback when left blank. */
function readNumber(value, label, opts) {
  opts = opts || {};
  if (value === '' || value == null) {
    if (opts.required) fail('Thiếu ' + label + '.');
    return opts.fallback === undefined ? 0 : opts.fallback;
  }
  var number = Number(value);
  if (isNaN(number) || !isFinite(number)) fail(label + ' không hợp lệ.');
  if (opts.min !== undefined && number < opts.min) fail(label + ' không được nhỏ hơn ' + opts.min + '.');
  if (opts.max !== undefined && number > opts.max) fail(label + ' không được lớn hơn ' + opts.max + '.');
  return number;
}

/** Whole-đồng amount; max catches a slipped "tr" vs "k". */
function readMoney(value, label, required, max) {
  var number = readNumber(value, label, { required: required, min: 0 });
  if (required && number === 0) fail(label + ' phải lớn hơn 0.');
  if (number > max) fail(label + ' ' + formatShortVnd(number) + ' quá lớn, kiểm tra lại "tr" hay "k".');
  return Math.round(number);
}

function readChoice(value, options, label, fallback) {
  var text = cleanText(value, 40);
  if (!text && fallback) return fallback;
  if (options.indexOf(text) === -1) fail('Chọn ' + label + '.');
  return text;
}

/** Event day: defaults to today; back-dating is allowed (catch-up entry), the future is not. */
function readEventDate(value, ctx) {
  if (!value) return ctx.today;
  var date = parseIsoDate(value);
  if (!date) fail('Ngày không hợp lệ.');
  if (daysBetween(ctx.today, date) > 0) fail('Ngày không được ở tương lai.');
  if (daysBetween(date, ctx.today) > 3650) fail('Ngày quá xa, kiểm tra lại năm.');
  return date;
}

function findGoal(ctx, goalId, mustBeActive) {
  var wanted = cleanText(goalId, 20).toUpperCase();
  var goal = ctx.goals.filter(function (item) { return String(item.goal_id).toUpperCase() === wanted; })[0];
  if (!goal) fail('Không tìm thấy mục tiêu ' + (wanted || '(chưa chọn)') + '.');
  if (mustBeActive && goal.trang_thai !== 'dang') fail('Mục tiêu "' + goal.ten + '" không còn ở trạng thái đang theo dõi.');
  return goal;
}

function findAsset(ctx, assetId) {
  var wanted = cleanText(assetId, 30);
  var asset = ctx.assets.filter(function (item) { return String(item.asset_id) === wanted; })[0];
  if (!asset) fail('Chưa có tài sản "' + (wanted || '(chưa chọn)') + '" trong danh mục.');
  return asset;
}

function holdingKey(assetId, goalId) {
  return assetId + '|' + goalId;
}
