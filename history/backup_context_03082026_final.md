# 📌 System Snapshot Backup — 03/08/2026 (FINAL FREEZE & SAVE)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot đã tối ưu và đóng băng ngày 03/08/2026.**

---

## 🗺️ Bản đồ phân bổ Repository & Service

| Repository / Service | Chế độ | Remote URL | Vai trò chính |
|---|---|---|---|
| **`MON6879/tni-sitedown-relay`** | 🟢 **PUBLIC** | `https://github.com/MON6879/tni-sitedown-relay.git` | **Nơi duy nhất gánh 100% tự động 24/7 Báo cáo 1, 2, 3, 4, 5, 6, Refuel, Cable, Site Down & Keepalive 5 min cho TOÀN BỘ BOT & Auto Copy Paste GAS (Miễn phí 100% không giới hạn)** |
| **`MON6879/TNI-DONE`** | 🔒 **PRIVATE** | `https://github.com/MON6879/TNI-DONE.git` | Codebase Search Bot v3.6 |
| **`phonghdpxd-cmd/tni-bot`** | 🔒 **PRIVATE** | `https://github.com/phonghdpxd-cmd/tni-bot.git` | Webhook handler trên Vercel (`api/collector.py`, `api/search_bot.py`) |
| **Vercel Project** | Cloud Serverless | `tni-bot.vercel.app` & `tni-done.vercel.app` | Xử lý Webhook tức thì < 0.2s cho Search & Asset Bot |
| **Google Apps Script** | Google Cloud | Live Web Apps | Backend dữ liệu & Keepalive 5 min |

---

## 🛠️ Sửa lỗi Webhook Search Bot (`@SEARCHTNITASKWOBOT`)
- **Phát hiện nguyên nhân**: Webhook URL của Search Bot bị trỏ nhầm về `/api/site_down_relay` làm cho bot đứng không trả lời khi tra cứu `TNI0058`, `TNI0009`...
- **Khắc phục**: Đã cài đặt lại và khóa Webhook chuẩn về `https://tni-bot.vercel.app/api/search_bot`. Search Bot đã khôi phục hoạt động tức thì!

---

## ⏰ Cấu hình 3 Workflows Chuẩn đã khóa gọn gàng trên Public Repo (`MON6879/tni-sitedown-relay`)

### 1. `🔄 1. Master Keepalive 24/7 (All Bots)` (`keepalive_all_bots.yml`):
- 🔄 Ping tự động mỗi 5 phút (`cron: '*/5 * * * *'`): Gộp chung ping Search Bot 1 (`tni-bot`), Search Bot 2 (`tni-done`), Asset Bot (`collector`), Site Down Bot (`tni-sitedown`), Google Apps Script Main Backend và Auto Copy Paste GAS Backend (`AKfycbwi3J0V...`). **Đảm bảo tất cả Bot & Tác vụ Copy Paste hoạt động 24/7 vĩnh viễn 100% miễn phí!**

### 2. `📡 2. Site Down Tin 1 Relay (Every 20 Min)` (`botlookup_relay.yml`):
- 📡 Quét tự động đếm trạm Site Down tin 1 mỗi 20 phút (`cron: '*/20 * * * *'`).
- 🛡️ **Cơ chế Ngắt Mạch Thông Minh theo Kế Thừa 3 Lệnh `/down_` Gần Nhất**:
  * Quét lấy **3 lệnh `/down_` gần nhất** trong nhóm `BOT LOOKUP` (của bất kỳ ai trong nhóm).
  * Nếu từ thời điểm lệnh thứ 3 đó đến nay **KHÔNG CÓ BẤT KỲ TIN NHẮN NÀO chứa tiêu đề `Auto Report NocPro`** ➔ XÁC NHẬN BOT CÔNG TY ĐANG LỖI/DOWN ➔ **BỎ QUA KHÔNG GỬI REQUEST MỚI** để tuyệt đối không làm loãng nhóm!
  * Mỗi mốc 20-30 phút chỉ quét xem lịch sử nhóm. Khi nào có tin **`Auto Report NocPro`** xuất hiện (xác nhận Bot Công ty đã sửa xong) ➔ Ngay lập tức tự động mở lại và phát lệnh cào dữ liệu bình thường!

### 3. `📊 3. Unified Daily Reports (Reports 1-6, Refuel, Cable)` (`daily_reports.yml`):
- 📋 Tập trung toàn bộ lịch phát các Báo cáo:
  * **05:45 SÁNG & 16:20 CHIỀU**: Báo cáo 1, 2, 3, 4 (kèm Report 2 BOD Assign), 5A, 6, Refuel Request & Cable Report.
  * **05:25, 08:25, 09:50 AM & 15:20, 19:00, 22:00 PM**: Báo cáo 5.1 (Plan Reminder).
  * **21:00 TỐI**: Báo cáo 5B (Plan Update).
  * **14:00, 17:15, 19:00, 20:30 PM**: Báo cáo 6 (Check Read Status).

---

## 🌐 Quy định ngôn ngữ Báo cáo
- **100% TIẾNG ANH (ENGLISH ONLY)**: Tất cả thông báo, tiêu đề, trạng thái trong các báo cáo tự động đều dùng Tiếng Anh chuẩn.

---

## 🔗 Đường link Live Google Apps Script
- **Main Apps Script URL**: `https://script.google.com/macros/s/AKfycbwHyzulEMVGjslfjN_m38HzpFZHRfk2qwbQmdwb6MMqBM8xNm20JJxxzW_4zTNzp3n24Q/exec`
- **Auto Copy-Paste Apps Script URL**: `https://script.google.com/macros/s/AKfycbwi3J0VrrIE91mnPvIUuykPjwGvNc4y9JDxCNPvJTtOmVAvvalDXu5ZwYZmu5jW-fSo0w/exec`

---

## 🔒 Cam kết bảo mật & Lọc Bot
- Mọi Google Spreadsheet ID đều được nạp qua biến môi trường `SPREADSHEET_ID`.
- Mọi Telegram Bot Token nằm trong GitHub Encrypted Secrets và Vercel Environment Variables.
- Bot Search & Collector tự động lọc bỏ `is_bot`, chỉ thu thập khi người dùng thật gửi tiêu đề `Daily result:`.
