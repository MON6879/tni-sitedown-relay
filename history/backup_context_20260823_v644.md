# 📜 BACKUP CONTEXT v644 — TÁCH BIỆT LỆNH MẪU ĐIỂM DANH CHO CÁC SUB TEAM (T1 S1, T2 S1, T3 S1)

**Ngày thực hiện**: 23/08/2026 05:37 MMT  
**Tác giả**: Antigravity AI Engine  
**Trạng thái hệ thống**: 🟢 100% HEALTHY — VERIFIED LIVE  

---

## 🌟 1. CÁC HẠNG MỤC ĐÃ HOÀN THÀNH

### A. Tách Biệt Lệnh Lấy Mẫu Cho Từng Sub-Team Riêng Biệt (Attendance Bot `@8628370628`)
- **Bối cảnh nghiệp vụ**: Dù cùng thuộc Team 1 (hoặc Team 2, Team 3), nhưng Sub Team 1 ở vị trí địa lý xa nhau và có người báo cáo riêng biệt. Do đó, cần tách riêng lệnh để người phụ trách Sub-Team lấy đúng danh sách của mình mà không bị dính với Team Main.
- **Cấu hình lệnh đã cập nhật**:
  * `/t1` hoặc `/t1_main`: Chỉ trả về mẫu **Team 1 Main** (Cột F — 6 nhân sự).
  * `/t1_s1` hoặc `/t1s1`: Chỉ trả về mẫu **Team 1 Sub-team 1** (Cột G — 3 nhân sự).
  * `/t2` hoặc `/t2_main`: Chỉ trả về mẫu **Team 2 Main** (Cột I — 6 nhân sự).
  * `/t2_s1` hoặc `/t2s1`: Chỉ trả về mẫu **Team 2 Sub-team 1** (Cột J — 3 nhân sự).
  * `/t3` hoặc `/t3_main`: Chỉ trả về mẫu **Team 3 Main** (Cột K — 3 nhân sự).
  * `/t3_s1` hoặc `/t3s1`: Chỉ trả về mẫu **Team 3 Sub-team 1** (Cột L — 2 nhân sự).
  * `/t4`: Trả về mẫu **Team 4 Main** (Cột M — 7 nhân sự).
  * `/attendance`: Trả về toàn bộ các Team & Sub-Team.
- **Nâng Cấp Regex Nhận Diện Báo Cáo Điểm Danh**:
  * Hỗ trợ nhận diện các tiêu đề báo cáo thực tế từ Sub-Team: `T1 S1 Team 01 Attendane report: ...`, `T2 S1 Attendane report: ...`, `T3 S1 Attendane report: ...` để lưu chính xác vào Sheet `Sum report morning attendance`.
- **Deploy & Menu**:
  * Đã push và deploy GAS `apps_script_attendance` phiên bản **`@50`**.
  * Cập nhật `setMyCommands` Telegram Bot `@8628370628` đầy đủ các lệnh tách biệt `/t1`, `/t1_s1`, `/t2`, `/t2_s1`, `/t3`, `/t3_s1`, `/t4`.
  * Kiểm thử Live thành công 100%.

---

## 🗺️ 2. BẢNG KHÓA CỐ ĐỊNH DEPLOYMENT HIỆN HÀNH

| Phân hệ | Script ID | Deployment ID | Phiên bản |
|---|---|---|---|
| **QLTC Main Operations** | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` | `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` | **`@368`** |
| **Site Down Bot** | `1fgIR_frjlOHBt4o3STTjGmHYaKfuiSb3zAtp7IrO__uLSIuRQGJ2Oc6X` | `AKfycbyCibIj4QN7oG5BZc_ju1iS-DUmd9nNdrMn9UN-WD8qf6jVoU_OKOf2yfbi10qGMFF-` | **`@89`** (Locked) |
| **Attendance Bot** | `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW` | `AKfycbzI2TvupaD38LcUdyDPLBZrniFMCAN_3SbTX3St1u-G_otgEdZxquEZ-TUivx7jSZNxDg` | **`@50`** |
