# 📜 BACKUP CONTEXT v643 — CẬP NHẬT TEMPLATE MENU VÀ ĐỒNG BỘ ĐỘNG 4 TEAM ATTENDANCE BOT

**Ngày thực hiện**: 23/08/2026 05:33 MMT  
**Tác giả**: Antigravity AI Engine  
**Trạng thái hệ thống**: 🟢 100% HEALTHY — VERIFIED LIVE  

---

## 🌟 1. CÁC HẠNG MỤC ĐÃ HOÀN THÀNH

### A. Tái Cấu Trúc & Sửa Lỗi Tra Cứu Mẫu Điểm Danh (Attendance Bot `@8628370628`)
- **Vấn đề phát hiện**:
  1. Cấu hình cũ `teamColMap = { 1: 6, 2: 7, 3: 8, 4: 9 }` bị gán sai lệch hoàn toàn so với bảng tính thực tế:
     - Team 1 bị thiếu Col G (`T1 S1 Team 01`).
     - Team 2 bị nhầm sang Col G (Sub-team 1 của Team 1).
     - Team 3 bị trả về Col H (Cột trống).
     - Team 4 bị nhầm sang Col I (`T2`).
     - Toàn bộ dữ liệu Team 3 (Col K, L) và Team 4 (Col M) bị biến mất khỏi bot.
  2. Thiếu lệnh `/menu` và menu gợi ý lệnh trên Telegram.
- **Khắc phục**:
  - Ánh xạ chính xác nhóm cột đa nhánh (Multi-column Team Grouping):
    * **Team 1**: Col F (6) [T1 Main] + Col G (7) [T1 S1]
    * **Team 2**: Col I (9) [T2 Main] + Col J (10) [T2 S1]
    * **Team 3**: Col K (11) [T3 Main] + Col L (12) [T3 S1]
    * **Team 4**: Col M (13) [T4 Main]
  - Thêm lệnh `/menu` hiển thị bảng thực đơn tương tác chuyên nghiệp.
  - Cập nhật `setMyCommands` cho Telegram Bot `@8628370628` gồm 9 lệnh chuẩn.
  - Push và Deploy `apps_script_attendance` phiên bản **`@49`** (Script ID `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW`).
  - Kiểm thử Live Webhook thành công 100% cho `/menu`, `/template_team1..4`, `/leave`.

---

## 🗺️ 2. BẢNG KHÓA CỐ ĐỊNH DEPLOYMENT HIỆN HÀNH

| Phân hệ | Script ID | Deployment ID | Phiên bản |
|---|---|---|---|
| **QLTC Main Operations** | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` | `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` | **`@368`** |
| **Site Down Bot** | `1fgIR_frjlOHBt4o3STTjGmHYaKfuiSb3zAtp7IrO__uLSIuRQGJ2Oc6X` | `AKfycbyCibIj4QN7oG5BZc_ju1iS-DUmd9nNdrMn9UN-WD8qf6jVoU_OKOf2yfbi10qGMFF-` | **`@89`** (Locked) |
| **Attendance Bot** | `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW` | `AKfycbzI2TvupaD38LcUdyDPLBZrniFMCAN_3SbTX3St1u-G_otgEdZxquEZ-TUivx7jSZNxDg` | **`@49`** |
