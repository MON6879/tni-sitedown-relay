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

### 📋 Webhook & Registry cố định

| Bot Name | Telegram Username | Webhook / Dispatch Endpoint | Source Location |
|---|---|---|---|
| **Search Bot** | `@SEARCHTNITASKWOBOT` | `https://tni-bot.vercel.app/api/search_bot` | `api/search_bot.py` |
| **Asset Collector** | `@TNIASSETorderREQUEST_BOT` | `https://tni-bot.vercel.app/api/collector` | `api/collector.py` |
| **Refuel Collector** | `@TNI_FUEL` | `https://tni-bot.vercel.app/api/refuel_collector` | `api/refuel_collector.py` |
| **Site Down Relay** | `@tni_site_down_bot` | `https://tni-bot.vercel.app/api/site_down_relay` | `botlookup_relay.py` |
| **Construction Bot** | `@8903841312` (`10 TNI_SITE`) | Apps Script Web App Endpoint | `13_TNI_CONSTRUCTION.gs` |
