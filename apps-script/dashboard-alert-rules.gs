/**
 * Pure: turns the computed numbers into "what needs attention" cards, most urgent first.
 * ctx = { config, goals (views), metrics, dataAsOf }. level: 'do' (act now) | 'vang' (look soon) | 'xanh' (fine).
 */
var LEVEL_ORDER = { do: 0, vang: 1, xanh: 2 };
var BEHIND_MONTHS_URGENT = 6;

function alertItem(level, code, title, detail, goalId) {
  return { level: level, code: code, title: title, detail: detail, goal_id: goalId || '' };
}

function emergencyFundAlert(ctx) {
  var months = ctx.metrics.quy_khan_cap_thang;
  var min = ctx.config.quy_khan_cap_thang_min;
  if (months === null || months >= min) return [];
  return [alertItem(months < min / 2 ? 'do' : 'vang', 'quy_khan_cap', 'Quỹ khẩn cấp mới đủ ' + months + ' tháng chi tiêu',
    'Nên có ít nhất ' + min + ' tháng chi tiêu ở tiền gửi và trái phiếu trước khi đầu tư mạo hiểm.')];
}

function staleDataAlert(ctx) {
  var days = ctx.dataAsOf.stale_days;
  if (days === null) return [alertItem('vang', 'du_lieu_cu', 'Chưa có dữ liệu giá thị trường', 'Giá sẽ có sau lần cập nhật tự động đầu tiên.')];
  if (days <= ctx.config.du_lieu_cu_ngay) return [];
  return [alertItem('vang', 'du_lieu_cu', 'Giá thị trường đã ' + days + ' ngày chưa cập nhật',
    'Giá trị tài sản có thể lệch. Kiểm tra lần chạy cập nhật tự động.')];
}

function perGoalAlerts(ctx) {
  var out = [];
  ctx.goals.filter(function (g) { return g.trang_thai === 'dang'; }).forEach(function (g) {
    if (g.plans.length && !g.phuong_an_chon) {
      out.push(alertItem('vang', 'chua_chon_phuong_an', 'Chọn phương án cho "' + g.ten + '"', 'Đã có ' + g.plans.length + ' phương án để so sánh.', g.goal_id));
    }
    if (g.on_track === false) {
      var behind = g.lech_thang === null ? 0 : Math.abs(g.lech_thang);
      out.push(alertItem(behind >= BEHIND_MONTHS_URGENT ? 'do' : 'vang', 'cham_tien_do', '"' + g.ten + '" đang chậm tiến độ',
        behind > 0 ? 'Chậm khoảng ' + behind + ' tháng so với kế hoạch.' : 'Giá trị hiện tại thấp hơn kỳ vọng.', g.goal_id));
    }
    var drifts = g.lech_phan_bo.filter(function (d) { return Math.abs(d.muc_tieu_pct - d.hien_tai_pct) > ctx.config.lech_phan_bo_pp; });
    if (drifts.length) {
      var worst = drifts.slice().sort(function (a, b) { return Math.abs(b.muc_tieu_pct - b.hien_tai_pct) - Math.abs(a.muc_tieu_pct - a.hien_tai_pct); })[0];
      out.push(alertItem('vang', 'lech_phan_bo', 'Danh mục "' + g.ten + '" lệch so với phương án',
        worst.asset_id + ': mục tiêu ' + worst.muc_tieu_pct + '%, hiện ' + worst.hien_tai_pct + '% (ngưỡng ' + ctx.config.lech_phan_bo_pp + ' điểm).', g.goal_id));
    }
    if (g.phuong_an_chon && g.gui_thang_nay.de_xuat > 0 && g.gui_thang_nay.da_gui <= 0) {
      out.push(alertItem('vang', 'chua_gui_thang_nay', 'Tháng này chưa gửi cho "' + g.ten + '"', 'Đề xuất gửi ' + formatShortVnd(g.gui_thang_nay.de_xuat) + '.', g.goal_id));
    }
  });
  return out;
}

function buildAlerts(ctx) {
  var items = emergencyFundAlert(ctx).concat(staleDataAlert(ctx), perGoalAlerts(ctx));
  if (!items.length) return [alertItem('xanh', 'on_track', 'Mọi thứ đang ổn', 'Không có gì cần xử lý lúc này.')];
  return items
    .map(function (item, i) { return { item: item, i: i }; })
    .sort(function (a, b) { return LEVEL_ORDER[a.item.level] - LEVEL_ORDER[b.item.level] || a.i - b.i; })
    .map(function (x) { return x.item; });
}
