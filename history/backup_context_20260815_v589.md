# Backup Context — v589 — 15/08/2026 13:10 MMT

## Mô tả sự cố & Nguyên nhân gốc rễ (Root Cause Analysis)
1. **Sự cố gửi lúc 11:25 MMT**: Trong `14_GITHUB_DISPATCH.gs`, hàm `setupGitHubDispatchTriggers()` trước đó đã tạo 1 trigger Google Apps Script (GAS) 30 phút (`everyMinutes(30)`) cho `dispatchBotlookupRelay()`. Trong GAS, `everyMinutes(30)` chạy theo mốc thời gian tạo trigger (ví dụ XX:25 / XX:55), không khớp với mốc :06 / :36, làm phát lệnh cào lúc 11:25.
2. **Sự cố gửi lúc 12:00 MMT (chậm trễ & sai giờ)**: Cron trong `botlookup_relay.yml` được đặt là `3,33 * * * *` UTC (= :03 và :33 MMT). Khi runner khởi động lúc 05:33 UTC (12:03 MMT), do bản cập nhật v588 đã xóa hàm `wait_until_target_minute()`, script chạy ngay lập tức lúc 12:00-12:03 MMT mà không chờ đến :06/:36.
3. **Hiện tượng chạy tùm lum (Multiple conflicting triggers)**: `site_down_v2.gs` trong `checkAndSend()` có đoạn code tự động gọi `triggerBotlookupRelay()` mỗi 5 phút (`minute % 5 === 0`), liên tục spam GitHub API dispatches.

## Giải pháp & Các thay đổi thực hiện (Implementation)
1. **Khôi phục & nâng cấp `wait_until_target_minute(force)` trong `botlookup_relay.py`**:
   - Tự động tính toán khoảng cách giây tới mốc target gần nhất (:06:00 hoặc :36:00 MMT).
   - Nếu runner khởi động sớm lúc :03 hoặc :33 MMT, script sẽ sleep chính xác số giây còn lại (~180s) để gửi lệnh `/down_tni@auto_nocpro_bot` đúng 100% tại :06:00 hoặc :36:00 MMT.
   - Nếu trễ nhẹ (:06:00 - :06:59 hoặc :36:00 - :36:59 MMT): Chạy ngay (0s delay).
   - Nếu bị trigger lệch xa ngoài khung giờ (> 300s, ví dụ :15, :25, :45, :55) và không có cờ `--force`: Tự động HỦY CHẠY (Abort) để chống spam tin sai giờ.
2. **Cập nhật `botlookup_relay.yml`**:
   - Thêm `concurrency: { group: botlookup-relay, cancel-in-progress: false }` chống chạy chồng chéo runner.
   - Chỉ truyền cờ `--force` khi user chạy thủ công (`workflow_dispatch`), các lần chạy định kỳ theo cron `3,33 UTC` sẽ tuân thủ nghiêm ngặt `wait_until_target_minute()`.
3. **Làm sạch `14_GITHUB_DISPATCH.gs`**:
   - Xóa bỏ trigger 30 phút ngẫu nhiên của GAS trong `setupGitHubDispatchTriggers()`, chỉ giữ lại trigger 5 phút `dispatchTrain5Min`.
4. **Làm sạch `site_down_v2.gs`**:
   - Xóa bỏ đoạn mã dispatch 5 phút (`minute % 5 === 0`) trong `checkAndSend()`, chấm dứt việc spam trigger sang GitHub Actions.

## Bảng ánh xạ Chuyến Tàu — Toa Tàu — Số Ghế
- **CHUYẾN TÀU SỐ 3 (Scheduled Automation)**
- **TOA SITE DOWN RELAY (Độc Lập)**
- **DÃY GHẾ SD-RELAY (Ghế SD-RELAY-1 đến SD-RELAY-4)**:
  - `Ghế SD-RELAY-1`: Cron Trigger & Time Waiter (`botlookup_relay.py` Telethon command `/down_tni@auto_nocpro_bot` tại đúng :06 và :36 MMT).
  - `Ghế SD-RELAY-2`: Ingest NOC Pro response parser.
  - `Ghế SD-RELAY-3`: Forward relay to Sheet Site Down (`1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow`).
  - `Ghế SD-RELAY-4`: Ingestion Row 2 Insertion & Telegram Bot Send to 4 Teams + Control Group.

## Repos đồng bộ
- **MON6879/tni-sitedown-relay**: `botlookup_relay.py`, `botlookup_relay.yml`, `apps_script/14_GITHUB_DISPATCH.gs`, `site_down_v2.gs`.
- **phonghdpxd-cmd/tni-bot**: `botlookup_relay.py`, `apps_script/14_GITHUB_DISPATCH.gs`, `apps_script/site_down_v2.gs`.
