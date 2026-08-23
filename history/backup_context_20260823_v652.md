# 📜 BACKUP CONTEXT v652 — TỔNG LƯU BỌC THÉP TOÀN BỘ PHÂN HỆ ATTENDANCE & SUM WORK & GHẾ AUDITOR-ATTENDANCE-4.1

**Ngày thực hiện**: 23/08/2026 06:42 MMT  
**Tác giả**: Antigravity AI Engine  
**Trạng thái hệ thống**: 🟢 100% HEALTHY — VERIFIED LIVE  

---

## 🌟 1. TỔNG KẾT TOÀN DIỆN CÁC TÍNH NĂNG VÀ CẢI TIẾN TRONG PHIÊN LÀM VIỆC

### A. Phân Hệ Attendance Bot & Bảng Tổng Hợp Công Tab `Sum work` (GID: `1895020121`)
1. **Thiết kế & Triển khai Tab `Sum work` hoàn chỉnh 15 Cột (A $\rightarrow$ O)**:
   - Ô chọn tháng tương tác **`C1`** với Dropdown Validation (`08/2026`, `07/2026`, ...) và trigger `onEdit(e)` tự động tính toán lại.
   - **Cột E**: Tính linh hoạt:
     * Tháng hiện tại (`08/2026`): Hiển thị số ngày đã qua tính đến hôm nay (**23 ngày**).
     * Tháng trước (`07/2026`, `06/2026`): Hiển thị nguyên tháng (**31** hoặc **30** ngày).
   - **Cột F [MỚI]**: Tỷ lệ `% Work / Số Ngày` ($=\text{Tổng Work} / \text{Số Ngày Thực Tế} \times 100\%$).
   - Đầy đủ 36 nhân sự chuẩn của 4 Teams và Office (Đã loại bỏ `Nyi Nyi` và các dòng rác `0`).
2. **Nâng cấp Menu & Lệnh Lấy Mẫu Điểm Danh Bot (`@8628370628`)**:
   - Tách biệt từng Sub-team độc lập: `/t1`, `/t1_s1`, `/t2`, `/t2_s1`, `/t3`, `/t3_s1`, `/t4`.
   - Bổ sung mẫu khối Văn Phòng Cột E: `/office`, `/vp`, `/vanphong`.
   - Đã loại bỏ hoàn toàn lệnh xả toàn bộ công ty (`/attendance`) tránh tràn tin nhắn.
   - Đã cập nhật 12 lệnh trong `setMyCommands` trên Telegram.
3. **Phát Bản Tin Tổng Hợp Chuyên Cần Tháng Sang Group Control (`-5251698940`)**:
   - Mẫu tin phân loại theo từng Đơn vị/Team, hiển thị `Tên`, `Work/Số ngày (%)`, `Leave`, và dòng tổng kết toàn đơn vị.
   - Lệnh kích hoạt nhanh: `/sum_work`, `/baocao_thang`, `/monthly_report`.
   - Kích hoạt qua Webhook: `GET .../exec?action=send_control_summary`.
   - Đã phát tin live thành công vào nhóm `5 TNI TECHNICA DEP CONTROL SITE` (Message ID: `11720`).

---

### B. Thiết Lập Ghế Giám Sát & Lịch Trình Tự Động Buổi Sáng
1. **Ghế Giám Sát Chuyên Biệt `AUDITOR-ATTENDANCE-4.1`** (tại `system_auditor.py`):
   - Giám sát độ tươi mới của Google Sheet `Sum work` (GID: `1895020121`) và `Morning Attendance` (GID: `0`).
   - Giám sát Web App backend Attendance.
   - Giám sát lịch phát bản tin chuyên cần tháng lúc **`09:00` AM MMT** mỗi sáng sang Group Control.
   - Tự động bắn Alert đỏ 🚨 về Admin DM `6859790680` nếu phát hiện trễ quá 15 phút hoặc lỗi kết nối.
2. **Khóa Lịch Phát Tự Động 09:00 Sáng Cố Định**:
   - Trigger `sendMonthlyAttendanceSummaryToControl` chạy tự động mỗi ngày lúc **09:00 MMT**.

---

## 🗺️ 2. BẢNG KHÓA CỐ ĐỊNH DEPLOYMENT SSOT HIỆN HÀNH

| Phân hệ | Script ID | Deployment ID | Phiên bản | Trạng thái |
|---|---|---|---|:---:|
| **QLTC Main Operations** | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` | `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` | **`@368`** | 🟢 Healthy |
| **Site Down Bot** | `1fgIR_frjlOHBt4o3STTjGmHYaKfuiSb3zAtp7IrO__uLSIuRQGJ2Oc6X` | `AKfycbyCibIj4QN7oG5BZc_ju1iS-DUmd9nNdrMn9UN-WD8qf6jVoU_OKOf2yfbi10qGMFF-` | **`@89`** | 🔒 Steel-Locked |
| **Attendance & Sum Work** | `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW` | `AKfycbzI2TvupaD38LcUdyDPLBZrniFMCAN_3SbTX3St1u-G_otgEdZxquEZ-TUivx7jSZNxDg` | **`@61`** | 🟢 Healthy |
