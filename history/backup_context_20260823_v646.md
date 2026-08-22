# 📜 BACKUP CONTEXT v646 — TRIỂN KHAI BẢNG TỔNG HỢP CÔNG THEO THÁNG TAB 'SUM WORK' CÓ DROPDOWN CHỌN THÁNG

**Ngày thực hiện**: 23/08/2026 06:06 MMT  
**Tác giả**: Antigravity AI Engine  
**Trạng thái hệ thống**: 🟢 100% HEALTHY — VERIFIED LIVE  

---

## 🌟 1. CÁC HẠNG MỤC ĐÃ HOÀN THÀNH

### A. Thiết Kế & Xây Dựng Bảng Tổng Hợp Công Tab `Sum work` (GID: `1895020121`)
- **Bảng tính**: `TNI- ATTENDANCE list` (Spreadsheet ID: `18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54`).
- **Tính năng nổi bật**:
  1. **Ô Chọn Tháng Tương Tác (Interactive Month Selector)**:
     - Đặt tại ô `C1` với Data Validation Dropdown danh sách các tháng (`08/2026`, `07/2026`, `06/2026`, `05/2026`, `04/2026`, `03/2026`, `02/2026`, `01/2026`, `09/2026`, `10/2026`, `11/2026`, `12/2026`).
     - Tích hợp hàm trigger `onEdit(e)`: Khi người dùng bấm chọn tháng khác ở ô `C1`, bảng tính tự động tính toán và cập nhật lại toàn bộ số liệu theo tháng được chọn!
  2. **Đầy Đủ 14 Cột Chuẩn Yêu Cầu**:
     - **Cột A**: `STT`
     - **Cột B**: `Họ & Tên Nhân Viên` (Đầy đủ 37 nhân sự của Team 1, Team 1 S1, Team 2, Team 2 S1, Team 3, Team 3 S1, Team 4, Office)
     - **Cột C**: `Bộ Phận / Team`
     - **Cột D**: `Telegram ID`
     - **Cột E**: `Số Ngày Trong Tháng` (Tự động tính theo tháng ở `C1`, ví dụ Tháng 8 = 31 ngày)
     - **Cột F**: `Tổng Work` (Số ngày làm việc trong tháng được chọn)
     - **Cột G**: `Tổng Take Leave` (Số ngày nghỉ phép cả ngày)
     - **Cột H**: `Tổng Half Leave` (Số ngày nghỉ phép nửa ngày)
     - **Cột I**: `Tổng Ngày Công` (= Work + 0.5 * Half Leave)
     - **Cột J**: `Hôm Nay` (Trạng thái ngày hiện tại, ví dụ `23/08/2026`: `✅ Work`, `🏖️ Take Leave`, `🌓 Half Day`, `❌ Chưa báo`)
     - **Cột K**: `Hôm Qua` (Trạng thái ngày hôm qua `22/08/2026`)
     - **Cột L**: `Hôm Kia` (Trạng thái 2 ngày trước `21/08/2026`)
     - **Cột M**: `Thống Kê 7 Ngày` (Tỷ lệ và số ngày làm việc trong 7 ngày gần nhất)
     - **Cột N**: `Thống Kê 1 Tháng` (Tỷ lệ và số ngày làm việc trong 30 ngày gần nhất)
  3. **Tự Động Cập Nhật Real-time Khi Có Báo Cáo Mới**:
     - Hàm `buildSumWorkTab()` được móc nối tự động vào cả 2 luồng: Báo cáo văn bản Telegram (`doPost`) và Báo cáo ảnh khuôn mặt Drive.
  4. **Triển Khai & Kiểm Thử Live**:
     - Đã deploy GAS `apps_script_attendance` phiên bản **`@52`** (Script ID `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW`).
     - Đã chạy tạo bảng thật thành công trên Google Sheets tab `Sum work`.

---

## 🗺️ 2. BẢNG KHÓA CỐ ĐỊNH DEPLOYMENT HIỆN HÀNH

| Phân hệ | Script ID | Deployment ID | Phiên bản |
|---|---|---|---|
| **QLTC Main Operations** | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` | `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` | **`@368`** |
| **Site Down Bot** | `1fgIR_frjlOHBt4o3STTjGmHYaKfuiSb3zAtp7IrO__uLSIuRQGJ2Oc6X` | `AKfycbyCibIj4QN7oG5BZc_ju1iS-DUmd9nNdrMn9UN-WD8qf6jVoU_OKOf2yfbi10qGMFF-` | **`@89`** (Locked) |
| **Attendance Bot** | `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW` | `AKfycbzI2TvupaD38LcUdyDPLBZrniFMCAN_3SbTX3St1u-G_otgEdZxquEZ-TUivx7jSZNxDg` | **`@52`** |
