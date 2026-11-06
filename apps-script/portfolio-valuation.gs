/**
 * Pure: prices (Prices_Latest overlaid by Manual_Prices), holdings x prices, values by group and drift.
 * Amounts are VND unless a name says otherwise. Quantities of deposit-type assets (loai_gia = lai_suat) are đồng.
 */

function groupOf(nhom) {
  return ASSET_GROUPS.indexOf(nhom) === -1 ? 'khac' : nhom;
}

/**
 * byId[asset_id] = { asset_id, ten, nhom, tien_te, loai_gia, nhap_tay, gia, lai_suat_nam (percent|null),
 *   ngay_gia (Date|null), nguon, thu_cong, cu }. tyGia = USD/VND from the USDVND row, else the Config fallback.
 */
function buildPriceIndex(assets, prices, manualPrices, config, today) {
  var byId = {};
  function entryFor(id) {
    if (!byId[id]) byId[id] = { asset_id: id, ten: id, nhom: 'khac', tien_te: 'VND', loai_gia: 'gia', nhap_tay: false, gia: 0, lai_suat_nam: null, ngay_gia: null, nguon: '', thu_cong: false, cu: false };
    return byId[id];
  }
  (assets || []).forEach(function (a) {
    if (!a.asset_id) return;
    var e = entryFor(String(a.asset_id));
    e.ten = String(a.ten || a.asset_id); e.nhom = groupOf(a.nhom); e.tien_te = String(a.tien_te || 'VND').toUpperCase();
    e.loai_gia = String(a.loai_gia || 'gia'); e.nhap_tay = isTruthyFlag(a.nhap_tay);
  });
  (prices || []).forEach(function (p) {
    if (!p.asset_id) return;
    var e = entryFor(String(p.asset_id));
    if (e.ten === e.asset_id && p.ten) e.ten = String(p.ten);
    if (e.nhom === 'khac' && p.nhom) e.nhom = groupOf(p.nhom);
    if (p.tien_te) e.tien_te = String(p.tien_te).toUpperCase();
    e.gia = toNumberOrZero(p.gia);
    e.lai_suat_nam = readRatePercent(p.lai_suat_nam);
    e.ngay_gia = toDayOrNull(p.ngay_gia);
    e.nguon = String(p.nguon || '');
  });
  var latestManual = {};
  (manualPrices || []).forEach(function (m, i) {
    var day = toDayOrNull(m.ngay);
    var id = String(m.asset_id || '');
    if (!id || !day) return;
    var prev = latestManual[id];
    if (!prev || day.getTime() >= prev.day.getTime()) latestManual[id] = { day: day, row: m };
  });
  Object.keys(latestManual).forEach(function (id) {
    var e = entryFor(id);
    var m = latestManual[id];
    if (e.ngay_gia && m.day.getTime() < e.ngay_gia.getTime()) return;
    if (toNumberOrZero(m.row.gia) > 0) e.gia = toNumberOrZero(m.row.gia);
    var rate = readRatePercent(m.row.lai_suat_nam);
    if (rate !== null) e.lai_suat_nam = rate;
    e.ngay_gia = m.day; e.nguon = 'Nhập tay'; e.thu_cong = true;
  });
  Object.keys(byId).forEach(function (id) {
    var e = byId[id];
    e.cu = !e.ngay_gia || daysBetween(e.ngay_gia, today) > config.du_lieu_cu_ngay;
  });
  var usd = byId.USDVND ? byId.USDVND.gia : 0;
  return { byId: byId, tyGia: usd > 0 ? usd : config.ty_gia_usd_du_phong };
}

/** VND for one unit; 0 when no price is known. Deposit-type assets count 1 per đồng. */
function unitPriceVnd(entry, tyGia) {
  if (!entry) return 0;
  if (String(entry.loai_gia).toLowerCase() === 'lai_suat') return 1;
  if (!(entry.gia > 0)) return 0;
  return entry.tien_te === 'USD' ? entry.gia * tyGia : entry.gia;
}

/** Holdings with a VND value. No price yet: value falls back to cost so the total does not drop to zero. */
function valueHoldings(holdings, index, tyGia) {
  var rows = [];
  (holdings || []).forEach(function (h) {
    var qty = toNumberOrZero(h.so_luong);
    if (!h.asset_id || qty <= 1e-9) return;
    var entry = index[h.asset_id];
    var unit = unitPriceVnd(entry, tyGia);
    var cost = toNumberOrZero(h.gia_von_vnd);
    rows.push({
      asset_id: String(h.asset_id), goal_id: String(h.goal_id), ten: entry ? entry.ten : String(h.asset_id),
      nhom: entry ? entry.nhom : 'khac', so_luong: qty, gia: unit, gia_tri_vnd: Math.round(unit > 0 ? qty * unit : cost),
      gia_von_vnd: Math.round(cost), cap_nhat: toDayOrNull(h.cap_nhat_luc), thieu_gia: !(unit > 0)
    });
  });
  return rows;
}

function sumByGroup(valued) {
  var sums = {};
  ASSET_GROUPS.forEach(function (g) { sums[g] = 0; });
  valued.forEach(function (v) { sums[groupOf(v.nhom)] += v.gia_tri_vnd; });
  return sums;
}

/** Value of one goal's holdings: { total, byAsset: { id: value } }. */
function goalHoldingValue(valued, goalId) {
  var result = { total: 0, byAsset: {} };
  valued.forEach(function (v) {
    if (v.goal_id.toUpperCase() !== String(goalId).toUpperCase()) return;
    result.total += v.gia_tri_vnd;
    result.byAsset[v.asset_id] = (result.byAsset[v.asset_id] || 0) + v.gia_tri_vnd;
  });
  return result;
}

/**
 * phan_bo_json from the Python side: [{asset_id, pct, ly_do?, ten?}] or {asset_id: pct}.
 * pct may be a fraction (0.4) or a percent (40): a total of 1.5 or less is read as fractions.
 */
function parsePhanBo(text, index) {
  var data;
  try { data = typeof text === 'string' ? JSON.parse(text || '[]') : text; } catch (err) { return []; }
  var items = [];
  if (Array.isArray(data)) {
    data.forEach(function (d) {
      if (d && (d.asset_id || d.id)) items.push({ asset_id: String(d.asset_id || d.id), pct: Number(d.pct != null ? d.pct : d.ty_le), ten: d.ten, ly_do: d.ly_do });
    });
  } else if (data && typeof data === 'object') {
    Object.keys(data).forEach(function (id) { items.push({ asset_id: id, pct: Number(data[id]) }); });
  }
  items = items.filter(function (item) { return isFinite(item.pct) && item.pct > 0; });
  var total = items.reduce(function (sum, item) { return sum + item.pct; }, 0);
  var scale = total <= 1.5 ? 100 : 1;
  return items.map(function (item) {
    var entry = index && index[item.asset_id];
    return { asset_id: item.asset_id, ten: String(item.ten || (entry ? entry.ten : item.asset_id)), pct: roundTo(item.pct * scale, 1), ly_do: cleanText(item.ly_do, 200) };
  });
}

/** Target vs actual share per asset for one goal; empty when nothing is held yet (nothing to rebalance). */
function computeDrift(goalValue, phanBo) {
  if (goalValue.total <= 0 || !phanBo.length) return [];
  var ids = {};
  phanBo.forEach(function (p) { ids[p.asset_id] = true; });
  Object.keys(goalValue.byAsset).forEach(function (id) { ids[id] = true; });
  return Object.keys(ids).map(function (id) {
    var target = phanBo.filter(function (p) { return p.asset_id === id; })[0];
    return {
      asset_id: id, muc_tieu_pct: target ? target.pct : 0,
      hien_tai_pct: roundTo((goalValue.byAsset[id] || 0) / goalValue.total * 100, 1)
    };
  });
}

function maxDriftPp(drift) {
  return drift.reduce(function (max, d) { return Math.max(max, Math.abs(d.muc_tieu_pct - d.hien_tai_pct)); }, 0);
}
