# 📜 BACKUP CONTEXT v642 — KHÓA THÉP 5 NGUYÊN TẮC VÀNG & FIX TRIỆT ĐỂ TIN 5 & GHẾ GIÁM SÁT

**Ngày thực hiện**: 22/08/2026 22:42 MMT  
**Tác giả**: Antigravity AI Engine  
**Trạng thái hệ thống**: 🟢 100% HEALTHY — VERIFIED LIVE  

---

## 🌟 1. CÁC HẠNG MỤC ĐÃ HOÀN THÀNH

### A. Sửa Triệt Để Lỗi Tin 5 (Report 5C Daily Plan)
- **Sự cố**: Nhịp 22:06 MMT bị dừng do lỗi `NameError: name 'result' is not defined` tại dòng 1177 trong `daily_plan_report.py`.
- **Khắc phục**:
  - Khởi tạo đầy đủ cấu trúc biến mặc định `result = {"found": False, "sent_time": "", "content": "", "plan": None}` ở đầu hàm `scan_plan_tomorrow()`.
  - Biên dịch cú pháp Python thành công (`python -m py_compile daily_plan_report.py`).
  - Commit `ba19d8f` và push đồng bộ sang cả 2 remote (`phonghdpxd-cmd/tni-bot` & `MON6879/tni-sitedown-relay`).

### B. Triệt Tiêu Điểm Mù Ghế AUDITOR-9.1 (`system_auditor.py`)
- **Sự cố**: Khi phiên Telethon bị lỗi xung đột IP hoặc timeout, khối `try/except` bắt lỗi và trả về mảng rỗng `[]`, khiến Auditor nhầm tưởng là 0 sự cố và xuất báo cáo `🟢 All OK`.
- **Khắc phục**:
  - Cập nhật logic trong `build_master_audit_report()`: Nếu `telethon_data["available"] == False` hoặc có lỗi, Auditor lập tức phát cảnh báo đỏ/vàng `🔐 CẢNH BÁO PHIÊN TELETHON: Không thể đọc tin Telegram`.
  - Commit `c976f5b` và push đồng bộ sang cả 2 remote.

### C. Khóa Thép 5 Nguyên Tắc Vàng Bất Khả Xâm Phạm Vào `AGENTS.md`
- **Nguyên tắc 1**: CẤM báo cáo All Green khi chưa đọc được dữ liệu thực tế (Zero Silent-Pass Policy).
- **Nguyên tắc 2**: Khởi tạo biến mặc định & biên dịch cú pháp trước khi bàn giao (Strict Initialization & Compile Check).
- **Nguyên tắc 3**: CẤM trỏ Webhook Telegram trực tiếp vào Google Apps Script (Bắt buộc qua Vercel Reverse Proxy).
- **Nguyên tắc 4**: Khóa Whitelist `.claspignore` & đếm đủ 18 file trước khi push.
- **Nguyên tắc 5**: Kiểm toán lịch trình tích lũy toàn bộ các mốc trong ngày (Cumulative All-Day Schedule Audit).

---

## 🗺️ 2. BẢNG KHÓA CỐ ĐỊNH DEPLOYMENT HIỆN HÀNH

| Phân hệ | Script ID | Deployment ID | Phiên bản |
|---|---|---|---|
| **QLTC Main Operations** | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` | `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` | **`@368`** |
| **Site Down Bot** | `1fgIR_frjlOHBt4o3STTjGmHYaKfuiSb3zAtp7IrO__uLSIuRQGJ2Oc6X` | `AKfycbyCibIj4QN7oG5BZc_ju1iS-DUmd9nNdrMn9UN-WD8qf6jVoU_OKOf2yfbi10qGMFF-` | **`@89`** (Locked) |
| **Attendance Bot** | `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW` | `AKfycbzI2TvupaD38LcUdyDPLBZrniFMCAN_3SbTX3St1u-G_otgEdZxquEZ-TUivx7jSZNxDg` | **`@48`** |
