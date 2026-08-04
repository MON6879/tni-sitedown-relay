# 📌 System Snapshot Backup — 04/08/2026 (SEARCH BOT REALTIME DAILY PLAN COLLECTION FULL FIX)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot - Tích hợp thu thập & Phản hồi Daily Plan trực tiếp trong Search Bot (`api/search_bot.py`).**

---

## ⚡ PHÁT HIỆN NGUYÊN NHÂN CỐT LÕI & GIẢI PHÁP TRIỆT ĐỂ 100%

- **Phát hiện nguyên nhân vì sao trong các nhóm Telegram (`TNI TEAM 1`..`TNI TEAM 4`) Bot không thu thập & không phản hồi**:
  1. Trong các nhóm Telegram của 4 Team, con Bot hoạt động chính nhận tin nhắn từ Telegram Webhook chính là **Search Bot (`@SEARCHTNITASKWOBOT`)**.
  2. Trước đó, mã nguồn `api/search_bot.py` **chưa được tích hợp bộ xử lý `is_daily_plan()` và `store_daily_plan_to_sheet()`**.
  3. Do đó, khi Đội trưởng/Thành viên đăng tin nhắn `Daily Plan: DD/MM/YYYY` vào nhóm, `api/search_bot.py` nhận được request nhưng không có hàm xử lý Daily Plan nên bỏ qua ngầm ➔ Dẫn tới không lưu vào Google Sheet và không nhắn lại câu phản hồi!

- **Đã khắc phục triệt để**:
  1. Tích hợp trực tiếp bộ ba hàm `is_daily_plan()`, `parse_plan_fields()`, `store_daily_plan_to_sheet()` vào `api/search_bot.py`.
  2. Mỗi khi bất kỳ Đội trưởng/Thành viên nào gửi tin nhắn Plan vào nhóm, Search Bot lập tức:
     - Trích xuất chính xác Ngày & Đội (`04/08/2026`, `Team 3`).
     - Gọi Apps Script lưu trực tiếp vào tab `Team leader assign Plan` trên Google Sheet.
     - Phát tin nhắn phản hồi ngay tại nhóm: `📋 Plan saved — REF:DP-xxx | Team X | DD/MM/YYYY`.

---

## ⚡ ĐỒNG BỘ MÃ NGUỒN VÀ REPOSITORY
- **Hồ sơ file đã cập nhật**:
  * `Task and WO/api/search_bot.py`
  * `Task and WO/api/collector.py`
  * `Task and WO/apps_script/site_down_v2.gs`
  * `Task and WO/tni_site_down_repo/site_down_v2.gs`
  * `Task and WO/daily_plan_report.py`
  * `tni-sitedown/daily_plan_report.py`
