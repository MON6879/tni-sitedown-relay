# 📌 System Snapshot Backup — 04/08/2026 (FINAL SAVE)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot - Sửa màu Icon Team (Team 1 = Chấm Cam 🟠) và bổ sung hiển thị Team 3 ngày 04/08/2026.**

---

## 🎨 Chuẩn Hóa Màu Icon Team Báo Cáo Site Down (`site_down_v2.gs`)
- **Quy chuẩn bảng màu Master Standard Team Color Palette (SYSTEM_DOC.md)**:
  * **Team 1** (Dawei): 🟠 **Orange (Chấm Cam)**
  * **Team 2** (Myeik): 🔵 **Blue (Chấm Xanh Dương)**
  * **Team 3** (Bokpyin): 🟢 **Green (Chấm Xanh Lá)**
  * **Team 4** (Kawthoung): 🟡 **Yellow (Chấm Vàng)**

- **Khắc phục lỗi màu Icon**:
  1. Đã cập nhật biến `TEAM_COLORS = { T1: "🟠", T2: "🔵", T3: "🟢", T4: "🟡" }`.
  2. Cập nhật hàm `colorizeTeams()` và `processSiteDownColC()` để khớp chính xác tất cả tiêu đề Team (`Team 1 Dawei`, `Team 2 Myeik`, `Team 3 Bokpyin`, `Team 4 Kawthoung`) với màu chuẩn.

---

## 📊 Bổ Sung Hiển Thị Đầy Đủ 4 Team Cho Nhóm CONTROL Site Down
- **Khắc phục lỗi thiếu Team 3**:
  1. Khi NocPro Bot (`/down_tni`) không có trạm sự cố nào cho Team 3, Cột C trên Google Sheet không có dòng cho Team 3.
  2. Đã cập nhật `processSiteDownColC()` trong `site_down_v2.gs`: Tự động phân loại bản tin theo 4 Team (`T1` ➔ `T2` ➔ `T3` ➔ `T4`). Nếu Team nào (như Team 3) không có sự cố trong lượt quét, hệ thống tự động chèn tiêu đề chuẩn + dòng `✅ No incident`.
  3. Kết quả: Bản tin tổng hợp gửi nhóm CONTROL luôn luôn hiển thị đủ 4 Team theo đúng thứ tự và màu Icon chuẩn quy định.

---

## ⚡ ĐỒNG BỘ MÃ NGUỒN VÀ REPOSITORY
- **Hồ sơ file đã cập nhật**:
  * `Task and WO/SYSTEM_DOC.md`
  * `Task and WO/apps_script/site_down_v2.gs`
  * `Task and WO/tni_site_down_repo/site_down_v2.gs`
