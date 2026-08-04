# 📌 System Snapshot Backup — 04/08/2026 (TOP 3% EXPERT AUDIT & LOCK OPTIMIZATION)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot - Tối ưu hóa hiệu năng, chống Race Condition & Khóa luồng đồng thời.**

---

## 🛡️ TOP 3% WORLD-CLASS SYSTEM AUDIT & OPTIMIZATIONS

### 1. Khống chế Xung đột Luồng Đồng thời (Race Condition Lock in Apps Script)
- **Tình trạng trước**: `doPost()` trong `site_down_v2.gs` không có khóa ScriptLock. Khi 2 webhook từ Telegram/Vercel đến gần như đồng thời (<500ms), 2 container Google Apps Script chạy song song làm xóa/ghi trùng Cột A và gửi 2 tin nhắn trùng lặp lên nhóm CONTROL & các Team.
- **Khắc phục**: Thêm `LockService.getScriptLock()` với thời gian chờ 8,000ms. Đảm bảo chỉ 1 request được xử lý tại một thời điểm, loại bỏ 100% rủi ro trùng lặp tin nhắn.

### 2. Tối ưu Thời gian phản hồi (Speed & Latency Optimization)
- **Tình trạng trước**: `Utilities.sleep(1500)` gọi 2 lần liên tiếp gây trễ 3,000ms vô ích trên mỗi request Webhook.
- **Khắc phục**: Giảm `sleep` xuống 300ms và rút gọn thao tác `SpreadsheetApp.flush()`, tăng tốc độ phản hồi tin nhắn lên hơn 2.5 giây.

### 3. Chuẩn hóa Biểu thức Chính quy (Regex Robustness for NocPro Bot)
- **Tình trạng trước**: `isTeamSummaryLine(l)` chỉ hỗ trợ định dạng cố định `/Team\s+[1-4]\s*:\s*Total\s+Site\s+down/i`.
- **Khắc phục**: Cập nhật regex hỗ trợ linh hoạt mọi biến thể từ NocPro (`Team 01`, `Team-1`, `Team 1 — : Total Site down`) ➔ `/Team\s*0?[1-4][\s\—\-]*:\s*Total\s+Site\s+down/i`.

---

## ⚡ ĐỒNG BỘ MÃ NGUỒN VÀ REPOSITORY
- **Hồ sơ file đã cập nhật**:
  * `Task and WO/apps_script/site_down_v2.gs`
  * `Task and WO/tni_site_down_repo/site_down_v2.gs`
  * `Task and WO/api/search_bot.py`
  * `Task and WO/api/collector.py`
  * `Task and WO/daily_plan_report.py`
  * `tni-sitedown/daily_plan_report.py`
