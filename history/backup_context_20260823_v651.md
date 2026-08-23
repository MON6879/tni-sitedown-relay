# 📜 BACKUP CONTEXT v651 — THIẾT LẬP GHẾ GIÁM SÁT & KHÓA LỊCH 09:00 MMT PHÁT BÁO CÁO CHUYÊN CẦN THÁNG SANG GROUP CONTROL

**Ngày thực hiện**: 23/08/2026 06:37 MMT  
**Tác giả**: Antigravity AI Engine  
**Trạng thái hệ thống**: 🟢 100% HEALTHY — VERIFIED LIVE  

---

## 🌟 1. CÁC HẠNG MỤC ĐÃ HOÀN THÀNH

### A. Thiết Lập Ghế Giám Sát Tự Động (Auditor Seat) Trong `system_auditor.py`
- **Tên ghế**: **Ghế AUDITOR-ATTENDANCE-4.1** (Tích hợp trong Toa Giám Sát Toàn Diện `AUDITOR-9.1`).
- **Phạm vi giám sát**:
  1. **Google Sheet Connectors**: Tự động kiểm tra kết nối & độ tươi mới của 2 Sheet:
     - `Sheet Attendance Morning (GID=0)`
     - `Sheet Sum work (GID=1895020121)`
  2. **GAS Service Endpoint**: Giám sát Web App Backend Attendance (`AKfycbzI2TvupaD38LcUdyDPLBZrniFMCAN_3SbTX3St1u-G_otgEdZxquEZ-TUivx7jSZNxDg`).
  3. **Master Schedule Rule**: Giám sát lịch phát bản tin:
     - **Tên báo cáo**: `Báo Cáo Tổng Hợp Chuyên Cần Tháng (Sum Work)`
     - **Nhóm đích**: `CONTROL` (`5 TNI TECHNICA DEP CONTROL SITE`, Chat ID `-5251698940`)
     - **Khung giờ phát cố định**: Đúng **`09:00` MMT** mỗi sáng.
     - **Cơ chế cảnh báo**: Tự động bắn Alert đỏ 🚨 về Admin DM `6859790680` nếu bản tin bị trễ hoặc thất bại.

### B. Cấu Hình Lịch Phát Báo Cáo 09:00 Sáng Cố Định Trên GAS
- **Hàm xử lý**: `setupMorningAttendanceSummaryTrigger()` đã được cập nhật `.atHour(9)` (Múi giờ `Asia/Rangoon`).
- **Triển khai & Deploy**:
  * Đã push và deploy GAS `apps_script_attendance` phiên bản **`@61`** (Script ID `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW`).
  * Đã bổ sung quyền `oauthScopes: https://www.googleapis.com/auth/script.scriptapp` trong `appsscript.json`.

---

## 🗺️ 2. BẢNG KHÓA CỐ ĐỊNH DEPLOYMENT HIỆN HÀNH

| Phân hệ | Script ID | Deployment ID | Phiên bản |
|---|---|---|---|
| **QLTC Main Operations** | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` | `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` | **`@368`** |
| **Site Down Bot** | `1fgIR_frjlOHBt4o3STTjGmHYaKfuiSb3zAtp7IrO__uLSIuRQGJ2Oc6X` | `AKfycbyCibIj4QN7oG5BZc_ju1iS-DUmd9nNdrMn9UN-WD8qf6jVoU_OKOf2yfbi10qGMFF-` | **`@89`** (Locked) |
| **Attendance Bot** | `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW` | `AKfycbzI2TvupaD38LcUdyDPLBZrniFMCAN_3SbTX3St1u-G_otgEdZxquEZ-TUivx7jSZNxDg` | **`@61`** |
