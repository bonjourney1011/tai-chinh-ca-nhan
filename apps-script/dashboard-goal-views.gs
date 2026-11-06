/**
 * Pure: one JSON-safe view per goal (progress, tracking, the three Python plans, drift).
 * Python tabs (Plan / Tracking) may be empty: the view then falls back to the quick estimate.
 */
var MAX_PROGRESS_PCT = 999;

function readFlagOrNull(value) {
  if (value === '' || value == null) return null;
  if (value === true || value === false) return value;
  var text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'x'].indexOf(text) !== -1) return true;
  return ['0', 'false', 'no'].indexOf(text) !== -1 ? false : null;
}

/** Latest Tracking row per goal (later date wins; same date: lower row in the tab is overwritten). */
function latestTrackingByGoal(rows) {
  var latest = {};
  (rows || []).forEach(function (r) {
    var id = String(r.goal_id || '').toUpperCase();
    if (!id) return;
    var day = toDayOrNull(r.ngay);
    var prev = latest[id];
    if (!prev || !day || !prev.day || day.getTime() >= prev.day.getTime()) latest[id] = { day: day, row: r };
  });
  return latest;
}

function buildPlanViews(planRows, goalId, index) {
  var byOption = {};
  (planRows || []).forEach(function (r) {
    if (String(r.goal_id).toUpperCase() === String(goalId).toUpperCase() && PLAN_OPTIONS.indexOf(r.phuong_an) !== -1) byOption[r.phuong_an] = r;
  });
  return PLAN_OPTIONS.filter(function (o) { return byOption[o]; }).map(function (option) {
    var r = byOption[option];
    return {
      phuong_an: option, gui_hang_thang: Math.round(toNumberOrZero(r.gui_hang_thang)), gui_de_dat_80: Math.round(toNumberOrZero(r.gui_de_dat_80)),
      xac_suat_dat: roundTo(r.xac_suat_dat, 3),
      ket_qua: { thap: Math.round(toNumberOrZero(r.ket_qua_thap)), co_so: Math.round(toNumberOrZero(r.ket_qua_co_so)), cao: Math.round(toNumberOrZero(r.ket_qua_cao)) },
      phan_bo: parsePhanBo(r.phan_bo_json, index), ly_do: cleanText(r.ly_do, 300)
    };
  });
}

function sumDepositedThisMonth(contributions, goalId, today) {
  return (contributions || []).reduce(function (sum, c) {
    var day = toDayOrNull(c.ngay);
    var same = day && day.getFullYear() === today.getFullYear() && day.getMonth() === today.getMonth();
    return same && c.loai === 'gui' && String(c.goal_id).toUpperCase() === String(goalId).toUpperCase() ? sum + toNumberOrZero(c.so_tien_vnd) : sum;
  }, 0);
}

/** Python's Tracking.lech_phan_bo_json = [{asset_id, lech_pct}] (actual - target, 0-1); else drift from live holdings. */
function driftFor(held, chosen, trackRow) {
  var data = [];
  try { data = JSON.parse((trackRow && trackRow.lech_phan_bo_json) || '[]'); } catch (err) { data = []; }
  if (!Array.isArray(data) || !data.length) return computeDrift(held, chosen.phan_bo);
  return data.filter(function (d) { return d && d.asset_id && isFinite(Number(d.lech_pct)); }).map(function (d) {
    var target = chosen.phan_bo.filter(function (p) { return p.asset_id === String(d.asset_id); })[0];
    var goal = target ? target.pct : 0;
    return { asset_id: String(d.asset_id), muc_tieu_pct: goal, hien_tai_pct: roundTo(goal + Number(d.lech_pct) * 100, 1) };
  });
}

function buildGoalView(goal, state, c) {
  var deadline = toDayOrNull(goal.ngay_dich);
  var active = goal.trang_thai === 'dang';
  var held = goalHoldingValue(c.valued, goal.goal_id);
  var value = toNumberOrZero(goal.tien_co_san) + vndToGoalCurrency(held.total, goal, c.tyGia);
  var target = toNumberOrZero(goal.so_tien_dich);
  var plans = active ? buildPlanViews(state.planRows, goal.goal_id, c.index) : [];
  var tracking = c.tracking[String(goal.goal_id).toUpperCase()];
  var trackRow = tracking ? tracking.row : null;
  var estimate = active ? estimateMonthlyVnd(goal, value, c.today, state.config, c.tyGia) : 0;
  var chosen = plans.filter(function (p) { return p.phuong_an === goal.phuong_an_chon; })[0];
  var proposed = trackRow && trackRow.gui_thang_nay_de_xuat !== '' && trackRow.gui_thang_nay_de_xuat != null
    ? toNumberOrZero(trackRow.gui_thang_nay_de_xuat) : (chosen ? chosen.gui_hang_thang : estimate);
  var lechThang = trackRow && trackRow.lech_thang !== '' && trackRow.lech_thang != null ? roundTo(trackRow.lech_thang, 1) : null;
  return {
    goal_id: String(goal.goal_id), ten: String(goal.ten), so_tien_dich: target, tien_te: isUsdGoal(goal) ? 'USD' : 'VND',
    ngay_dich: formatIsoDate(deadline), con_thang: deadline ? monthsUntil(c.today, deadline) : 0,
    tien_co_san: toNumberOrZero(goal.tien_co_san), ghi_chu: String(goal.ghi_chu || ''), ho_so_rui_ro: String(goal.ho_so_rui_ro), uu_tien: String(goal.uu_tien || 'vua'),
    phuong_an_chon: String(goal.phuong_an_chon || ''), trang_thai: String(goal.trang_thai),
    gia_tri_hien_tai: roundTo(value, isUsdGoal(goal) ? 2 : 0), tien_do_pct: target > 0 ? Math.min(MAX_PROGRESS_PCT, roundTo(value / target * 100, 1)) : 0,
    on_track: trackRow ? readFlagOrNull(trackRow.on_track) : null, lech_thang: lechThang,
    gui_thang_nay: { de_xuat: active ? Math.round(proposed) : 0, da_gui: Math.round(sumDepositedThisMonth(state.contributions, goal.goal_id, c.today)) },
    uoc_tinh_nhanh: estimate, plans: plans,
    lech_phan_bo: chosen ? driftFor(held, chosen, trackRow) : []
  };
}

function buildGoalViews(state, c) {
  c.tracking = latestTrackingByGoal(state.tracking);
  return (state.goals || []).filter(function (g) { return g.goal_id; }).map(function (g) { return buildGoalView(g, state, c); });
}
