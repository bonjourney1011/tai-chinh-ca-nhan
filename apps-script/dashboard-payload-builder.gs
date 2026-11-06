/**
 * Pure: shapes everything the page needs into one JSON-safe object (under ~100 KB).
 * Dates leave as "yyyy-mm-dd" strings: JSON.stringify(Date) would shift them to UTC.
 */
var TREND_POINTS = 120;
var RECENT_CONTRIBUTIONS = 30;
var HISTORY_MAX_LIMIT = 200;
// CacheService holds ~100 KB per value (bytes); stay under it in characters with room for accents.
var PAYLOAD_SOFT_LIMIT_CHARS = 90000;

function formatContribution(c, state) {
  var asset = (state.assets || []).filter(function (a) { return String(a.asset_id) === String(c.asset_id); })[0];
  var goal = (state.goals || []).filter(function (g) { return String(g.goal_id) === String(c.goal_id); })[0];
  return {
    thoi_gian: isValidDate(c.thoi_gian) ? formatIsoDateTime(c.thoi_gian) : String(c.thoi_gian || ''),
    ngay: formatIsoDate(toDayOrNull(c.ngay)), loai: String(c.loai), goal_id: String(c.goal_id), ten_muc_tieu: goal ? String(goal.ten) : '',
    asset_id: String(c.asset_id), ten_tai_san: asset ? String(asset.ten) : String(c.asset_id),
    so_tien_vnd: toNumberOrZero(c.so_tien_vnd), so_luong: toNumberOrZero(c.so_luong), gia_don_vi: toNumberOrZero(c.gia_don_vi),
    ghi_chu: String(c.ghi_chu || '')
  };
}

/** Contributions newest first, optionally for one goal, paged. */
function buildHistory(state, data) {
  var goalId = cleanText(data && data.goal_id, 20).toUpperCase();
  var offset = Math.max(0, Math.floor(Number(data && data.offset) || 0));
  var limit = Math.min(HISTORY_MAX_LIMIT, Math.max(1, Math.floor(Number(data && data.limit) || 50)));
  var rows = (state.contributions || []).filter(function (c) {
    return c.loai && (!goalId || String(c.goal_id).toUpperCase() === goalId);
  }).reverse();
  return { ok: true, rows: rows.slice(offset, offset + limit).map(function (c) { return formatContribution(c, state); }), total: rows.length };
}

function latestDate(rows, field) {
  var best = null;
  (rows || []).forEach(function (r) {
    var day = toDayOrNull(r[field]);
    if (day && (!best || day.getTime() > best.getTime())) best = day;
  });
  return best;
}

function buildTrend(snapshots, summary, today) {
  var todayIso = formatIsoDate(today);
  var points = (snapshots || []).filter(function (s) { return toDayOrNull(s.ngay); }).map(function (s) {
    var p = { ngay: formatIsoDate(toDayOrNull(s.ngay)), tong: toNumberOrZero(s.tong), no: toNumberOrZero(s.no) };
    ASSET_GROUPS.forEach(function (g) { p[g] = toNumberOrZero(s[g]); });
    return p;
  }).filter(function (p) { return p.ngay !== todayIso; }).slice(-(TREND_POINTS - 1));
  var live = { ngay: todayIso, tong: summary.tong_tai_san, no: summary.no };
  ASSET_GROUPS.forEach(function (g) { live[g] = summary.theo_nhom[g]; });
  points.push(live);
  return points;
}

function monthStartTotal(snapshots, today) {
  var monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  var before = (snapshots || []).filter(function (s) { var d = toDayOrNull(s.ngay); return d && d.getTime() < monthStart.getTime(); });
  return before.length ? toNumberOrZero(before[before.length - 1].tong) : null;
}

function buildMarket(index) {
  return Object.keys(index).map(function (id) {
    var e = index[id];
    return { asset_id: id, ten: e.ten, nhom: e.nhom, tien_te: e.tien_te, loai_gia: e.loai_gia, gia: e.gia, lai_suat_nam: e.lai_suat_nam,
      ngay_gia: formatIsoDate(e.ngay_gia), nguon: e.nguon, cu: e.cu, nhap_tay: e.nhap_tay };
  });
}

/** Very large accounts: drop the lowest-value detail first (allocation reasons, then old trend points, then recent rows). */
function fitPayload(dash) {
  var steps = [
    function () { dash.goals.forEach(function (g) { g.plans.forEach(function (p) { p.phan_bo.forEach(function (a) { a.ly_do = ''; }); }); }); },
    function () { dash.trend = dash.trend.slice(-TREND_POINTS / 2); },
    function () { dash.recent = dash.recent.slice(0, RECENT_CONTRIBUTIONS / 3); }
  ];
  for (var i = 0; i < steps.length && JSON.stringify(dash).length > PAYLOAD_SOFT_LIMIT_CHARS; i++) steps[i]();
  return dash;
}

function buildDashboardPayload(state, today) {
  var config = state.config;
  var priceIndex = buildPriceIndex(state.assets, state.prices, state.manualPrices, config, today);
  var valued = valueHoldings(state.holdings, priceIndex.byId, priceIndex.tyGia);
  var byGroup = sumByGroup(valued);
  var c = { today: today, index: priceIndex.byId, tyGia: priceIndex.tyGia, valued: valued };
  var goals = buildGoalViews(state, c);
  var budget = computeBudgetMetrics(state.budget, { liquid: byGroup.tien_gui + byGroup.trai_phieu, goals: goals, config: config, tyGia: priceIndex.tyGia });
  var priceDate = latestDate(state.prices, 'ngay_gia');
  var dataAsOf = {
    prices: formatIsoDate(priceDate), plan: formatIsoDate(latestDate(state.planRows, 'run_at')),
    tracking: formatIsoDate(latestDate(state.tracking, 'ngay')), stale_days: priceDate ? Math.max(0, daysBetween(priceDate, today)) : null
  };
  var total = valued.reduce(function (s, v) { return s + v.gia_tri_vnd; }, 0);
  var startTotal = monthStartTotal(state.snapshots, today);
  var active = goals.filter(function (g) { return g.trang_thai === 'dang'; });
  var debt = activeBudgetRows(state.budget).filter(function (r) { return r.loai === 'no'; }).reduce(function (s, r) { return s + toNumberOrZero(r.so_tien); }, 0);
  var summary = {
    tong_tai_san: total, doi_dau_thang: startTotal === null ? null : total - startTotal, theo_nhom: byGroup, no: Math.round(debt),
    quy_khan_cap_thang: budget.metrics.quy_khan_cap_thang,
    can_gui_thang_nay: active.filter(function (g) { return g.uu_tien !== 'thap'; })
      .reduce(function (s, g) { return s + g.gui_thang_nay.de_xuat; }, 0),
    da_gui_thang_nay: active.reduce(function (s, g) { return s + g.gui_thang_nay.da_gui; }, 0)
  };
  return fitPayload({
    ok: true, today: formatIsoDate(today), data_as_of: dataAsOf, summary: summary,
    alerts: buildAlerts({ config: config, goals: goals, metrics: budget.metrics, dataAsOf: dataAsOf }),
    goals: goals, holdings: valued.map(function (v) { return Object.assign({}, v, { cap_nhat: formatIsoDate(v.cap_nhat) }); }),
    recent: (state.contributions || []).filter(function (r) { return r.loai; }).slice(-RECENT_CONTRIBUTIONS).reverse()
      .map(function (r) { return formatContribution(r, state); }),
    budget: budget, market: buildMarket(priceIndex.byId), trend: buildTrend(state.snapshots, summary, today),
    lists: {
      assets: (state.assets || []).filter(function (a) { return a.asset_id; }).map(function (a) {
        return { asset_id: String(a.asset_id), ten: String(a.ten || a.asset_id), nhom: groupOf(a.nhom), nhap_tay: isTruthyFlag(a.nhap_tay), loai_gia: String(a.loai_gia || 'gia') };
      }),
      goals_active: active.map(function (g) { return { goal_id: g.goal_id, ten: g.ten }; })
    },
    settings: {
      cpi_pct: config.cpi_pct, ho_so_mac_dinh: config.ho_so_mac_dinh, ky_vong_loi_nhuan: expectedReturn(config, config.ho_so_mac_dinh), quy_khan_cap_thang_min: config.quy_khan_cap_thang_min,
      lech_phan_bo_pp: config.lech_phan_bo_pp, du_lieu_cu_ngay: config.du_lieu_cu_ngay, ty_gia_usd: priceIndex.tyGia, sheet_url: config.sheet_url
    }
  });
}
