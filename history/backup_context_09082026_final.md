# 📄 BACKUP CONTEXT — 09/08/2026 (FINAL)

## 📌 Tóm tắt Thay đổi & Tối ưu Hệ thống (Fuel & Construction)

---

### 1. ⛽ Cấu hình Báo cáo Fuel & Refuel Plan (`refuel_plan_report.py` & `refuel_send.py`)
- **Sửa lỗi đếm Refueled:** Sửa lệch cột đọc dữ liệu từ tab `Refueled` trong `refuel_plan_report.py`:
  - `date_val`: Cột 2 (B) - Ngày
  - `site`: Cột 4 (D) - Mã Site ID
- **Báo cáo Request Refuel (Cột Y tab `Need Refuel`):**
  - Chạy bằng `refuel_send.py`.
  - Tải dữ liệu CSV từ ô Y2:Y10 tab `Need Refuel`.
  - Khung giờ gửi tự động (Myanmar Time UTC+6:30): **05:39 AM**, **13:29 PM**, **21:14 PM**.
  - Đã gửi thử nghiệm thành công vào Group Telegram **9 TNI REQUEST REFUEL** (`-5469544739`).

---

### 2. 🏗️ Chuyển Construction Bot Keep-Alive sang Public Repo (`TNI-SITE-DOWN`)
- **Nguyên nhân:** Workflow `keepalive_construction.yml` cũ chạy 5 phút/lần (288 lần/ngày) trên repo Private `phonghdpxd-cmd/tni-bot` làm cạn sạch 2.000 phút miễn phí hàng tháng của GitHub.
- **Giải pháp:**
  - Tắt lịch `cron: '*/5 * * * *'` trong repo Private `tni-bot`.
  - Tạo & push `keepalive_construction.yml` vào repo **PUBLIC** `phonghdpxd-cmd/TNI-SITE-DOWN` (commit `a055e55`).
  - Do chạy trên repo Public ➔ **0đ - VÔ HẠN PHÚT KHÔNG BAO GIỜ BỊ KHÓA HẠN NGẠCH**.
  - Apps Script target keepalive: `https://script.google.com/macros/s/AKfycbHraNPzUGVRNGvy-7_q4NyTiJSRUvlodCIjiJZJ00PaNMen-MpVjb4YTmyVex00mn6xQ/exec`

---

### 3. 🔄 Đồng bộ Báo cáo Tự động sang Public Repo
- **Apps Script `daily_report_scheduler.gs`:**
  - Cập nhật hàm `triggerDailyWorkflow()` bắn API dispatch về repo public: `https://api.github.com/repos/phonghdpxd-cmd/TNI-SITE-DOWN/actions/workflows/daily_reports.yml/dispatches`.
- **Đồng bộ mã nguồn:**
  - Đã copy tất cả file script báo cáo (`refuel_plan_report.py`, `daily_plan_report.py`, `cron_send.py`, `refuel_send.py`, `daily_read_report.py`, `backlog_send.py`, `tg_utils.py`, `daily_reports.yml`) sang `tni_site_down_repo` và commit/push lên `phonghdpxd-cmd/TNI-SITE-DOWN` (commit `cf06647`).

---

### 4. 🎨 Cập nhật Giao diện Portal (`index.html`)
- **Màu sắc 4 Team Cards:**
  - 🟣 **Overdue FOT (N):** Tím `#a78bfa`
  - 🟡 **WO Remain (P):** Vàng `var(--amber)`
  - 🔴/🟢 **Rank & Completion Status:** Đỏ/Xanh (dynamic)
  - 🔵/🟣 Các chỉ số khác: Giữ nguyên màu chuẩn UI.
- Đã commit & deploy live tại: `https://tni-bot.vercel.app`.

---

### 5. 📝 Bóc tách Tự động Báo cáo FT (`daily_report_collector.gs`)
- **Nâng cấp `handleDailyAdd`:**
  - Thêm bộ bóc tách `KEY_ALIASES` lọc chính xác các mục `3.` đến `10.` trong tin nhắn báo cáo Daily Result từ Telegram.
  - Tự động điền dữ liệu sạch đẹp vào đúng các **Cột F, G, H, I, J, K, L** trên sheet `Daily report and Bussiness` thay vì dồn nguyên khối text vào Cột D/E.

---

### 6. 🧹 Khử trùng Báo cáo Kế hoạch (`daily_plan_report.py`)
- **Thuật toán `deduplicate_plans_by_date`:**
  - Tự động lọc giữ lại duy nhất 1 bản tin Plan mới nhất khi Team Leader gửi cập nhật nhiều lần cho cùng 1 ngày.
  - Khắc phục hoàn toàn sự cố lặp đôi nội dung Plan và xé nhỏ tin nhắn Telegram.

---

### 7. 📷 Loại bỏ AI Nhận diện Khuôn mặt Bot Điểm danh (`TNI attendance.js`)
- **Xóa bỏ hoàn toàn Gemini Vision AI:**
  - Xóa sạch hàm `identifyFaces_` và `triggerUpdateMasterLibrary1225` khỏi `apps_script_attendance/TNI attendance.js`.
- **Chuyển sang Tra cứu Trực tiếp bằng Telegram ID:**
  - Tự động khớp nhân viên theo `ID Telegram` (Cột D) trong bảng `Staff attendance`. Tên nhân viên ở Cột E & F tự động điền đúng 100%, tốc độ xử lý điểm danh cực nhanh (0.5s).
- **Đã Deploy Clasp trực tiếp:**
  - Đã nạp code và Deploy phiên bản **Version @41** (`AKfycbxoM2KgWFJ4pXaYYdE7bAelngrpVD335D1a9y6Ryusr7Wh7xEwTOG4rfpPTC7K_ZMaqlg`) lên Google Apps Script Cloud.

---

### 8. ⏰ Khắc phục Lịch gửi 15:45 MMT & Tự động Ghim Note cho Report 4b (`cron_send.py` & `daily_reports.yml`)
- **Chuẩn hóa khung giờ gửi:** Đã sửa lịch cron gửi báo cáo chiều trong `daily_reports.yml` từ `'50 9 * * *'` (16:20 MMT) thành **`'15 9 * * *'`** (đúng **15:45 PM MMT** / 09:15 UTC) tuân thủ tuyệt đối quy định 05:45 AM & 15:45 PM MMT.
- **Tự động ghim & Trả lời Note cho Report 4b:**
  - Đã bổ sung điều kiện nhận diện `"4b. Full Report"` trong `cron_send.py` (commit `fac267a`).
  - `4b. Full Report` được tự động ghim (Pin Note) và thu thập `msg_id` để bắn bản tin **Auto-Reply Note** (`control_note`) trực tiếp dưới bản tin 4b.
  - Đảm bảo Report 6 (`daily_read_report.py`) theo dõi và đếm được chính xác 100% ai đã đọc báo cáo nhóm.

---

### 📋 Webhook & Registry cố định

| Bot Name | Telegram Username | Webhook / Dispatch Endpoint | Source Location |
|---|---|---|---|
| **Search Bot** | `@SEARCHTNITASKWOBOT` | `https://tni-bot.vercel.app/api/search_bot` | `api/search_bot.py` |
| **Asset Collector** | `@TNIASSETorderREQUEST_BOT` | `https://tni-bot.vercel.app/api/collector` | `api/collector.py` |
| **Refuel Collector** | `@TNI_FUEL` | `https://tni-bot.vercel.app/api/refuel_collector` | `api/refuel_collector.py` |
| **Site Down Relay** | `@tni_site_down_bot` | `https://tni-bot.vercel.app/api/site_down_relay` | `botlookup_relay.py` |
| **Attendance Bot** | `@TNIATTENDANCE_BOT` | Apps Script Cloud (Version @41) | `apps_script_attendance/TNI attendance.js` |
| **Construction Bot** | `@8903841312` (`10 TNI_SITE`) | Apps Script Web App Endpoint | `13_TNI_CONSTRUCTION.gs` |
