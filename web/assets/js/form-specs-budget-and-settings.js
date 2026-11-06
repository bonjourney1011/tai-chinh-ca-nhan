// Forms for the Ngân sách tab (add/edit a budget line) and for ⚙ Cài đặt.
export const BUDGET_KINDS = [
  { value: 'thu_nhap', label: 'Thu nhập' },
  { value: 'chi_co_dinh', label: 'Chi cố định' },
  { value: 'chi_bien_doi', label: 'Chi thay đổi' },
  { value: 'dau_tu_thu_nhap', label: 'Đầu tư cho thu nhập' },
  { value: 'no', label: 'Nợ' }
];
const isDebt = (v) => v.loai === 'no';

export const budgetSave = {
  icon: '🧾', title: 'Khoản ngân sách', submit: 'Lưu khoản này', action: 'budget_save',
  defaults: () => ({ chu_ky: 'thang' }),
  fields: [
    { name: 'loai', type: 'choice', label: 'Loại', required: true, options: () => BUDGET_KINDS },
    { name: 'ten', type: 'text', label: 'Tên khoản', required: true, placeholder: 'VD Lương, Tiền nhà, Thẻ tín dụng' },
    { name: 'so_tien', type: 'money', label: 'Số tiền', required: true },
    { name: 'chu_ky', type: 'choice', label: 'Mỗi', required: true, options: () => [{ value: 'thang', label: 'Tháng' }, { value: 'nam', label: 'Năm' }] },
    { name: 'lai_suat_nam', type: 'number', label: 'Lãi suất nợ mỗi năm (%)', min: 0, max: 100, showIf: isDebt },
    { name: 'tra_toi_thieu', type: 'money', label: 'Phải trả tối thiểu mỗi tháng', showIf: isDebt }
  ]
};

export function budgetPrefill(row) {
  return { __send: { budget_id: row.budget_id }, loai: row.loai, ten: row.ten, so_tien: row.so_tien, chu_ky: row.chu_ky, lai_suat_nam: row.lai_suat_nam || undefined, tra_toi_thieu: row.tra_toi_thieu || undefined };
}

const KEYS = ['cpi_pct', 'ho_so_mac_dinh', 'quy_khan_cap_thang_min', 'lech_phan_bo_pp', 'du_lieu_cu_ngay'];
export const configSave = {
  icon: '⚙', title: 'Cài đặt', submit: 'Lưu cài đặt', action: 'config_save',
  shape: (values) => ({ values }),
  defaults: (p) => Object.fromEntries(KEYS.filter((k) => p.settings?.[k] != null).map((k) => [k, p.settings[k]])),
  fields: [
    { name: 'cpi_pct', type: 'number', label: 'Giá cả tăng mỗi năm (%)', min: 0, max: 50, hint: 'Dùng để tính tiền sẽ mất giá bao nhiêu.' },
    { name: 'ho_so_mac_dinh', type: 'choice', label: 'Mức rủi ro mặc định khi tạo mục tiêu', options: () => [{ value: 'bao_thu', label: 'Thận trọng' }, { value: 'can_bang', label: 'Cân bằng' }, { value: 'tang_truong', label: 'Tăng trưởng' }] },
    { name: 'quy_khan_cap_thang_min', type: 'number', integer: true, label: 'Quỹ khẩn cấp tối thiểu (số tháng chi tiêu)', min: 0, max: 36 },
    { name: 'lech_phan_bo_pp', type: 'number', label: 'Báo khi chia tiền lệch quá (điểm %)', min: 1, max: 50 },
    { name: 'du_lieu_cu_ngay', type: 'number', integer: true, label: 'Giá cũ hơn bao nhiêu ngày thì cảnh báo', min: 1, max: 365 }
  ]
};
