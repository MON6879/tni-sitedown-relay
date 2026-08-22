# 📜 BACKUP CONTEXT v640 — PHỤC HỒI TOÀN DIỆN REPORT 4, ATTENDANCE, GAS PAT VÀ REPORT 6 (READ GROUP)

**Ngày thực hiện**: 22/08/2026 21:25 MMT  
**Tác giả**: Antigravity AI Engine  
**Trạng thái hệ thống**: 🟢 100% HEALTHY — VERIFIED LIVE  

---

## 🌟 1. DANH MỤC HẠNG MỤC ĐÃ HOÀN THÀNH

### A. Sửa Lỗi & Phục Hồi TNI Attendance Bot
- **Nguyên nhân**: Commit `6194af5` (09/08/2026) xóa hàm `identifyFaces_()` nhưng bỏ sót biến `extractedImageName` $\rightarrow$ `ReferenceError` khi nhận ảnh điểm danh $\rightarrow$ Điểm danh ngưng từ 17/08.
- **Khắc phục**: Khai báo và gán `extractedImageName = String(msg.caption).trim()` trước dòng 258 trong `TNI attendance.js`.
- **Deploy**: `apps_script_attendance` Deployment `AKfycbzI2TvupaD38LcUdyDPLBZrniFMCAN_3SbTX3St1u-G_otgEdZxquEZ-TUivx7jSZNxDg` (**`@48`**).

### B. Nâng Cấp Report 4 & Tách Toa 12 Riêng Biệt
- **Fix 3 Bug**:
  1. `delete_old_helper.py`: Regex linh hoạt cho `Day /\d+ of the month=`.
  2. `delete_old_helper.py`: Nâng `search_limit` lên 200.
  3. `cron_send.py`: Parse mode HTML cho bảng 4c + tái cấu trúc luồng xóa-gửi theo từng Team dùng chung kết nối Telethon.
- **Tách Toa 12**:
  - `train_5min.yml`: Toa 12 chạy lúc **05:51** và **15:51** MMT (+5 phút sau Toa 1+11).
  - Nạp đầy đủ `TELEGRAM_SESSION`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` cho Toa 12.

### C. Tính Năng Đồng Bộ Thủ Công Sheet "Time Rain 5 min"
- **GAS Action**: Thêm `sync_schedule` trong `apps_script_collector.gs`.
- **Deploy**: QLTC_GAS (**`@365`**).
- **Đồng bộ**: 29 dòng thời gian chuẩn xác 1-to-1 với workflow vào Tab `Time Rain 5 min` (GID `2003037043`).
- **Lưu Rule**: Chỉ đồng bộ khi Người Dùng nói *"đồng bộ thời gian đi"*.

### D. Khôi Phục Token GAS Dispatch
- **Sự cố**: Token classic cũ bị xóa $\rightarrow$ GAS không gọi được GitHub API.
- **Khắc phục**: Tạo token không thời hạn `ghp_SsaJd5...`, thêm action `set_property` trong GAS, cập nhật `GITHUB_PAT` & `GITHUB_TOKEN` trong Script Properties.
- **Deploy**: QLTC_GAS (**`@366`**).

### E. Sửa Triệt Để & Kiểm Thử Live Report 6 (Read Group)
- **Nguyên nhân**: Thiếu Telethon trong Toa 1+11 cũ $\rightarrow$ không gửi được Note $\rightarrow$ `GetMessageReadParticipantsRequest` quét 35 ngày bị Telegram báo `MSG_ID_INVALID` (quá 7 ngày) $\rightarrow$ ghi nhận toàn bộ Unread.
- **Khắc phục**:
  1. Ép SSOT Deployment ID `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` trong `daily_read_report.py`.
  2. Giới hạn truy vấn đọc trong phạm vi 7 ngày của Telegram API.
  3. Thêm action `clean_test_read_group` trong `apps_script_collector.gs`.
- **Deploy**: QLTC_GAS (**`@367`**).
- **Kiểm thử Live**: Dispatch Run `32579705350` thành công 100%, ghi 36 bản ghi sống lên tab `Read Group` (GID `870080250`) ngày 22/08/2026 21:17 MMT.

---

## 🗺️ 2. BẢNG KHÓA CỐ ĐỊNH DEPLOYMENT HIỆN HÀNH

| Phân hệ | Script ID | Deployment ID | Phiên bản |
|---|---|---|---|
| **QLTC Main Operations** | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` | `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` | **`@367`** |
| **Site Down Bot** | `1fgIR_frjlOHBt4o3STTjGmHYaKfuiSb3zAtp7IrO__uLSIuRQGJ2Oc6X` | `AKfycbyCibIj4QN7oG5BZc_ju1iS-DUmd9nNdrMn9UN-WD8qf6jVoU_OKOf2yfbi10qGMFF-` | **`@89`** (Locked) |
| **Attendance Bot** | `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW` | `AKfycbzI2TvupaD38LcUdyDPLBZrniFMCAN_3SbTX3St1u-G_otgEdZxquEZ-TUivx7jSZNxDg` | **`@48`** |
