// ?demo=1 sample: a realistic dashboard payload (same shape as the server's) so the page can be reviewed offline.
const M = 1e6;
const plan = (phuong_an, gui_hang_thang, gui_de_dat_80, xac_suat_dat, kq, phan_bo, ly_do) => ({
  phuong_an, gui_hang_thang, gui_de_dat_80, xac_suat_dat, ket_qua: { thap: kq[0], co_so: kq[1], cao: kq[2] }, phan_bo, ly_do
});
const alloc = (asset_id, ten, pct, ly_do) => ({ asset_id, ten, pct, ly_do });

const houseAlloc = {
  can_bang: [alloc('TIET_KIEM', 'Tiền gửi tiết kiệm', 50, 'Giữ phần chắc chắn cho khoản cọc.'), alloc('QUY_TP', 'Quỹ trái phiếu', 30, 'Lãi ổn định hơn gửi tiết kiệm.'), alloc('QUY_CP', 'Quỹ cổ phiếu VN30', 20, 'Phần tăng trưởng, còn 3 năm nên chịu được lên xuống.')],
  chi_gui: [alloc('TIET_KIEM', 'Tiền gửi tiết kiệm', 100, 'Chỉ gửi, không rủi ro.')],
  tang_truong: [alloc('TIET_KIEM', 'Tiền gửi tiết kiệm', 20, 'Phần an toàn tối thiểu.'), alloc('QUY_TP', 'Quỹ trái phiếu', 30, ''), alloc('QUY_CP', 'Quỹ cổ phiếu VN30', 50, 'Nhiều cổ phiếu hơn để lãi cao hơn.')]
};

const goals = [
  {
    goal_id: 'G001', ten: 'Đặt cọc mua nhà', so_tien_dich: 800 * M, tien_te: 'VND', ngay_dich: '2029-11-01', con_thang: 36, tien_co_san: 150 * M,
    ho_so_rui_ro: 'can_bang', uu_tien: 'cao', phuong_an_chon: 'can_bang', trang_thai: 'dang', gia_tri_hien_tai: 212 * M, tien_do_pct: 26.5, on_track: true, lech_thang: 0,
    gui_thang_nay: { de_xuat: 14.5 * M, da_gui: 14.5 * M }, uoc_tinh_nhanh: 14.2 * M,
    plans: [
      plan('chi_gui', 16.4 * M, 19 * M, 0.78, [760 * M, 800 * M, 830 * M], houseAlloc.chi_gui, 'Ít biến động nhưng phải gửi nhiều hơn.'),
      plan('can_bang', 14.5 * M, 17.2 * M, 0.74, [700 * M, 812 * M, 905 * M], houseAlloc.can_bang, 'Cân giữa an toàn và lãi.'),
      plan('tang_truong', 12.8 * M, 18.5 * M, 0.58, [610 * M, 830 * M, 1050 * M], houseAlloc.tang_truong, 'Gửi ít hơn nhưng dễ hụt nếu thị trường xấu.')
    ],
    lech_phan_bo: [{ asset_id: 'QUY_CP', muc_tieu_pct: 20, hien_tai_pct: 31 }, { asset_id: 'TIET_KIEM', muc_tieu_pct: 50, hien_tai_pct: 44 }]
  },
  {
    goal_id: 'G002', ten: 'Quỹ học cho con', so_tien_dich: 30000, tien_te: 'USD', ngay_dich: '2032-08-01', con_thang: 69, tien_co_san: 2000,
    ho_so_rui_ro: 'tang_truong', uu_tien: 'vua', phuong_an_chon: '', trang_thai: 'dang', gia_tri_hien_tai: 5400, tien_do_pct: 18, on_track: false, lech_thang: 4,
    gui_thang_nay: { de_xuat: 6 * M, da_gui: 0 }, uoc_tinh_nhanh: 5.8 * M,
    plans: [
      plan('chi_gui', 8.1 * M, 9 * M, 0.7, [28000, 30000, 31500], [alloc('USD', 'USD tiền mặt', 100, 'Giữ nguyên đô la.')], ''),
      plan('can_bang', 6 * M, 7.4 * M, 0.66, [24000, 31000, 38000], [alloc('USD', 'USD tiền mặt', 40, ''), alloc('QUY_CP', 'Quỹ cổ phiếu VN30', 60, 'Còn gần 6 năm, hợp với phần tăng trưởng.')], ''),
      plan('tang_truong', 5.2 * M, 8.2 * M, 0.55, [19000, 32500, 46000], [alloc('QUY_CP', 'Quỹ cổ phiếu VN30', 80, ''), alloc('VANG', 'Vàng SJC', 20, 'Giữ một phần phòng rủi ro.')], '')
    ],
    lech_phan_bo: []
  },
  {
    goal_id: 'G003', ten: 'Chuyến đi Nhật', so_tien_dich: 60 * M, tien_te: 'VND', ngay_dich: '2027-12-30', con_thang: 13, tien_co_san: 10 * M,
    ho_so_rui_ro: 'bao_thu', uu_tien: 'thap', phuong_an_chon: '', trang_thai: 'dang', gia_tri_hien_tai: 14 * M, tien_do_pct: 23, on_track: true, lech_thang: 0,
    gui_thang_nay: { de_xuat: 0, da_gui: 0 }, uoc_tinh_nhanh: 3.7 * M, plans: [], lech_phan_bo: []
  }
];

const ASSETS = [
  { asset_id: 'TIET_KIEM', ten: 'Tiền gửi tiết kiệm', nhom: 'tien_gui', nhap_tay: true, loai_gia: 'lai_suat' },
  { asset_id: 'QUY_TP', ten: 'Quỹ trái phiếu', nhom: 'trai_phieu', nhap_tay: false, loai_gia: 'gia' },
  { asset_id: 'QUY_CP', ten: 'Quỹ cổ phiếu VN30', nhom: 'co_phieu', nhap_tay: false, loai_gia: 'gia' },
  { asset_id: 'VANG', ten: 'Vàng SJC', nhom: 'vang', nhap_tay: true, loai_gia: 'gia' },
  { asset_id: 'USD', ten: 'USD tiền mặt', nhom: 'usd', nhap_tay: true, loai_gia: 'gia' }
];

function buildTrend() {
  const out = [];
  for (let i = 89; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(2026, 10, 6) - i * 86400000).toISOString().slice(0, 10);
    const k = 1 - i * 0.0016;
    const wobble = 1 + Math.sin(i / 6) * 0.012;
    const row = { ngay: date, tien_gui: 170 * M * k, trai_phieu: 75 * M * k, co_phieu: 52 * M * k * wobble, vang: 18 * M * k, usd: 11 * M, khac: 3 * M, no: 40 * M };
    out.push({ ...row, tong: row.tien_gui + row.trai_phieu + row.co_phieu + row.vang + row.usd + row.khac });
  }
  return out;
}

const budgetRows = [
  { budget_id: 'B01', loai: 'thu_nhap', ten: 'Lương', so_tien: 38 * M, chu_ky: 'thang' },
  { budget_id: 'B02', loai: 'thu_nhap', ten: 'Thưởng cuối năm', so_tien: 60 * M, chu_ky: 'nam' },
  { budget_id: 'B03', loai: 'chi_co_dinh', ten: 'Tiền nhà', so_tien: 8 * M, chu_ky: 'thang' },
  { budget_id: 'B04', loai: 'chi_bien_doi', ten: 'Ăn uống', so_tien: 7.5 * M, chu_ky: 'thang' },
  { budget_id: 'B05', loai: 'chi_bien_doi', ten: 'Cà phê, ăn ngoài', so_tien: 3 * M, chu_ky: 'thang' },
  { budget_id: 'B06', loai: 'no', ten: 'Vay mua xe', so_tien: 2.6 * M, chu_ky: 'thang', lai_suat_nam: 9.5, tra_toi_thieu: 2.6 * M }
];

const market = [
  { asset_id: 'TIET_KIEM', ten: 'Tiền gửi tiết kiệm 12 tháng', nhom: 'tien_gui', tien_te: 'VND', loai_gia: 'lai_suat', lai_suat_nam: 5.6, ngay_gia: '2026-11-02', nguon: 'nhập tay', cu: false, nhap_tay: true },
  { asset_id: 'QUY_TP', ten: 'Quỹ trái phiếu', nhom: 'trai_phieu', tien_te: 'VND', loai_gia: 'gia', gia: 14820, ngay_gia: '2026-11-05', nguon: 'quỹ', cu: false, nhap_tay: false },
  { asset_id: 'QUY_CP', ten: 'Quỹ cổ phiếu VN30', nhom: 'co_phieu', tien_te: 'VND', loai_gia: 'gia', gia: 21340, ngay_gia: '2026-11-05', nguon: 'quỹ', cu: false, nhap_tay: false },
  { asset_id: 'VANG', ten: 'Vàng SJC', nhom: 'vang', tien_te: 'VND', loai_gia: 'gia', gia: 91500000, ngay_gia: '2026-10-21', nguon: 'nhập tay', cu: true, nhap_tay: true },
  { asset_id: 'USD', ten: 'USD tiền mặt', nhom: 'usd', tien_te: 'VND', loai_gia: 'gia', gia: 26280, ngay_gia: '2026-11-04', nguon: 'nhập tay', cu: false, nhap_tay: true }
];

export const demoPayload = {
  ok: true, today: '2026-11-06',
  data_as_of: { prices: '2026-11-05', plan: '2026-10-31', tracking: '2026-11-04', stale_days: 16 },
  summary: {
    tong_tai_san: 331 * M, doi_dau_thang: 4.2 * M, theo_nhom: { tien_gui: 168 * M, trai_phieu: 74 * M, co_phieu: 56 * M, vang: 18 * M, usd: 11 * M, khac: 4 * M },
    no: 38 * M, quy_khan_cap_thang: 3.4, can_gui_thang_nay: 20.5 * M, da_gui_thang_nay: 14.5 * M
  },
  alerts: [
    { level: 'do', code: 'THIEU_GUI', title: 'Quỹ học cho con đang chậm 4 tháng', detail: 'Tháng này chưa gửi. Gửi 6tr để kịp tiến độ.', goal_id: 'G002' },
    { level: 'vang', code: 'GIA_CU', title: 'Giá vàng đã 16 ngày chưa cập nhật', detail: 'Vào tab Thị trường để nhập giá mới.', goal_id: '' },
    { level: 'vang', code: 'LECH_PHAN_BO', title: 'Cổ phiếu đang nhiều hơn dự định ở mục tiêu mua nhà', detail: 'Hiện 31%, nên là 20%.', goal_id: 'G001' },
    { level: 'xanh', code: 'DAT_MOC', title: 'Mục tiêu mua nhà đã đạt hơn 25%', detail: '', goal_id: 'G001' }
  ],
  goals,
  holdings: [
    { asset_id: 'TIET_KIEM', goal_id: 'G001', ten: 'Tiền gửi tiết kiệm', nhom: 'tien_gui', so_luong: 93 * M, gia: 1, gia_tri_vnd: 93 * M, gia_von_vnd: 90 * M, cap_nhat: '2026-11-04' },
    { asset_id: 'QUY_TP', goal_id: 'G001', ten: 'Quỹ trái phiếu', nhom: 'trai_phieu', so_luong: 4400.5, gia: 14820, gia_tri_vnd: 65.2 * M, gia_von_vnd: 62 * M, cap_nhat: '2026-11-04' },
    { asset_id: 'QUY_CP', goal_id: 'G001', ten: 'Quỹ cổ phiếu VN30', nhom: 'co_phieu', so_luong: 2900, gia: 21340, gia_tri_vnd: 61.9 * M, gia_von_vnd: 55 * M, cap_nhat: '2026-11-04' },
    { asset_id: 'USD', goal_id: 'G002', ten: 'USD tiền mặt', nhom: 'usd', so_luong: 420, gia: 26280, gia_tri_vnd: 11 * M, gia_von_vnd: 10.4 * M, cap_nhat: '2026-11-04' },
    { asset_id: 'VANG', goal_id: 'G002', ten: 'Vàng SJC', nhom: 'vang', so_luong: 2, gia: 91500000, gia_tri_vnd: 18.3 * M, gia_von_vnd: 16 * M, cap_nhat: '2026-10-21' }
  ],
  recent: [
    { ngay: '2026-11-03', loai: 'gui', goal_id: 'G001', asset_id: 'TIET_KIEM', so_tien_vnd: 7 * M, ghi_chu: 'Lương tháng 11' },
    { ngay: '2026-11-03', loai: 'gui', goal_id: 'G001', asset_id: 'QUY_CP', so_tien_vnd: 3 * M },
    { ngay: '2026-11-03', loai: 'gui', goal_id: 'G001', asset_id: 'QUY_TP', so_tien_vnd: 4.5 * M },
    { ngay: '2026-10-28', loai: 'rut', goal_id: 'G003', asset_id: 'TIET_KIEM', so_tien_vnd: 2 * M, ghi_chu: 'Đặt vé máy bay' },
    { ngay: '2026-10-05', loai: 'gui', goal_id: 'G002', asset_id: 'USD', so_tien_vnd: 6 * M }
  ],
  budget: {
    rows: budgetRows,
    metrics: { thu_thang: 43 * M, chi_thang: 21.1 * M, du_thang: 21.9 * M, ty_le_tiet_kiem: 0.51, quy_khan_cap_thang: 3.4, can_gui: 20.5 * M, kha_thi: true, thieu: 0, huong: 'cat_chi', ly_do: 'Anh đủ tiền gửi các mục tiêu. Cắt thêm chi tiêu nhỏ sẽ giúp Quỹ học cho con bắt kịp tiến độ.' },
    levers: [
      { ten: 'Giảm cà phê, ăn ngoài 1tr/tháng', tiet_kiem_thang: 1 * M, som_hon_thang: 2, goal_id: 'G002' },
      { ten: 'Trả hết nợ mua xe sớm', tiet_kiem_thang: 2.6 * M, som_hon_thang: 3, goal_id: 'G001' }
    ]
  },
  market,
  trend: buildTrend(),
  lists: {
    assets: ASSETS,
    goals_active: goals.map((g) => ({ goal_id: g.goal_id, ten: g.ten }))
  },
  settings: { cpi_pct: 3.5, ho_so_mac_dinh: 'can_bang', quy_khan_cap_thang_min: 3, lech_phan_bo_pp: 5, du_lieu_cu_ngay: 7, ty_gia_usd: 26280, sheet_url: 'https://docs.google.com/spreadsheets/d/DEMO' }
};

export function demoHistoryRows(goalId) {
  const base = demoPayload.recent.filter((r) => r.goal_id === goalId);
  const extra = Array.from({ length: 30 }, (_, i) => ({ ngay: `2026-${String(9 - Math.floor(i / 4)).padStart(2, '0')}-${String(28 - (i % 4) * 7).padStart(2, '0')}`, loai: 'gui', goal_id: goalId, asset_id: 'TIET_KIEM', so_tien_vnd: (4 + (i % 5)) * M }));
  return [...base, ...extra];
}
