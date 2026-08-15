# Backup Context — v594 — 15/08/2026 20:18 MMT

## Khắc phục sự cố Báo cáo 4, 5, Xóa tin cũ và Site Down Relay
1. **Khắc phục nghẽn xóa tin cũ & Timeout 70 vòng lặp**:
   - Chuyển đổi toàn bộ cơ chế xóa tin nhắn cũ trong `delete_old_helper.py` sang **Telethon Single-Pass Batch Scan (`delete_by_titles_batch_telethon`)**.
   - Thay vì lặp 70 lần `iter_messages(300)` gây chậm 140s và chạm Telegram FloodWait làm tê liệt tài khoản, nay chỉ quét đúng 1 lần cho mỗi group (< 3s).
2. **Khắc phục chuỗi chạy Báo cáo 1-4 trong `train_5min.yml`**:
   - Thêm cơ chế cô lập lỗi `|| true` cho từng lệnh `python daily_bod_assign.py || true`, `python backlog_send.py --now || true`, `python cron_send.py || true` để đảm bảo nếu một báo cáo gặp sự cố bảng tính thì Báo cáo 4 và các báo cáo khác vẫn gửi bình thường.
   - Thêm cơ chế quét xóa Telethon sạch sẽ vào `backlog_send.py` trước khi gửi Báo cáo 1, 2, 3 mới.
3. **Khắc phục Site Down Relay (`botlookup_relay.py`)**:
   - Loại bỏ thao tác duyệt 200 dialogs chậm chạp (`get_dialogs(limit=200)`), trỏ trực tiếp đến nhóm Botlookup qua `get_entity(SOURCE_GROUP)`.
   - Giảm tải session và chống đè phiên Telethon giữa các tiến trình.

## Bảng ánh xạ Chuyến Tàu — Toa Tàu — Số Ghế
- **CHUYẾN TÀU 1: CHUYẾN TÀU REPORT & TELEGRAM DISPATCH LINE**
  - `Toa 1+11`: Daily Task & Backlog Reports 1, 2, 3, 4 + BOD Assign (Ghế 1-A đến 1-D, Ghế 11-A đến 11-D).
  - `Toa 5`: Daily Plan Report 5 (Ghế 5-A đến 5-D).
  - `Toa 6`: Daily Note Read Report 6 (Ghế 6-A đến 6-D).
- **CHUYẾN TÀU 2: CHUYẾN TÀU SITE DOWN & REFUEL LINE**
  - `Toa Relay Botlookup`: Dedicated :06/:36 MMT Runner (Ghế RELAY-1 đến RELAY-4).
