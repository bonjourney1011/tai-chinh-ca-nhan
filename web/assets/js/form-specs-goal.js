// Goal wizard: one progressive form. Amount fields exist twice (VND money / USD number) under one name.
import { formatMoney, formatMonths } from './dom-and-format-helpers.js';
import { expectedReturn, monthsUntil, quickMonthly } from './quick-estimate.js';

const RISK = [
  { value: 'bao_thu', label: 'Thận trọng', hint: 'Ít biến động, ít lãi hơn. Hợp mục tiêu gần.' },
  { value: 'can_bang', label: 'Cân bằng', hint: 'Vừa lãi vừa an toàn. Hợp đa số mục tiêu.' },
  { value: 'tang_truong', label: 'Tăng trưởng', hint: 'Lãi cao hơn nhưng lên xuống nhiều. Hợp mục tiêu xa.' }
];
const PRIORITY = [{ value: 'cao', label: 'Cao' }, { value: 'vua', label: 'Vừa' }, { value: 'thap', label: 'Thấp' }];
const isUsd = (v) => v.tien_te === 'USD';
const amountFields = (key, label, required) => [
  { name: key, key: `${key}_vnd`, type: 'money', label, required: required && ((v) => !isUsd(v)), showIf: (v) => !isUsd(v), sendAs: key },
  { name: key, key: `${key}_usd`, type: 'number', label: `${label} (USD)`, required: required && isUsd, showIf: isUsd, min: 0, sendAs: key, placeholder: 'VD 20000' }
];

function quickHint(payload, v) {
  const usd = isUsd(v);
  const target = usd ? v.so_tien_dich_usd : v.so_tien_dich_vnd;
  const have = (usd ? v.tien_co_san_usd : v.tien_co_san_vnd) || 0;
  const months = v.kieu_han === 'thang' ? v.so_thang : monthsUntil(payload.today, v.ngay_dich);
  const rate = expectedReturn(payload.settings);
  const monthly = quickMonthly({ target, have, months, annualReturn: rate });
  if (monthly == null) return '';
  const tail = `trong ${formatMonths(months)}, giả sử lãi ${String(Math.round(rate * 1000) / 10).replace('.', ',')}%/năm`;
  return monthly === 0 ? `Ước tính nhanh: tiền có sẵn đã đủ ${tail}.` : `Ước tính nhanh: gửi khoảng ${formatMoney(monthly, usd ? 'USD' : 'VND')}/tháng ${tail}.`;
}

export const goalSave = {
  icon: '🎯', title: 'Mục tiêu', submit: 'Lưu mục tiêu', action: 'goal_save', hint: quickHint,
  defaults: (p) => ({ tien_te: 'VND', kieu_han: 'ngay', uu_tien: 'vua', ho_so_rui_ro: p.settings?.ho_so_mac_dinh || 'can_bang' }),
  fields: [
    { name: 'ten', type: 'text', label: 'Tên mục tiêu', required: true, placeholder: 'VD Mua nhà, Quỹ học cho con' },
    { name: 'tien_te', type: 'choice', label: 'Tiền tệ', required: true, options: () => ['VND', 'USD'] },
    ...amountFields('so_tien_dich', 'Cần bao nhiêu tiền', true),
    { name: 'kieu_han', type: 'choice', label: 'Hạn đạt mục tiêu', required: true, local: true, options: () => [{ value: 'ngay', label: 'Theo ngày' }, { value: 'thang', label: 'Theo số tháng' }] },
    { name: 'ngay_dich', type: 'date', label: 'Ngày cần có tiền', required: true, showIf: (v) => v.kieu_han !== 'thang', min: (p) => p.today },
    { name: 'so_thang', type: 'number', integer: true, label: 'Số tháng nữa', required: true, showIf: (v) => v.kieu_han === 'thang', min: 1, max: 600, placeholder: 'VD 36' },
    ...amountFields('tien_co_san', 'Tiền anh đã có sẵn', false),
    { name: 'ho_so_rui_ro', type: 'choice', label: 'Anh chấp nhận rủi ro mức nào', required: true, options: () => RISK },
    { name: 'uu_tien', type: 'choice', label: 'Mức ưu tiên', required: true, options: () => PRIORITY },
    { name: 'ghi_chu', type: 'text', label: 'Ghi chú', more: true }
  ]
};

/** Fill the wizard from an existing goal; goal_id rides along under __send. */
export function goalPrefill(goal) {
  const usd = goal.tien_te === 'USD';
  const byDate = Boolean(goal.ngay_dich);
  return {
    __send: { goal_id: goal.goal_id }, ten: goal.ten, tien_te: goal.tien_te, ho_so_rui_ro: goal.ho_so_rui_ro, uu_tien: goal.uu_tien,
    [usd ? 'so_tien_dich_usd' : 'so_tien_dich_vnd']: goal.so_tien_dich,
    [usd ? 'tien_co_san_usd' : 'tien_co_san_vnd']: goal.tien_co_san || undefined,
    kieu_han: byDate ? 'ngay' : 'thang', ngay_dich: goal.ngay_dich || undefined, so_thang: byDate ? undefined : goal.con_thang
  };
}
