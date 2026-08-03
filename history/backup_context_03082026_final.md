# 📌 System Snapshot Backup — 03/08/2026 (FINAL FREEZE)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot đã tối ưu và đóng băng ngày 03/08/2026.**

---

## 🗺️ Bản đồ phân bổ Repository & Service

| Repository / Service | Chế độ | Remote URL | Vai trò chính |
|---|---|---|---|
| **`MON6879/tni-sitedown-relay`** | 🟢 **PUBLIC** | `https://github.com/MON6879/tni-sitedown-relay.git` | **Nơi duy nhất chạy tự động 24/7 Báo cáo 1, 2, 3, 4, 5, 6, Refuel, Cable & Site Down** (Miễn phí 100% không giới hạn) |
| **`MON6879/TNI-DONE`** | 🔒 **PRIVATE** | `https://github.com/MON6879/TNI-DONE.git` | Codebase Search Bot v3.6 |
| **`phonghdpxd-cmd/tni-bot`** | 🔒 **PRIVATE** | `https://github.com/phonghdpxd-cmd/tni-bot.git` | Webhook handler trên Vercel (`api/collector.py`, `api/search_bot.py`) |
| **Vercel Project** | Cloud Serverless | `tni-bot.vercel.app` & `tni-done.vercel.app` | Xử lý Webhook tức thì < 0.2s cho Search & Asset Bot |
| **Google Apps Script** | Google Cloud | Live Web Apps | Backend dữ liệu & Keepalive 5 min |

---

## ⏰ Cấu hình Lịch chạy Báo cáo 16:20 Myanmar Time (`daily_reports.yml`)

- **Cron Expression**: `50 9 * * *` (09:50 UTC = **16:20 CHIỀU Giờ Myanmar**)
- **Thứ tự xếp hàng thực thi**:
  1. `daily_bod_assign.py` ➔ Report 2 BOD Assign
  2. `backlog_send.py --now` ➔ Reports 1, 2, 3 lần lượt tới từng Team & CONTROL
  3. `cron_send.py` ➔ Report 4 (Daily Task & Stats) lần lượt tới từng Team & CONTROL
  4. `daily_plan_report.py --mode eod` ➔ Report 5A (Daily Plan EOD)
  5. `daily_read_report.py` ➔ Report 6 (Note Read Status)
  6. `cable_report.py` ➔ Cable Daily Report

---

## 🔗 Đường link Live Google Apps Script
- **Main Apps Script URL**: `https://script.google.com/macros/s/AKfycbwHyzulEMVGjslfjN_m38HzpFZHRfk2qwbQmdwb6MMqBM8xNm20JJxxzW_4zTNzp3n24Q/exec`
- **Search GAS Keepalive**: `search_bot.gs` (`pingSearchBot()` trigger 5 min)

---

## 🔒 Cam kết bảo mật
- Mọi Google Spreadsheet ID đều được nạp qua biến môi trường `SPREADSHEET_ID`.
- Mọi Telegram Bot Token nằm trong GitHub Encrypted Secrets và Vercel Environment Variables.
