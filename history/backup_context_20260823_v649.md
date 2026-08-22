# 📜 BACKUP CONTEXT v649 — THÊM CỘT % WORK VÀ CẬP NHẬT CỘT SỐ NGÀY ĐÃ QUA / NGUYÊN THÁNG CHO TAB SUM WORK

**Ngày thực hiện**: 23/08/2026 06:24 MMT  
**Tác giả**: Antigravity AI Engine  
**Trạng thái hệ thống**: 🟢 100% HEALTHY — VERIFIED LIVE  

---

## 🌟 1. CÁC HẠNG MỤC ĐÃ HOÀN THÀNH

### A. Bổ Sung Cột % Chuyên Cần & Nâng Cấp Logic Cột E Tab `Sum work` (GID: `1895020121`)
- **Yêu cầu**: 
  1. Cột E: Đối với tháng hiện tại (ví dụ: `08/2026`), hiển thị số ngày đã trôi qua tính đến hôm nay (ví dụ: ngày **23**) để tính tỷ lệ % chính xác. Nếu chọn xem các tháng trước (ví dụ: `07/2026`), hiển thị nguyên tháng (ví dụ: **31** hoặc **30** ngày).
  2. Thêm 1 cột mới nằm giữa Cột E và Cột G (Cột F mới) để hiển thị tỷ lệ **% Work / Số Ngày Tháng** (`countWorkMonth / elapsedDays`).
- **Thực hiện**:
  * Đã mở rộng bảng tính lên **15 Cột chuẩn (A -> O)**:
    - **Cột A**: `STT`
    - **Cột B**: `Họ & Tên Nhân Viên`
    - **Cột C**: `Bộ Phận / Team`
    - **Cột D**: `Telegram ID`
    - **Cột E**: `Số Ngày Đến Nay (Đến 23/08)` (Tháng hiện tại: 23; Tháng trước: 31/30)
    - **Cột F [CỘT MỚI]**: `% Work / Số Ngày` (Tỷ lệ ngày làm việc so với số ngày thực tế)
    - **Cột G**: `Tổng Work (Ngày)`
    - **Cột H**: `Tổng Take Leave`
    - **Cột I**: `Tổng Half Leave`
    - **Cột J**: `Tổng Ngày Công`
    - **Cột K**: `Hôm Nay (23/08/2026)`
    - **Cột L**: `Hôm Qua (22/08/2026)`
    - **Cột M**: `Hôm Kia (21/08/2026)`
    - **Cột N**: `Thống Kê 7 Ngày`
    - **Cột O**: `Thống Kê 1 Tháng (30N)`
  * Đã push và deploy GAS `apps_script_attendance` phiên bản **`@56`** (Script ID `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW`).
  * Đã trigger tạo bảng và xác thực live trên Google Sheets thành công (`HTTP 200 OK`).

---

## 🗺️ 2. BẢNG KHÓA CỐ ĐỊNH DEPLOYMENT HIỆN HÀNH

| Phân hệ | Script ID | Deployment ID | Phiên bản |
|---|---|---|---|
| **QLTC Main Operations** | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` | `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` | **`@368`** |
| **Site Down Bot** | `1fgIR_frjlOHBt4o3STTjGmHYaKfuiSb3zAtp7IrO__uLSIuRQGJ2Oc6X` | `AKfycbyCibIj4QN7oG5BZc_ju1iS-DUmd9nNdrMn9UN-WD8qf6jVoU_OKOf2yfbi10qGMFF-` | **`@89`** (Locked) |
| **Attendance Bot** | `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW` | `AKfycbzI2TvupaD38LcUdyDPLBZrniFMCAN_3SbTX3St1u-G_otgEdZxquEZ-TUivx7jSZNxDg` | **`@56`** |
