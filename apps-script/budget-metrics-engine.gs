/**
 * Pure: monthly income / spending metrics and "what would help most" levers from the Budget tab.
 * Yearly lines count as 1/12. Rates in Budget rows are decimals in the Sheet; levers read them as percent.
 */
var ESSENTIAL_RATIO_MAX = 0.75;
var MIN_SAVINGS_RATE = 0.1;
var HIGH_DEBT_RATE_PCT = 15;
var CUT_VARIABLE_RATIO = 0.2;
var MAX_LEVERS = 8;
var RAISE_INCOME_STEPS_TRIEU = [1, 2, 5];
var PRIORITY_RANK = { cao: 1, vua: 2, thap: 3 };

function monthlyAmount(row) {
  var amount = toNumberOrZero(row.so_tien);
  return String(row.chu_ky) === 'nam' ? amount / 12 : amount;
}

function activeBudgetRows(rows) {
  return (rows || []).filter(function (r) { return r.budget_id && String(r.trang_thai || 'dang') !== 'xoa'; });
}

function sumMonthly(rows, type) {
  return rows.filter(function (r) { return r.loai === type; }).reduce(function (s, r) { return s + monthlyAmount(r); }, 0);
}

/** Monthly deposit the owner committed to: the chosen plan, else the quick estimate. VND. */
function plannedMonthlyVnd(goal) {
  var chosen = (goal.plans || []).filter(function (p) { return p.phuong_an === goal.phuong_an_chon; })[0];
  return chosen ? chosen.gui_hang_thang : goal.uoc_tinh_nhanh;
}

/** Most important active goal: priority first, then the nearest deadline. */
function mainGoal(goals) {
  var active = goals.filter(function (g) { return g.trang_thai === 'dang'; });
  active.sort(function (a, b) {
    return (PRIORITY_RANK[a.uu_tien] || 2) - (PRIORITY_RANK[b.uu_tien] || 2) || String(a.ngay_dich).localeCompare(String(b.ngay_dich));
  });
  return active[0] || null;
}

function buildLevers(rows, goals, config, tyGia) {
  var goal = mainGoal(goals);
  if (!goal) return [];
  var basePmt = plannedMonthlyVnd(goal);
  if (!(basePmt > 0)) return [];
  var rate = expectedReturn(config, goal.ho_so_rui_ro);
  var usd = isUsdGoal(goal);
  var basePmtGoal = usd ? basePmt / tyGia : basePmt;
  function lever(name, extraVnd) {
    var extra = usd ? extraVnd / tyGia : extraVnd;
    return {
      ten: name, tiet_kiem_thang: Math.round(extraVnd), goal_id: goal.goal_id,
      som_hon_thang: roundTo(monthsSaved(goal.so_tien_dich, goal.gia_tri_hien_tai, basePmtGoal, extra, rate), 1)
    };
  }
  var out = [];
  rows.forEach(function (r) {
    if (r.loai === 'chi_bien_doi' && monthlyAmount(r) > 0) out.push(lever('Giảm ' + Math.round(CUT_VARIABLE_RATIO * 100) + '% ' + r.ten, monthlyAmount(r) * CUT_VARIABLE_RATIO));
    var pct = readRatePercent(r.lai_suat_nam);
    if (r.loai === 'no' && pct !== null && pct > HIGH_DEBT_RATE_PCT) out.push(lever('Trả sớm ' + r.ten + ' (lãi ' + roundTo(pct, 1) + '%/năm)', toNumberOrZero(r.so_tien) * pct / 100 / 12));
  });
  RAISE_INCOME_STEPS_TRIEU.forEach(function (t) { out.push(lever('Tăng thu nhập +' + t + ' triệu/tháng, gửi hết phần tăng', t * 1000000)); });
  out.sort(function (a, b) { return b.som_hon_thang - a.som_hon_thang || b.tiet_kiem_thang - a.tiet_kiem_thang; });
  return out.slice(0, MAX_LEVERS);
}

function directionReason(thu, essentialRatio, savingsRate, thieu, cutMax) {
  if (thu <= 0) return 'Chưa có khoản thu nhập nào trong ngân sách. Thêm lương và các khoản thu để tính được.';
  if (essentialRatio > ESSENTIAL_RATIO_MAX) return 'Chi cố định đã chiếm ' + formatPercent(essentialRatio) + ' thu nhập, khó cắt thêm. Tăng thu nhập hiệu quả hơn.';
  if (savingsRate < MIN_SAVINGS_RATE) return 'Tỷ lệ tiết kiệm mới ' + formatPercent(savingsRate) + ' (dưới 10%). Tăng thu nhập sẽ giúp nhiều hơn.';
  if (thieu > cutMax) {
    return 'Cắt 20% chi linh hoạt chỉ thêm ' + formatShortVnd(cutMax) + ' mỗi tháng, mục tiêu còn thiếu ' + formatShortVnd(thieu) +
      '. Phải tăng thu nhập, hoặc lùi hạn hay hạ đích mục tiêu.';
  }
  return 'Chi cố định ' + formatPercent(essentialRatio) + ' thu nhập, còn dư địa. Cắt bớt chi linh hoạt là cách nhanh nhất.';
}

/** info = { liquid (VND, tien_gui + trai_phieu), goals (goal views), config, tyGia }. */
function computeBudgetMetrics(budgetRows, info) {
  var rows = activeBudgetRows(budgetRows);
  var thu = sumMonthly(rows, 'thu_nhap');
  var fixed = sumMonthly(rows, 'chi_co_dinh');
  var chi = fixed + sumMonthly(rows, 'chi_bien_doi');
  var debtMin = rows.filter(function (r) { return r.loai === 'no'; }).reduce(function (s, r) { return s + toNumberOrZero(r.tra_toi_thieu); }, 0);
  var du = thu - chi - debtMin;
  var savingsRate = thu > 0 ? du / thu : 0;
  var canGui = info.goals.filter(function (g) { return g.trang_thai === 'dang'; })
    .reduce(function (s, g) { return s + (plannedMonthlyVnd(g) || 0); }, 0);
  var essentialRatio = thu > 0 ? fixed / thu : 0;
  var thieu = Math.max(0, canGui - Math.max(du, 0));
  var cutMax = sumMonthly(rows, 'chi_bien_doi') * CUT_VARIABLE_RATIO;
  // Cutting can only free a slice of variable spending; a bigger shortfall needs more income or a smaller goal.
  var tangThu = thu <= 0 || essentialRatio > ESSENTIAL_RATIO_MAX || savingsRate < MIN_SAVINGS_RATE || thieu > cutMax;
  return {
    rows: rows.map(function (r) {
      return { budget_id: r.budget_id, loai: r.loai, ten: r.ten, so_tien: toNumberOrZero(r.so_tien), chu_ky: r.chu_ky || 'thang',
        lai_suat_nam: readRatePercent(r.lai_suat_nam), tra_toi_thieu: toNumberOrZero(r.tra_toi_thieu), ghi_chu: r.ghi_chu || '' };
    }),
    metrics: {
      thu_thang: Math.round(thu), chi_thang: Math.round(chi), tra_no_toi_thieu: Math.round(debtMin), du_thang: Math.round(du),
      ty_le_tiet_kiem: roundTo(savingsRate, 3),
      quy_khan_cap_thang: chi > 0 ? roundTo(info.liquid / chi, 1) : null,
      can_gui: Math.round(canGui), kha_thi: canGui <= Math.max(du, 0), thieu: Math.round(thieu),
      huong: tangThu ? 'tang_thu' : 'cat_chi', ly_do: directionReason(thu, essentialRatio, savingsRate, thieu, cutMax)
    },
    levers: buildLevers(rows, info.goals, info.config, info.tyGia)
  };
}
