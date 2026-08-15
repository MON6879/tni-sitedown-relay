# Backup Context — v597 — 15/08/2026 20:47 MMT

## Khắc phục sự cố Refuel không gửi tin đúng giờ
1. **Phát hiện nguyên nhân trôi giờ của Refuel trong `train_5min.yml`**:
   - Hàm `check_time` trước đây có dung sai quá hẹp `DIFF <= 2` (±2 phút).
   - Khi GitHub Actions runner có độ trễ hàng đợi từ 2.5 đến 3 phút (ví dụ mốc 18:06 chạy lúc 18:09 hoặc mốc 13:06 chạy lúc 13:09), `DIFF = 3 > 2` dẫn đến việc điều kiện trả về False và **BỎ QUA KHÔNG GỬI BÁO CÁO REFUEL**!
2. **Nâng cấp Dung Sai & Cô Lập Lỗi**:
   - Tăng dung sai `check_time` lên `DIFF <= 3` (±3 phút), bắt trọn vẹn chu kỳ nhịp 5 phút của đoàn tàu `train_5min.yml` mà không sợ bị lọt nhịp khi runner khởi động trễ.
   - Bọc cô lập lỗi `|| true` cho toàn bộ các Toa 8, 9, 10, 11 (Refuel Send & Refuel Plan Reports) để không làm đứt chuỗi tiến trình.

## Bảng ánh xạ Chuyến Tàu — Toa Tàu — Số Ghế
- **CHUYẾN TÀU 1: CHUYẾN TÀU REPORT & REFUEL LINE**
- `Toa 8`: Refuel Request Report (`refuel_send.py`) — 05:48, 07:06, 13:06, 15:56 MMT (Ghế 8-A đến 8-D).
- `Toa 9`: Refuel Plan Report 1 (`refuel_plan_report.py --report 1`) — 13:11, 21:36 MMT.
- `Toa 10`: Refuel Plan Report 2 + 2.1 (`refuel_plan_report.py --report 2 1`) — 13:11, 18:06, 21:36 MMT.
- `Toa 11`: Refuel Plan Report 4 (`refuel_plan_report.py --report 4`) — 21:36 MMT.
