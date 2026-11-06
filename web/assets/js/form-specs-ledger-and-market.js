// Forms for the Ghi sổ tab (gửi / rút / số đang giữ) and the Thị trường tab (nhập giá, lãi suất).
const goalField = {
  name: 'goal_id', type: 'select', label: 'Mục tiêu', required: true, placeholder: 'Chọn mục tiêu',
  options: (p) => (p.lists?.goals_active || []).map((g) => ({ value: g.goal_id, label: g.ten }))
};
const assetField = (label, filter = () => true) => ({
  name: 'asset_id', type: 'select', label, required: true, placeholder: 'Chọn loại tài sản',
  options: (p) => (p.lists?.assets || []).filter(filter).map((a) => ({ value: a.asset_id, label: a.ten }))
});
const findAsset = (p, id) => (p.lists?.assets || []).find((a) => a.asset_id === id);
const today = (p) => ({ ngay: p.today });

const contribution = (loai, title, icon, verb) => ({
  icon, title, submit: verb, action: 'contribution_add', fixed: { loai }, defaults: today,
  fields: [
    goalField, assetField(loai === 'gui' ? 'Gửi vào đâu' : 'Rút từ đâu'),
    { name: 'so_tien_vnd', type: 'money', label: 'Số tiền', required: true },
    { name: 'ngay', type: 'date', label: 'Ngày', max: (p) => p.today },
    { name: 'ghi_chu', type: 'text', label: 'Ghi chú' },
    { name: 'so_luong', type: 'number', label: 'Số lượng (cổ phiếu, chỉ vàng, USD…)', more: true },
    { name: 'gia_don_vi', type: 'money', label: 'Giá mỗi đơn vị', more: true }
  ]
});

export const contributionGui = contribution('gui', 'Gửi tiền', '➕', 'Lưu khoản gửi');
export const contributionRut = contribution('rut', 'Rút tiền', '➖', 'Lưu khoản rút');

export const holdingSet = {
  icon: '📦', title: 'Cập nhật số đang giữ', submit: 'Lưu số đang giữ', action: 'holding_set',
  fields: [
    goalField, assetField('Loại tài sản'),
    { name: 'so_luong', type: 'number', label: 'Anh đang giữ bao nhiêu (số lượng)', required: true, min: 0 },
    { name: 'gia_von_vnd', type: 'money', label: 'Tổng tiền anh đã bỏ ra mua', more: true }
  ]
};

const rateKind = (p, v) => findAsset(p, v.asset_id)?.loai_gia;
export const priceManualAdd = {
  icon: '💹', title: 'Nhập giá / lãi suất', submit: 'Lưu giá', action: 'price_manual_add', defaults: today,
  fields: [
    assetField('Nhập cho loại nào', (a) => a.nhap_tay),
    { name: 'gia', type: 'money', label: 'Giá hôm nay', required: true, showIf: (v, p) => rateKind(p, v) === 'gia' },
    { name: 'lai_suat_nam', type: 'number', label: 'Lãi suất mỗi năm (%)', required: true, min: 0, max: 100, suffix: '% mỗi năm', showIf: (v, p) => rateKind(p, v) === 'lai_suat' },
    { name: 'ngay', type: 'date', label: 'Ngày', max: (p) => p.today },
    { name: 'ghi_chu', type: 'text', label: 'Ghi chú (nguồn)', more: true }
  ]
};
