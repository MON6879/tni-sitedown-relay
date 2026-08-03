# 📌 System Snapshot Backup — 03/08/2026 (FINAL FREEZE & SAVE)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot đã tối ưu và đóng băng ngày 03/08/2026.**

---

## 🗺️ Bản đồ phân bổ Repository & Service

| Repository / Service | Chế độ | Remote URL | Vai trò chính |
|---|---|---|---|
| **`MON6879/tni-sitedown-relay`** | 🟢 **PUBLIC** | `https://github.com/MON6879/tni-sitedown-relay.git` | **Nơi duy nhất chạy tự động 24/7 Báo cáo 1, 2, 3, 4, 5, 6, Refuel, Cable, Site Down & Keepalive 5 min cho Search & Asset Bot** (Miễn phí 100% không giới hạn) |
| **`MON6879/TNI-DONE`** | 🔒 **PRIVATE** | `https://github.com/MON6879/TNI-DONE.git` | Codebase Search Bot v3.6 |
| **`phonghdpxd-cmd/tni-bot`** | 🔒 **PRIVATE** | `https://github.com/phonghdpxd-cmd/tni-bot.git` | Webhook handler trên Vercel (`api/collector.py`, `api/search_bot.py`) |
| **Vercel Project** | Cloud Serverless | `tni-bot.vercel.app` & `tni-done.vercel.app` | Xử lý Webhook tức thì < 0.2s cho Search & Asset Bot |
| **Google Apps Script** | Google Cloud | Live Web Apps | Backend dữ liệu & Keepalive 5 min |

---

## ⏰ Cấu hình Lịch chạy Báo cáo Chuẩn đã khóa (`daily_reports.yml` & `keepalive_search_bot.yml`)

### 1. Search & Asset Bot Keepalive 24/7 (5 phút / lần):
- 🔄 **`keepalive_search_bot.yml`** chạy trên repo **PUBLIC** `MON6879/tni-sitedown-relay` (`cron: '*/5 * * * *'`): Ping tự động 3 server Vercel (`search_bot` & `collector`) mỗi 5 phút **MIỄN PHÍ 100% KHÔNG GIỚI HẠN**, đảm bảo cả Search Bot và Asset Bot không bao giờ ngủ quên và Webhook Telegram luôn hoạt động 24/7!

### 2. Báo cáo 1, 2, 3, 4 (Backlog & Daily Task), Refuel Request & Cable Report:
- 🌅 **Ca Sáng**: **05:45 SÁNG** (23:15 UTC ngày hôm trước)
- 🌆 **Ca Chiều**: **16:20 CHIỀU** (09:50 UTC) — Tập trung gửi đồng loạt Báo cáo 1, 2, 3, 4, 5A, 6, Refuel Request & Cable Report

### 3. Báo cáo 5.1 (Nhắc nộp Kế hoạch sáng & tối):
- 🌅 **Ca Sáng**: **05:25, 08:25, 09:50 SÁNG** (Giờ Myanmar)
- 🌆 **Ca Tối**: **15:20, 19:00, 22:00 TỐI** (Giờ Myanmar)

### 4. Báo cáo 5B (Plan Update) & Báo cáo 6 (Read Status):
- 📌 **Report 5B**: **21:00 TỐI** (14:30 UTC)
- 📌 **Report 6**: **14:00, 17:15, 19:00, 20:30** (Giờ Myanmar)

---

## 🛠️ Sửa biểu tượng Trạng thái Báo cáo 4 (`cron_send.py`)
- **Khớp chuẩn với Chú thích Legend (`🟢 >=50%Hit  🟡 >=30%  🔴 <30%Lost`)**:
  - Chỉ khi Close% đạt **$\ge 50\%$** mới hiển thị icon `🟢` và dấu `✅`.
  * Từ **$30\%$ đến $<50\%$** (ví dụ $39.6\%$): Hiển thị icon **`🟡`** (Yellow) ở cả 2 phía, KHÔNG hiển thị nhầm dấu `✅` xanh lá.
  * Dưới **$30\%$**: Hiển thị icon `🔴` và dấu `🛑`.

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
