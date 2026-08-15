# Backup Context — v595 — 15/08/2026 20:26 MMT

## Khắc phục triệt để lỗi Site Down Relay bị hủy / đứng liên tục
1. **Phát hiện lỗ hổng tính toán thời gian `wait_until_target_minute`**:
   - Trước đây, nếu GitHub Actions khởi động trễ dù chỉ 1-2 phút (ví dụ :07 hoặc :37 MMT), script tính khoảng cách đến mốc kế tiếp là 28 phút (> 300 giây) và **tự động HỦY CHẠY (Abort)**!
   - Điều này khiến 80% các lần chạy tự động trên GitHub Actions bị hủy bỏ âm thầm, dẫn đến việc Site Down không được cập nhật trong nhiều giờ.
2. **Nâng cấp Cửa sổ Kháng trễ (Resilient Timing Window)**:
   - Nếu runner khởi động sớm (:00-:05 hoặc :20-:35 MMT) $\rightarrow$ Tự động sleep đến đúng :06:00 hoặc :36:00 MMT rồi phát lệnh.
   - Nếu runner khởi động trễ (:06-:20 hoặc :36-:50 MMT) $\rightarrow$ Chạy ngay lập tức với độ trễ 0s, **TUYỆT ĐỐI KHÔNG HỦY BỎ**.
   - Chế độ thủ công / Force: Chạy tức thì 100%.

## Bảng ánh xạ Chuyến Tàu — Toa Tàu — Số Ghế
- **CHUYẾN TÀU 2: CHUYẾN TÀU SITE DOWN & REFUEL RELAY LINE**
- **TOA RELAY BOTLOOKUP (:06 & :36 MMT)**:
  - `Ghế RELAY-1`: Resilient Timing Window Engine (`wait_until_target_minute`).
  - `Ghế RELAY-2`: Direct Entity Resolution (`get_entity(SOURCE_GROUP)`).
  - `Ghế RELAY-3`: Smart NOC PRO Response Parser & Fallback.
  - `Ghế RELAY-4`: GAS Webhook Transmitter & Dual A1/AW7 Dispatcher.
