# 📜 BACKUP CONTEXT v641 — KHÔI PHỤC SITE DOWN, CONSTRUCTION VÀ NÂNG CẤP GHẾ AUDITOR-9.1 TOÀN DIỆN

**Ngày thực hiện**: 22/08/2026 22:33 MMT  
**Tác giả**: Antigravity AI Engine  
**Trạng thái hệ thống**: 🟢 100% HEALTHY — VERIFIED LIVE  

---

## 🌟 1. CÁC HẠNG MỤC ĐÃ HOÀN THÀNH

### A. Khôi Phục Phân Hệ Site Down Relay
- **Sự cố**: Nhịp 21:30 bị đứng do thiếu file workflow `.github/workflows/botlookup_relay.yml` trên runner `MON6879/tni-sitedown-relay`.
- **Khắc phục**:
  - Tạo mới `.github/workflows/botlookup_relay.yml` với cấu hình Telethon, cache pip, và `concurrency: group: botlookup-relay`.
  - Push đồng bộ sang cả 2 remote (`phonghdpxd-cmd/tni-bot` & `MON6879/tni-sitedown-relay`).
  - Kiểm thử Live (Run ID `32581733557`): Cào thành công 1275 ký tự từ bot NOC Pro, gửi webhook GAS HTTP 200, cập nhật bảng tính GID 0 mốc **21:30:00** (`Total Site down: 18`).

### B. Khôi Phục Phân Hệ Construction Bot (`10 TNI_SITE` — `@8903841312`)
- **Sự cố**: Bot bị câm khi gõ `/plan@TNI_SITE_BOT` hoặc gửi ảnh vật tư do:
  1. `13_TNI_CONSTRUCTION.gs` bị thiếu trong `.claspignore` whitelist $\rightarrow$ không được đẩy lên GAS Cloud.
  2. Webhook trỏ trực tiếp vào GAS sinh lỗi `302 Found` $\rightarrow$ kẹt 15 tin nhắn tồn đọng.
- **Khắc phục**:
  - Đưa `!13_TNI_CONSTRUCTION.gs` và `!template_collector.gs` vào `.claspignore` (đủ 18 file chuẩn).
  - Push và Deploy QLTC_GAS phiên bản **`@368`**.
  - Đổi Webhook Bot `@8903841312` sang Vercel Proxy `https://tni-bot.vercel.app/api/plan_dep` (theo dõi redirect và trả về `200 OK` cho Telegram).
  - Giải phóng toàn bộ **15 tin nhắn tồn đọng về `0`**, xóa sạch lỗi `302`.

### C. Nâng Cấp Toàn Diện Ghế AUDITOR-9.1 (`system_auditor.py` v8.0)
- Mở rộng giám sát tự động khép kín:
  - **5 Cổng Webhook**: `Search Bot`, `Asset Collector`, `Site Down Relay`, `Construction Bot 10`, `Attendance Bot`.
  - **4 GAS Backends (SSOT)**: `QLTC @368`, `Site Down @89`, `Attendance @48`, `BI Portal`.
  - **7 Google Sheets Connectors**: `Site Down GID 0`, `Task remain GID 133591305`, `Read Group GID 870080250`, `Construction GID 0`, `Attendance GID 0`, `Time Rain GID 2003037043`, `Auto Copy Config GID 0`.
- Chạy kiểm toán thực tế: `🟢 [AUDITOR-9.1] 1, 2, 3, 4 OK` — 0 sự cố, gửi DM Admin `6859790680` thành công!

---

## 🗺️ 2. BẢNG KHÓA CỐ ĐỊNH DEPLOYMENT HIỆN HÀNH

| Phân hệ | Script ID | Deployment ID | Phiên bản |
|---|---|---|---|
| **QLTC Main Operations** | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` | `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` | **`@368`** |
| **Site Down Bot** | `1fgIR_frjlOHBt4o3STTjGmHYaKfuiSb3zAtp7IrO__uLSIuRQGJ2Oc6X` | `AKfycbyCibIj4QN7oG5BZc_ju1iS-DUmd9nNdrMn9UN-WD8qf6jVoU_OKOf2yfbi10qGMFF-` | **`@89`** (Locked) |
| **Attendance Bot** | `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW` | `AKfycbzI2TvupaD38LcUdyDPLBZrniFMCAN_3SbTX3St1u-G_otgEdZxquEZ-TUivx7jSZNxDg` | **`@48`** |
