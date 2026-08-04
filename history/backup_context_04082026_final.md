# 📌 System Snapshot Backup — 04/08/2026 (FINAL SAVE)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot - Khôi phục Webhook Search Bot & Fix thu thập Daily Plan ngày 04/08/2026.**

---

## 🔍 Khôi Phục & Tự Động Khóa Webhook Cho Search Bot (`api/search_bot.py`)
- **Phát hiện nguyên nhân Search Bot bị đứng / không phản hồi**:
  1. Trạng thái Webhook của Search Bot (`@SEARCHTNITASKWOBOT`) trước đó bị ngắt kết nối (`Webhook is already deleted`).
- **Khắc phục triệt để**:
  1. Đã gọi lệnh `reset` khóa lại Webhook chuẩn: `https://tni-bot.vercel.app/api/search_bot` (Trả về `ok: true`, `pending_update_count: 0`).
  2. Bổ sung cơ chế tự động kiểm tra & gắn lại Webhook trong `do_GET()` của `api/search_bot.py`: Mỗi khi endpoint Vercel được ping, hệ thống tự động duy trì liên kết Webhook đến Telegram 100% không lo bị nhả liên kết.

---

## 🐞 Sửa Lỗi Thu Thập Daily Plan Của Team Leader (`is_daily_plan()` Bug Fix)
- **Chuẩn hóa thu thập Plan**:
  1. Loại bỏ các hạn chế chuỗi thừa trong `is_daily_plan()`. Đội trưởng copy/forward nguyên mẫu tin (`Daily Plan Template`, `Copy → Edit → Send back:`) vẫn được bot nhận diện 100% là Plan thật.
  2. Trích xuất chính xác ngày từ `Daily Plan: DD/MM/YYYY` lưu vào Cột B `Date`.
  3. Đã nạp thành công Plan cho Team 3 (Mã `DP-158`) ngày 04/08/2026 vào Google Sheet.

---

## 🎨 Chuẩn Hóa Màu Icon Team Báo Cáo Site Down (`site_down_v2.gs`)
- **Master Standard Team Color Palette**:
  * **Team 1** (Dawei): 🟠 **Orange (Chấm Cam)**
  * **Team 2** (Myeik): 🔵 **Blue (Chấm Xanh Dương)**
  * **Team 3** (Bokpyin): 🟢 **Green (Chấm Xanh Lá)**
  * **Team 4** (Kawthoung): 🟡 **Yellow (Chấm Vàng)**

---

## ⚡ ĐỒNG BỘ MÃ NGUỒN VÀ REPOSITORY
- **Hồ sơ file đã cập nhật**:
  * `Task and WO/api/search_bot.py`
  * `Task and WO/api/collector.py`
  * `Task and WO/daily_plan_report.py`
  * `tni-sitedown/daily_plan_report.py`
  * `Task and WO/apps_script/site_down_v2.gs`
  * `Task and WO/tni_site_down_repo/site_down_v2.gs`
