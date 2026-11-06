/**
 * Run once from the Apps Script editor (select setupSheets, then Run).
 * Creates the 12 tabs if they are missing; existing tabs are left untouched, so it is safe to run again.
 * The 5 Python tabs (Assets, Prices_Latest, Plan, Tracking, Run_Log) are created empty with their header
 * and protected with a warning: the daily Python job writes them, you should not edit them by hand.
 */
var CONFIG_NOTES = {
  cpi_pct: 'Lạm phát giả định mỗi năm. 0.045 = 4,5%.',
  ho_so_mac_dinh: 'Hồ sơ rủi ro điền sẵn khi thêm mục tiêu: bao_thu | can_bang | tang_truong.',
  quy_khan_cap_thang_min: 'Quỹ khẩn cấp tối thiểu (số tháng chi tiêu) trước khi cảnh báo.',
  lech_phan_bo_pp: 'Danh mục lệch phương án quá số điểm % này thì nhắc cân đối lại.',
  du_lieu_cu_ngay: 'Giá thị trường cũ quá số ngày này thì cảnh báo.',
  ky_vong_loi_nhuan_bao_thu: 'Lợi suất kỳ vọng mỗi năm của hồ sơ bảo thủ (dùng cho ước tính nhanh). 0.055 = 5,5%.',
  ky_vong_loi_nhuan_can_bang: 'Lợi suất kỳ vọng mỗi năm của hồ sơ cân bằng. 0.08 = 8%.',
  ky_vong_loi_nhuan_tang_truong: 'Lợi suất kỳ vọng mỗi năm của hồ sơ tăng trưởng. 0.11 = 11%.',
  ty_gia_usd_du_phong: 'Tỷ giá USD/VND dùng khi chưa có giá tự động.',
  gui_toi_da_1_lan: 'Một lần ghi gửi/rút tối đa bao nhiêu đồng (chặn gõ nhầm "tr" thành "k").',
  kich_ban: 'Kịch bản cho phần Python tính: low | base | high.',
  tai_san_nuoc_ngoai: '0 = chỉ tài sản trong nước, 1 = thêm ETF Mỹ và BTC vào mọi mục tiêu.',
  site_url: 'Link trang web của anh (GitHub Pages) để menu tạo link riêng. Sửa ở đây, không sửa trên web.',
  sheet_url: 'Link Sheet này, hiện trên trang Cài đặt. Tự điền khi chạy setupSheets.'
};

var VALIDATION_LISTS = {
  Goals: { tien_te: CURRENCIES, ho_so_rui_ro: RISK_PROFILES, uu_tien: PRIORITIES, phuong_an_chon: PLAN_OPTIONS, trang_thai: GOAL_STATUS },
  Budget: { loai: BUDGET_TYPES, chu_ky: BUDGET_CYCLES, trang_thai: BUDGET_STATUS },
  Contributions: { loai: CONTRIBUTION_TYPES },
  Assets: { nhom: ASSET_GROUPS }
};

var NUMBER_FORMATS = {
  Goals: { so_tien_dich: '#,##0', tien_co_san: '#,##0', ngay_dich: 'dd/MM/yyyy', tao_luc: 'dd/MM/yyyy HH:mm', cap_nhat_luc: 'dd/MM/yyyy HH:mm' },
  Budget: { so_tien: '#,##0', lai_suat_nam: '0.0%', tra_toi_thieu: '#,##0', cap_nhat_luc: 'dd/MM/yyyy HH:mm' },
  Contributions: { thoi_gian: 'dd/MM/yyyy HH:mm', ngay: 'dd/MM/yyyy', so_tien_vnd: '#,##0', so_luong: '#,##0.######', gia_don_vi: '#,##0.00' },
  Holdings: { so_luong: '#,##0.######', gia_von_vnd: '#,##0', cap_nhat_luc: 'dd/MM/yyyy HH:mm' },
  Manual_Prices: { thoi_gian: 'dd/MM/yyyy HH:mm', ngay: 'dd/MM/yyyy', gia: '#,##0.00', lai_suat_nam: '0.0%' },
  Snapshot: { ngay: 'dd/MM/yyyy', tong: '#,##0', tien_gui: '#,##0', trai_phieu: '#,##0', co_phieu: '#,##0', vang: '#,##0', usd: '#,##0', khac: '#,##0', no: '#,##0' },
  Prices_Latest: { gia: '#,##0.00', ngay_gia: 'dd/MM/yyyy', cap_nhat_luc: 'dd/MM/yyyy HH:mm' },
  Plan: { gui_hang_thang: '#,##0', gui_de_dat_80: '#,##0', xac_suat_dat: '0%', ket_qua_thap: '#,##0', ket_qua_co_so: '#,##0', ket_qua_cao: '#,##0' },
  Tracking: { ngay: 'dd/MM/yyyy', gia_tri_hien_tai: '#,##0', gia_tri_ky_vong: '#,##0', gui_thang_nay_de_xuat: '#,##0' }
};

function setupSheets() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  // Date cells are read in the spreadsheet's time zone, not the script's.
  spreadsheet.setSpreadsheetTimeZone('Asia/Ho_Chi_Minh');
  APPS_SCRIPT_TABS.concat(PYTHON_TABS).forEach(function (tab) { createTab_(spreadsheet, tab); });
  fillConfigDefaults_(spreadsheet);
  var defaultSheet = spreadsheet.getSheetByName('Sheet1') || spreadsheet.getSheetByName('Trang tính1');
  if (defaultSheet && spreadsheet.getSheets().length > 1 && defaultSheet.getLastRow() === 0) spreadsheet.deleteSheet(defaultSheet);
}

function setColumnFormat_(sheet, headers, field, format) {
  var index = headers.indexOf(field);
  if (index !== -1) sheet.getRange(2, index + 1, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat(format);
}

function createTab_(spreadsheet, tab) {
  if (spreadsheet.getSheetByName(tab)) return;
  var headers = HEADERS[tab];
  var sheet = spreadsheet.insertSheet(tab);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground(PYTHON_TABS.indexOf(tab) !== -1 ? '#eeeeee' : '#e6eef6');
  sheet.setFrozenRows(1);
  // Plain text first, so "1/2" or "86%" in a note never turns into a date or a number.
  (TEXT_FIELDS[tab] || []).forEach(function (field) { setColumnFormat_(sheet, headers, field, '@'); });
  var formats = NUMBER_FORMATS[tab] || {};
  Object.keys(formats).forEach(function (field) { setColumnFormat_(sheet, headers, field, formats[field]); });
  var lists = VALIDATION_LISTS[tab] || {};
  Object.keys(lists).forEach(function (field) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(lists[field], true).setAllowInvalid(false).build();
    sheet.getRange(2, headers.indexOf(field) + 1, Math.max(1, sheet.getMaxRows() - 1), 1).setDataValidation(rule);
  });
  if (PYTHON_TABS.indexOf(tab) !== -1) {
    sheet.protect().setDescription('Tab do Python ghi mỗi ngày, đừng sửa tay').setWarningOnly(true);
  }
  if (tab === T.config) { sheet.setColumnWidth(1, 240); sheet.setColumnWidth(2, 200); sheet.setColumnWidth(3, 560); }
}

/** Fills the Config rows only on a fresh tab (nothing below the header). */
function fillConfigDefaults_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(T.config);
  if (sheet.getLastRow() >= 2) return;
  var rows = Object.keys(CONFIG_DEFAULTS).map(function (key) {
    var value = key === 'sheet_url' ? spreadsheet.getUrl() : String(CONFIG_DEFAULTS[key]);
    return [key, value, CONFIG_NOTES[key] || ''];
  });
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
}
