# 📌 System Snapshot Backup — 04/08/2026 (HUMAN USER ONLY COLLECTION STRICT RULE)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot - Bắt buộc chỉ thu thập Plan từ Tài khoản Cá nhân (Người dùng thật), Bỏ qua 100% tất cả các Chat Bot.**

---

## ⚡ CHẶN TẤT CẢ CÁC CHAT BOT & CHỈ THU THẬP TỪ NGƯỜI DÙNG THẬT (`api/collector.py`)
- **Quy tắc tuyệt đối**:
  1. Kiểm tra đối tượng người gửi `msg.from_user`. Nếu `not user` hoặc `user.is_bot == True` (tin nhắn do bất kỳ Chat Bot nào phát ra) ➔ **Bỏ qua ngầm 100%, không thu thập hay ghi vào Google Sheet**.
  2. Chỉ khi tin nhắn do **Tài khoản Cá nhân / Đội trưởng (Người dùng thật)** gửi trong nhóm ➔ Collector Bot mới tiến hành thu thập, trích xuất Ngày/Team, lưu vào Google Sheet và phát thông báo phản hồi: `📋 Plan saved — REF:DP-xxx | Team X | DD/MM/YYYY`.

---

## ⚡ ĐỒNG BỘ MÃ NGUỒN VÀ REPOSITORY
- **Hồ sơ file đã cập nhật**:
  * `Task and WO/api/collector.py`
  * `Task and WO/api/search_bot.py`
  * `Task and WO/apps_script/site_down_v2.gs`
  * `Task and WO/tni_site_down_repo/site_down_v2.gs`
  * `Task and WO/daily_plan_report.py`
  * `tni-sitedown/daily_plan_report.py`
