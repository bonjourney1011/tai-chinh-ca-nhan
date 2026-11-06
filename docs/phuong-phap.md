# Phương pháp tính

Tài liệu này giải thích máy tính làm gì khi Mo đặt một mục tiêu. Mọi công thức nằm trong `src/taichinh/engine/`.

## 1. Mục tiêu → số tiền cần gửi mỗi tháng
- Số tiền đích được tính cả lạm phát: `G = G0 × (1 + CPI)^(n/12)` (CPI mặc định 4,5%/năm, sửa trong `config/cma.yml`). Mục tiêu bằng USD chỉ cộng trượt giá USD/VND (2%/năm), không cộng thêm CPI.
- Số tiền gửi tối thiểu mỗi tháng (công thức PMT): `PMT = (G − PV×(1+r)^n) × r / ((1+r)^n − 1)` với `r = (1 + lợi nhuận năm)^(1/12) − 1`.
- PMT này chỉ đạt mục tiêu với xác suất khoảng 50% vì lợi nhuận dao động. Máy chạy mô phỏng Monte Carlo 20.000 kịch bản để tính xác suất đạt và dải kết quả (xấu 5%, trung bình, tốt 95%), rồi tìm số tiền gửi để chắc 80%.

## 2. Chia tiền vào tài sản nào
Bước 1 — trần tài sản rủi ro (cổ phiếu, vàng, ETF Mỹ, BTC) = nhỏ nhất của 5 giới hạn:
| Giới hạn | Quy tắc |
|---|---|
| Thời hạn | dưới 12 tháng 0% · đến 36 tháng 20% · đến 60 tháng 40% · trên 60 tháng 70% |
| Sụt giảm | phần rủi ro không được làm danh mục giảm quá mức hồ sơ cho phép (10/20/35%) |
| Lỗ năm xấu (VaR 95%) | `1,645σ − μ ≤ giới hạn hồ sơ` (8/15/25%) |
| Hồ sơ | bảo thủ 30% · cân bằng 55% · tăng trưởng 80% |
| Ngân sách | quỹ khẩn cấp dưới 3 tháng hoặc phải gửi quá nửa tiền nhàn rỗi → giảm thêm |

Bước 2 — chia bên trong mỗi nhóm bằng danh mục phương sai nhỏ nhất (Markowitz, chỉ mua, có trần từng tài sản như BTC ≤ 5%, vàng ≤ 30%). Máy so thêm 3 cách khác (chia đều rủi ro, chia đều tiền, tangency cổ điển) và chọn cách có xác suất đạt cao nhất.

Lợi nhuận kỳ vọng lấy từ giả định trong `config/cma.yml` (Mo sửa được low/base/high). Độ biến động và tương quan ước từ lịch sử giá tháng (ưu tiên ≥ 120 tháng) có co rút Ledoit-Wolf; lịch sử ngắn thì nghiêng về giả định.

## 3. Ngân sách
- Tỷ lệ tiết kiệm `s = (thu − chi)/thu`; khả thi `F = PMT / tiền nhàn rỗi`; quỹ khẩn cấp = tiền gửi + quỹ trái phiếu chia chi thiết yếu.
- Chi thiết yếu trên 75% thu nhập hoặc `s < 10%` → **tăng thu nhập trước**. Quỹ khẩn cấp dưới 3 tháng và hạn còn trên 12 tháng → **lập quỹ khẩn cấp trước**. `F ≤ 25%` đúng khả năng; `≤ 50%` căng; cao hơn → không khả thi, cần đổi mục tiêu hoặc tăng thu.
- Đòn bẩy xếp theo số tháng rút ngắn: cắt chi biến đổi 10/20/30%, kéo dài hạn, hạ mục tiêu, tăng thu 1/2/5 triệu, dùng lương tháng 13. Nợ: so cả hai cách trả (lãi cao trước và dư nợ nhỏ trước).

## 4. Theo dõi
Mỗi tháng máy so giá trị thực (số đang giữ × giá mới nhất) với quỹ đạo kế hoạch; dưới dải 25% là "chậm". Lệch phân bổ quá 5 điểm % thì gợi ý dồn tiền gửi mới vào tài sản đang thiếu.

## Giới hạn
Giả định lợi nhuận là ước lượng, không phải dự báo. Giá quỹ trái phiếu, lãi suất tiết kiệm, lợi suất trái phiếu chính phủ phải nhập tay hàng tháng. Công cụ chỉ dùng cho cá nhân, không phải tư vấn đầu tư.
