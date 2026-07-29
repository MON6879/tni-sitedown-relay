# BACKUP CONTEXT — 24/07/2026

## 📌 Vấn đề phân tích hôm nay (24/07/2026)

### 1. Hiện tượng
- Nhóm Telegram **5 TNI TECHNICA DEP CONTROL SITE** (`-5251698940`) vẫn nhận các tin nhắn không đúng định dạng của CONTROL, cụ thể là các tin nhắn dạng:
  - `Team 2: Total Site down :3, IGT :1, OCK :2...` + danh sách site T2
  - `Team 3: Total Site down :5, MyTel :1...` + danh sách site T3
  - Có lúc hiển thị đầy đủ tin Team 2, 3, 4, có lúc chỉ hiển thị tin Team 3, 4.

---

### 2. Nguyên nhân kỹ thuật (Gốc rễ)

1. **Nguồn gốc nội dung tin nhắn (`Team X: Total Site down...`)**:
   - Xuất phát từ vòng lặp gửi từng Team (`for (const team of teams)`) trong hàm `checkColC()` của `site_down_v2.gs` / `temp.js`.
   - `summary`: Lấy từ dòng tổng hợp team trong Cột C (ô `C4` cho T1, `C5` cho T2, `C6` cho T3, `C7` cho T4).
   - `sites`: Lấy các dòng site từ `C10:C` có gắn tag team tương ứng (`| 🔵T1 |`, `| 🟡T2 |`, `| 🟢T3 |`, `| 🔴T4 |`).
   - Kết hợp `summary` + `sites` tạo ra bản tin chuẩn của riêng đội đó.

2. **Giải thích "Có lúc Team 2,3,4 - Có lúc chỉ Team 3,4"**:
   - Vòng lặp kiểm tra `if (sites.length > 0)`.
   - Nếu Team nào **không có site down** (đã khôi phục hoàn toàn), script **bỏ qua không gửi** team đó.
   - Do đó, khi Team 2 khôi phục xong (0 site down), script bỏ qua T2 và chỉ sinh ra tin cho Team 3 và Team 4.

3. **Nguyên nhân tin nhắn Team bị chui vào nhóm CONTROL**:
   - Vòng lặp gửi tin gọi: `const chatId = SD_GROUPS[team];`.
   - Trên Google Apps Script project đang chạy thực tế, cấu hình `SD_GROUPS` (hoặc trong `Script Properties`) của `T1, T2, T3, T4` bị đặt nhầm thành Chat ID nhóm CONTROL (`-5251698940`).
   - Ngoài ra, bản code mới sửa logic CONTROL (`C1:C3 & C10:C`) ở local chưa được **Re-deploy (New Version)** trên Apps Script Editor.

---

### 3. Hướng khắc phục chuẩn

1. **Cập nhật Chat ID từng Team trong Apps Script**:
   - `CONTROL`: `-5251698940`
   - `T1`: `-1004215695747` (hoặc `-5180992881`)
   - `T2`: `-1004480845549` (hoặc `-5188855349`)
   - `T3`: `-1004369170658` (hoặc `-5183480727`)
   - `T4`: `-1004293741999` (hoặc `-5238696719`)
2. **Xóa Triggers cũ dư thừa**: Chỉ giữ 1 trigger chạy `checkAndSend` duy nhất.
3. **Re-deploy**: Bấm Deploy ➔ New Version trên Google Apps Script Editor.
