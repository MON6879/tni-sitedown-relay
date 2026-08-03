# 📌 System Snapshot Backup — 03/08/2026 (FINAL FREEZE & SAVE)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot đã tối ưu và đóng băng ngày 03/08/2026.**

---

## 🗺️ Bản đồ phân bổ Repository & Service

| Repository / Service | Chế độ | Remote URL | Vai trò chính |
|---|---|---|---|
| **`MON6879/tni-sitedown-relay`** | 🟢 **PUBLIC** | `https://github.com/MON6879/tni-sitedown-relay.git` | **Nơi duy nhất gánh 100% tự động 24/7 Báo cáo 1, 2, 3, 4, 5, 6, Refuel, Cable, Site Down & Keepalive 5 min cho TOÀN BỘ BOT (Miễn phí 100% không giới hạn)** |
| **`MON6879/TNI-DONE`** | 🔒 **PRIVATE** | `https://github.com/MON6879/TNI-DONE.git` | Codebase Search Bot v3.6 |
| **`phonghdpxd-cmd/tni-bot`** | 🔒 **PRIVATE** | `https://github.com/phonghdpxd-cmd/tni-bot.git` | Webhook handler trên Vercel (`api/collector.py`, `api/search_bot.py`) |
| **Vercel Project** | Cloud Serverless | `tni-bot.vercel.app` & `tni-done.vercel.app` | Xử lý Webhook tức thì < 0.2s cho Search & Asset Bot |
| **Google Apps Script** | Google Cloud | Live Web Apps | Backend dữ liệu & Keepalive 5 min |

---

## ⏰ Cấu hình 3 Workflows Chuẩn đã khóa gọn gàng trên Public Repo (`MON6879/tni-sitedown-relay`)

### 1. `🔄 1. Master Keepalive 24/7 (All Bots)` (`keepalive_all_bots.yml`):
- 🔄 Ping tự động mỗi 5 phút (`cron: '*/5 * * * *'`): Gộp chung ping Search Bot 1 (`tni-bot`), Search Bot 2 (`tni-done`), Asset Bot (`collector`), Site Down Bot (`tni-sitedown`) và Google Apps Script Backend. **Đảm bảo tất cả Bot hoạt động 24/7 vĩnh viễn 100% miễn phí!**

### 2. `📡 2. Site Down Tin 1 Relay (Every 20 Min)` (`botlookup_relay.yml`):
- 📡 Quét tự động đếm trạm Site Down tin 1 mỗi 20 phút (`cron: '*/20 * * * *'`).

### 3. `📊 3. Unified Daily Reports (Reports 1-6, Refuel, Cable)` (`daily_reports.yml`):
- 📋 Tập trung toàn bộ lịch phát các Báo cáo:
  * **05:45 SÁNG & 16:20 CHIỀU**: Báo cáo 1, 2, 3, 4, 5A, 6, Refuel Request & Cable Report.
  * **05:25, 08:25, 09:50 AM & 15:20, 19:00, 22:00 PM**: Báo cáo 5.1 (Plan Reminder).
  * **21:00 TỐI**: Báo cáo 5B (Plan Update).
  * **14:00, 17:15, 19:00, 20:30 PM**: Báo cáo 6 (Check Read Status).

---

## 🌐 Quy định ngôn ngữ Báo cáo
- **100% TIẾNG ANH (ENGLISH ONLY)**: Tất cả thông báo, tiêu đề, trạng thái trong các báo cáo tự động đều dùng Tiếng Anh chuẩn.

---

## 🔗 Đường link Live Google Apps Script
- **Main Apps Script URL**: `https://script.google.com/macros/s/AKfycbwHyzulEMVGjslfjN_m38HzpFZHRfk2qwbQmdwb6MMqBM8xNm20JJxxzW_4zTNzp3n24Q/exec`
- **Search GAS Keepalive**: `search_bot.gs` (`pingSearchBot()` trigger 5 min ping cả `tni-bot` & `tni-done`)

---

## 🔒 Cam kết bảo mật & Lọc Bot
- Mọi Google Spreadsheet ID đều được nạp qua biến môi trường `SPREADSHEET_ID`.
- Mọi Telegram Bot Token nằm trong GitHub Encrypted Secrets và Vercel Environment Variables.
- Bot Search & Collector tự động lọc bỏ `is_bot`, chỉ thu thập khi người dùng thật gửi tiêu đề `Daily result:`.
