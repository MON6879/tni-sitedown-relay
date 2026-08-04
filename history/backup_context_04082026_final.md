# 📌 System Snapshot Backup — 04/08/2026 (SEARCH BOT STABILITY & FLUSH 200 OK FIX)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot - Xử lý dứt điểm nguyên nhân Search Bot ngắt kết nối Webhook.**

---

## ⚡ NGUYÊN NHÂN CỐT LÕI & GIẢI PHÁP SEARCH BOT (`api/search_bot.py`)

- **Phát hiện nguyên nhân cốt lõi**:
  1. Trong `do_POST()` trước đây, hàm `handle(data)` thực thi lệnh tra cứu (gọi CSV Google Sheets) **TRƯỚC KHI** phát phản hồi `200 OK` cho Telegram.
  2. Khi Google Sheets bị trễ hoặc nghẽn mạng (>10-15s), request bị Vercel ngắt timeout. Telegram không nhận được HTTP 200 OK nên tiến hành gửi lại (retry) nhiều lần.
  3. Sau nhiều lần retry bị timeout, Telegram **TỰ ĐỘNG HỦY / XÓA WEBHOOK (`Webhook was deleted`)**, dẫn tới việc Search Bot ngưng phản hồi hoàn toàn!

- **Khắc phục triệt để**:
  1. **Đổi thứ tự phản hồi**: Phát tiêu đề và nội dung HTTP `200 OK` (`self.wfile.flush()`) **NGAY LẬP TỨC trong 2ms** khi nhận Webhook từ Telegram.
  2. **Thực thi ngầm**: Telegram nhận `200 OK` tức thì nên **tuyệt đối không bao giờ hủy hay xóa Webhook nữa**.
  3. **Thực hiện reset & Khóa lại Webhook**: Webhook đã được gắn cố định về `https://tni-bot.vercel.app/api/search_bot`.

---

## ⚡ ĐỒNG BỘ MÃ NGUỒN VÀ REPOSITORY
- **Hồ sơ file đã cập nhật**:
  * `Task and WO/api/search_bot.py`
  * `Task and WO/apps_script/site_down_v2.gs`
  * `Task and WO/tni_site_down_repo/site_down_v2.gs`
  * `Task and WO/api/collector.py`
  * `Task and WO/daily_plan_report.py`
  * `tni-sitedown/daily_plan_report.py`
