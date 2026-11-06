# Tài chính cá nhân theo mục tiêu

Trang web giúp anh đặt mục tiêu tiền (mua nhà, du học, quỹ khẩn cấp...), xem cần gửi bao nhiêu mỗi tháng, ghi lại các khoản đã gửi/rút và theo dõi tiến độ.

- **Trang web** (GitHub Pages, thư mục `web/`): chỉ hiển thị và gửi lệnh.
- **Google Apps Script + Google Sheet** (thư mục `apps-script/`): nơi lưu dữ liệu và nhận lệnh từ trang.
- **Python** (thư mục `src/`): mỗi ngày lấy giá thị trường, tính phương án và theo dõi tiến độ, rồi ghi vào các tab kết quả của Sheet.
- Chi phí: 0đ. Repo này **không chứa số liệu, token hay số tài khoản**. Dữ liệu chỉ nằm trong Sheet.

Ai ghi tab nào:

| Bên | Tab |
|---|---|
| Apps Script (anh nhập qua trang) | `Config`, `Goals`, `Budget`, `Contributions`, `Holdings`, `Manual_Prices`, `Snapshot` |
| Python (đừng sửa tay) | `Assets`, `Prices_Latest`, `Plan`, `Tracking`, `Run_Log` |

---

## Cài đặt (khoảng 30 phút, làm 1 lần)

### Bước 1. Tạo Sheet và dán code

1. Vào `sheets.new`, đặt tên "Tài chính cá nhân". Dùng tài khoản Google anh dùng hằng ngày.
2. Mở **Tiện ích mở rộng → Apps Script**.
3. Với **từng file** trong `apps-script/`: bấm **＋ → Tập lệnh**, đặt tên đúng như tên file (bỏ đuôi `.gs`), dán nội dung. Có 18 file `.gs`, liệt kê ở mục "Cho người sửa code" bên dưới.
4. **Cài đặt dự án ⚙️** → tick "Hiển thị tệp kê khai appsscript.json", mở file đó và dán nội dung `apps-script/appsscript.json`.
5. Chọn hàm `setupSheets` rồi bấm **Chạy**. Lần đầu Google hỏi quyền: **Nâng cao → Đi tới… → Cho phép**.
   - Bước này tạo 12 tab, đặt múi giờ GMT+7, điền sẵn tab `Config` và khoá cảnh báo cho 5 tab của Python.
   - Chạy lại không làm mất dữ liệu: tab đã có thì được giữ nguyên.

### Bước 2. Triển khai API

1. **Triển khai → Tùy chọn triển khai mới → Ứng dụng web**: Thực thi với tư cách **Tôi**, Ai có quyền truy cập **Bất kỳ ai** (dữ liệu vẫn được token bảo vệ ở bước 4).
2. Copy URL đuôi `/exec`. Mở URL đó trên trình duyệt: thấy `{"ok":true,"service":"tai-chinh-ca-nhan"}` là API đã chạy.
3. Dán URL vào `web/assets/js/site-config.js`, dòng `apiUrl`.
4. Khi sửa code về sau: **Quản lý việc triển khai → ✏️ → Phiên bản: Mới** (giữ nguyên URL). Chỉ sửa dữ liệu trong Sheet thì không cần triển khai lại.

### Bước 3. Đưa trang lên GitHub Pages

1. Đẩy repo lên GitHub, vào **Settings → Pages**, chọn nhánh và thư mục chứa `web/`.
2. Copy link trang (dạng `https://<tên>.github.io/<repo>/`), dán vào tab `Config`, dòng `site_url`.

### Bước 4. Tạo link riêng cho anh

1. Mở lại Sheet, đợi vài giây sẽ có menu **Tài chính**.
2. Chọn **Tài chính → 🔑 Tạo link mới cho anh**, copy link dạng `.../#t=...`.
   - Không thấy menu: trong Apps Script chạy hàm `rotateTokenFromEditor`, hộp thoại hiện trong Sheet.
3. Gửi link qua tin nhắn riêng, mở 1 lần trên điện thoại là trang tự nhớ.
4. Lỡ lộ link: bấm 🔑 lần nữa, link cũ hết hiệu lực ngay.
5. Nhập sai token 5 lần trong 10 phút thì API trả lời "tạm khoá" cho token sai. Token đúng **luôn vào được**, nên người lạ không khoá được anh.

### Bước 5. Bật chụp số liệu hằng ngày

**Tài chính → ⏰ Bật chụp số liệu 7h sáng hằng ngày**. Mỗi sáng hệ thống ghi một dòng vào tab `Snapshot` (tổng tài sản, từng nhóm, nợ) để vẽ biểu đồ. Bấm **📸 Chụp số liệu ngay** để thử.

### Bước 6. Cho phần Python chạy (GitHub Secrets)

Phần Python cần đọc/ghi Sheet. Trong repo GitHub vào **Settings → Secrets and variables → Actions**, thêm các secret mà `docs/runbook.md` liệt kê (ID của Sheet và khoá tài khoản dịch vụ). Chia sẻ Sheet cho email của tài khoản dịch vụ với quyền **Biên tập viên**. Sau lần chạy đầu, các tab `Assets`, `Prices_Latest`, `Plan`, `Tracking` sẽ có dữ liệu và trang bắt đầu hiện phương án.

---

## Dùng hằng tháng

1. **Đầu tháng:** mở trang, xem thẻ cảnh báo. Với mỗi mục tiêu đang theo dõi, xem số tiền đề xuất gửi tháng này.
2. **Khi gửi/rút tiền thật:** bấm ghi khoản gửi (hoặc rút), chọn mục tiêu, tài sản và số tiền. Giá mới nhất tự điền, có thể gõ số lượng hoặc giá nếu khác.
3. **Tài sản nhập tay** (tiền gửi, quỹ trái phiếu...): mỗi tháng cập nhật lãi suất hoặc giá ở mục "Giá nhập tay".
4. **Mục tiêu mới:** bấm thêm mục tiêu. Trang báo ngay "Ước tính X triệu/tháng"; sau lần chạy Python kế tiếp sẽ có 3 phương án để chọn.
5. **Ngân sách:** nhập thu nhập, chi cố định, chi linh hoạt và các khoản nợ. Trang cho biết tháng này dư bao nhiêu, quỹ khẩn cấp đủ mấy tháng và việc nào giúp đạt mục tiêu sớm nhất.
6. **Sai số liệu:** sửa thẳng trong Sheet (không đổi tên tab, không chèn cột giữa, không xoá dòng tiêu đề). Số dư sai thì dùng "Đặt lại số dư".

Quy ước nhập: `tien_co_san` là tiền có sẵn lúc đặt mục tiêu, tính bằng loại tiền của mục tiêu và **không nhập lại vào Holdings**. Giá trị hiện tại của mục tiêu = `tien_co_san` + giá trị các khoản đã gửi cho mục tiêu đó.

---

## Cho người sửa code

Chạy test: `npm test` (các file `.gs` thật chạy trong Node bằng `node:vm`, múi giờ Asia/Ho_Chi_Minh).

Các hàm tính là **hàm thuần**, không gọi dịch vụ Google. Mọi lệnh ghi trả về một plan `{ appends: {Tab:[dòng]}, updates: {Tab:[{key, changes}]}, seq }`. Chỉ `sheet-repository.gs` ghi plan vào Sheet: **tab `Contributions` (sổ gửi/rút) được ghi trước `Holdings`**, để lỗi giữa chừng không làm mất sổ.

### Các file trong `apps-script/`

| File | Việc |
|---|---|
| `appsscript.json` | Múi giờ GMT+7, web app chạy bằng quyền chủ Sheet |
| `formatting-and-date-helpers.gs` | Hàm ngày, tiền, text, `sanitizeCell` (chống công thức độc) |
| `domain-constants.gs` | Tên tab, header (khớp `src/taichinh/sheets/tabs.py`), enum, giới hạn, mặc định Config |
| `goal-math.gs` | Công thức gửi hằng tháng, số tháng đạt mục tiêu |
| `portfolio-valuation.gs` | Giá (Prices_Latest + Manual_Prices), giá trị danh mục, lệch phân bổ |
| `budget-metrics-engine.gs` | Thu/chi/dư theo tháng, quỹ khẩn cấp, hướng cải thiện, đòn bẩy |
| `dashboard-goal-views.gs` | Dữ liệu từng mục tiêu (tiến độ, 3 phương án, lệch) |
| `dashboard-alert-rules.gs` | Luật cảnh báo đỏ/vàng/xanh |
| `dashboard-payload-builder.gs` | Ghép toàn bộ dữ liệu cho trang (dưới 100 KB), `history` |
| `action-planner-common.gs` | `planAction`, đọc/kiểm tra dữ liệu vào, tạo ngữ cảnh |
| `goal-planners.gs` | `goal_save`, `goal_choose_plan`, `goal_set_status` |
| `budget-planners.gs` | `budget_save`, `budget_delete` |
| `contribution-and-holding-planners.gs` | `contribution_add`, `holding_set` |
| `market-and-config-planners.gs` | `price_manual_add`, `config_save` |
| `sheet-repository.gs` | Đọc tab (chịu được tab Python rỗng/thiếu), ghi plan |
| `setup-sheets-one-time.gs` | `setupSheets`: tạo 12 tab, định dạng, danh sách chọn |
| `access-token-guard.gs` | Kiểm tra token, khoá khi truy cập sai |
| `main-web-app-handlers.gs` | `doGet`/`doPost`, khoá ghi, cache, chống ghi trùng |
| `owner-menu-and-snapshot-trigger.gs` | Menu Sheet, tạo link, chụp số liệu hằng ngày |

### API

`POST` body `text/plain` JSON `{ t, action, data, requestId }` → `{ok:true,...}` hoặc `{ok:false,error,unauthorized?,locked?}`. `GET` → `{ok:true,service:'tai-chinh-ca-nhan'}`.

| action | data | Ghi chú |
|---|---|---|
| `dashboard` | `{nocache?}` | Tổng hợp toàn bộ, cache 120 giây, mọi lệnh ghi xoá cache |
| `history` | `{goal_id?, offset=0, limit=50}` | `{rows,total}` từ `Contributions`, mới nhất trước, cùng dạng `recent` |
| `goal_save` | `{goal_id?, ten, so_tien_dich, tien_te, ngay_dich \| so_thang, tien_co_san, ho_so_rui_ro, uu_tien, ghi_chu}` | Thêm hoặc sửa; trả "Ước tính X triệu/tháng" |
| `goal_choose_plan` | `{goal_id, phuong_an}` | Phương án phải có trong tab `Plan` |
| `goal_set_status` | `{goal_id, trang_thai}` | `dang`, `da_dat`, `huy` |
| `budget_save` | `{budget_id?, loai, ten, so_tien, chu_ky, lai_suat_nam?, tra_toi_thieu?}` | `lai_suat_nam` gõ theo % (12 = 12%/năm), lưu dạng thập phân |
| `budget_delete` | `{budget_id}` | Xoá mềm (`trang_thai = xoa`) |
| `contribution_add` | `{goal_id, asset_id, loai, so_tien_vnd, so_luong?, gia_don_vi?, ngay?, ghi_chu?}` | Ghi sổ + cập nhật `Holdings`. Chặn rút quá số đang có, chặn trên `gui_toi_da_1_lan`, trùng `requestId` thì trả "Đã ghi trước đó." |
| `holding_set` | `{asset_id, goal_id, so_luong, gia_von_vnd?}` | Ghi đè số dư |
| `price_manual_add` | `{asset_id, gia?, lai_suat_nam?, ngay?, ghi_chu?}` | Chỉ tài sản `nhap_tay`; giá lệch quá 30% bị từ chối; lãi gõ theo %, 0 đến 30 |
| `config_save` | `{values:{key:value}}` | Chỉ các khoá cho phép; `site_url`, `sheet_url` sửa trong Sheet |

Mọi lệnh ghi: khoá 15 giây, kết quả trả về là dữ liệu `dashboard` mới kèm `message` (và `replayed:true` nếu là lần gửi lại).

### Đơn vị (hai bên thống nhất)

- Trong Sheet mọi lãi suất/xác suất là **số thập phân** (0.054 = 5,4%; `phan_bo_json` pct 0 đến 1).
- Trang web nhận `lai_suat_nam` theo **phần trăm** (5.4), `tien_do_pct`, `muc_tieu_pct`, `hien_tai_pct`, `phan_bo[].pct` trên thang 0 đến 100; `xac_suat_dat` và `ty_le_tiet_kiem` giữ dạng 0 đến 1.
- `Tracking.lech_phan_bo_json` = `[{asset_id, lech_pct}]` (thực tế trừ mục tiêu, 0 đến 1). Trang đổi thành `{asset_id, muc_tieu_pct, hien_tai_pct}`.
- `Config`: ngoài các ngưỡng cảnh báo còn có `kich_ban` (`low|base|high`) và `tai_san_nuoc_ngoai` (0 hoặc 1) cho phần Python.

### Thêm cột mới

Chỉ thêm vào **cuối** danh sách header trong `domain-constants.gs` **và** `src/taichinh/sheets/tabs.py`, rồi thêm cột ở cuối tab. Test `tests/sheet-contract.test.mjs` so hai bên và báo lỗi nếu lệch.
