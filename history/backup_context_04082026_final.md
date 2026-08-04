# 📌 System Snapshot Backup — 04/08/2026 (FINAL SAVE)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot - Fix lỗi thu thập Daily Plan & chuẩn hóa màu Icon Team ngày 04/08/2026.**

---

## 🐞 Sửa Lỗi Thu Thập Daily Plan Của Team Leader (`is_daily_plan()` Bug Fix)
- **Phát hiện nguyên nhân cốt lõi**:
  1. Trong các file `api/collector.py` và `daily_plan_report.py`, danh sách loại trừ chuỗi `exclusion list` trước đây chứa `"daily plan template"` và `"note: /find /tnixxxx"`.
  2. Khi các Đội trưởng (Team Leader) sử dụng bot để lấy mẫu Plan rồi copy dán lại vào nhóm Telegram (vd: bản tin lúc 22:23 ngày 03/08/2026 của Team 2), tiêu đề gốc `📋 Daily Plan Template (Team 2)` và `VI. Note: /Find /TNIxxxx` vẫn được giữ nguyên trong tin nhắn.
  3. Dẫn đến hàm `is_daily_plan()` và `is_daily_plan_msg()` nhầm tưởng đó là tin nhắn mẫu của Bot nên **đã loại bỏ và không lưu Plan vào Google Sheet**!
  4. Sáng hôm sau lúc 06:25 khi báo cáo 5.1 chạy, hệ thống không tìm thấy dòng Plan cho ngày `04/08/2026` của Team 2 ➔ Báo `NOT SUBMITTED` sai lệch!

- **Khắc phục triệt để**:
  1. **Loại bỏ `"daily plan template"` và `"note: /find /tnixxxx"` khỏi danh sách loại trừ**: Chỉ loại bỏ các chuỗi hướng dẫn giao diện bot (vd: `"copy → edit → send back"`) hoặc các bản tin báo cáo tự động (`"auto report"`, `"report — daily plan"`, `"plan vs actual"`).
  2. **Trích xuất chính xác Ngày Plan (`date_str`)**: Ưu tiên trích xuất Ngày từ cú pháp `Daily Plan: DD/MM/YYYY` hoặc `Plan for DD/MM/YYYY` nằm trong nội dung tin nhắn do Đội trưởng ghi (vd `Daily Plan: 4/08/2026` ➔ lưu ngày `04/08/2026` vào Cột B `Date`), **tuyệt đối không lấy ngày thu thập hiện tại tại thời điểm bot nhận tin**.

---

## 🎨 Chuẩn Hóa Màu Icon Team Báo Cáo Site Down (`site_down_v2.gs`)
- **Quy chuẩn bảng màu Master Standard Team Color Palette**:
  * **Team 1** (Dawei): 🟠 **Orange (Chấm Cam)**
  * **Team 2** (Myeik): 🔵 **Blue (Chấm Xanh Dương)**
  * **Team 3** (Bokpyin): 🟢 **Green (Chấm Xanh Lá)**
  * **Team 4** (Kawthoung): 🟡 **Yellow (Chấm Vàng)**

- **Bổ sung hiển thị đầy đủ 4 Team**:
  * Cập nhật `processSiteDownColC()` trong `site_down_v2.gs`: Tự động phân loại bản tin theo 4 Team (`T1` ➔ `T2` ➔ `T3` ➔ `T4`). Nếu Team 3 không có trạm sự cố nào trong lượt quét, hệ thống tự động bổ sung tiêu đề chuẩn `🟢 Team 3 Bokpyin` + `✅ No incident`.

---

## ⚡ ĐỒNG BỘ MÃ NGUỒN VÀ REPOSITORY
- **Hồ sơ file đã cập nhật**:
  * `Task and WO/api/collector.py`
  * `Task and WO/daily_plan_report.py`
  * `tni-sitedown/daily_plan_report.py`
  * `Task and WO/tni_site_down_repo/daily_plan_report.py`
  * `Task and WO/SYSTEM_DOC.md`
  * `Task and WO/apps_script/site_down_v2.gs`
  * `Task and WO/tni_site_down_repo/site_down_v2.gs`
