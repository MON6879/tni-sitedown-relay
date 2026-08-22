# 📜 BACKUP CONTEXT v645 — LOẠI BỎ LỆNH TỔNG HỢP /ATTENDANCE VÀ CHUẨN HÓA DANH MỤC TỪNG TEAM

**Ngày thực hiện**: 23/08/2026 05:40 MMT  
**Tác giả**: Antigravity AI Engine  
**Trạng thái hệ thống**: 🟢 100% HEALTHY — VERIFIED LIVE  

---

## 🌟 1. CÁC HẠNG MỤC ĐÃ HOÀN THÀNH

### A. Loại Bỏ Hoàn Toàn Mục "Đầy đủ tất cả các nhóm" Khỏi Bot Điểm Danh (`@8628370628`)
- **Yêu cầu**: Không dùng lệnh xuất toàn bộ các nhóm một lúc để tránh spam và nhầm lẫn; chỉ giữ lại các lệnh lấy mẫu riêng biệt cho từng Team và Sub-Team.
- **Thay đổi thực hiện**:
  * Đã xóa tùy chọn `/attendance` (Mẫu toàn bộ 4 Team) khỏi bảng `/menu` và menu nút bấm Telegram.
  * Cập nhật `handleAttendanceTemplateQuery_`: Nếu người dùng gõ `/attendance` hoặc `/template` chung chung, Bot sẽ tự động trả về Menu hướng dẫn chọn đúng Team của mình (`/t1`, `/t1_s1`, `/t2`, `/t2_s1`, `/t3`, `/t3_s1`, `/t4`).
  * Cập nhật `setMyCommands` trên Telegram Bot `@8628370628` gồm 11 lệnh chuyên biệt.
  * Đã push và deploy GAS `apps_script_attendance` phiên bản **`@51`** (Script ID `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW`).

---

## 🗺️ 2. BẢNG KHÓA CỐ ĐỊNH DEPLOYMENT HIỆN HÀNH

| Phân hệ | Script ID | Deployment ID | Phiên bản |
|---|---|---|---|
| **QLTC Main Operations** | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` | `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` | **`@368`** |
| **Site Down Bot** | `1fgIR_frjlOHBt4o3STTjGmHYaKfuiSb3zAtp7IrO__uLSIuRQGJ2Oc6X` | `AKfycbyCibIj4QN7oG5BZc_ju1iS-DUmd9nNdrMn9UN-WD8qf6jVoU_OKOf2yfbi10qGMFF-` | **`@89`** (Locked) |
| **Attendance Bot** | `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW` | `AKfycbzI2TvupaD38LcUdyDPLBZrniFMCAN_3SbTX3St1u-G_otgEdZxquEZ-TUivx7jSZNxDg` | **`@51`** |
