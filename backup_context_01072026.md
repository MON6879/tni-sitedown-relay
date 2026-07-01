# 🗂️ Backup Context — TNI Bot System (01/07/2026)

> ⚠️ **ĐỌC FILE NÀY TRƯỚC KHI SỬA BẤT KỲ THỨ GÌ!**
> Snapshot: 01/07/2026 23:25 (Myanmar UTC+6:30)
> Conversation ID: `b1503d53-775f-4ab7-87bf-2de3e05237d0`

---

## 🔴 QUY TẮC BẮT BUỘC

> **Mỗi lần bắt đầu:**
> 1. Đọc file này TRƯỚC
> 2. Đọc `system_map.md` cho chi tiết đầy đủ
> 3. Làm đúng theo thực tế
> 4. Lưu lại sau khi xong
>
> ❌ KHÔNG đoán mò — KHÔNG push nhầm project — KHÔNG sửa file sai

---

## 📍 Workspace

- **Thư mục gốc:** `D:\6. AI\1. QLTC\`
- **TNI Bot code:** `D:\6. AI\1. QLTC\Task and WO\`
- **GitHub repo:** `phonghdpxd-cmd/tni-bot` — branch `main`

---

## ✅ Hoàn thành ngày 01/07/2026

### 1. Bảo mật & Tối ưu hóa mã nguồn Apps Script (Token Cleanup)
Để dọn sạch dữ liệu nhạy cảm khỏi code thô phục vụ bảo mật và hỗ trợ việc chuyển đổi sang Public Repo dễ dàng trong tương lai nếu muốn:
- **Ẩn Token Site Down:** Thay đổi khai báo `SD_BOT_TOKEN` trong [site_down_notify.gs](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/site_down_notify.gs) để đọc động từ thuộc tính ẩn của Google Apps Script thay vì ghi thô trong file:
  `const SD_BOT_TOKEN = PropertiesService.getScriptProperties().getProperty("SD_BOT_TOKEN") || "";`
- **Ẩn Token Send Telegram:** Thay đổi khai báo `TG_SEND_TOKEN` trong [apps_script_collector.js](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/apps_script_collector.js) để đọc động từ thuộc tính ẩn:
  `const TG_SEND_TOKEN  = PropertiesService.getScriptProperties().getProperty("SEND_BOT_TOKEN") || "";`
- **Yêu cầu cài đặt:** Cần nhập thêm 2 thuộc tính `SD_BOT_TOKEN` và `SEND_BOT_TOKEN` vào phần **Script Properties** trong cài đặt của Google Apps Script Editor trước khi deploy lại phiên bản mới (New Version) cho Web App.

### 2. Mở rộng khung giờ hoạt động buổi sáng (Active Window)
- **Điều chỉnh giờ bắt đầu:** Thay đổi thời gian bắt đầu chạy cào dữ liệu từ **04:30** sang **04:00 Myanmar Time** trong hàm `relayBotlookupToTNI` ở file [site_down_notify.gs](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/site_down_notify.gs).
  - Điều này giúp các lệnh trigger chạy sớm của người dùng lúc **04:08, 04:38...** đi vào hoạt động chính xác và không bị script bỏ qua nữa.
- **Đồng bộ hóa tài liệu:** Cập nhật lại khung giờ hoạt động mới `04:00 - 21:30 Myanmar` trong các tài liệu hệ thống gồm [PROMPT_RUNBOOK.md](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/PROMPT_RUNBOOK.md) và [system_map.md](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/system_map.md).

### 3. Sửa lỗi trùng lặp biến (SyntaxError: Identifier 'SD_BOT_TOKEN' has already been declared)
- **Nguyên nhân:** File `apps_script_collector.gs` trên Google Apps Script bị dán nhầm toàn bộ mã nguồn của file `site_down_notify.gs` dẫn đến việc cả hai file đều khai báo biến `SD_BOT_TOKEN` trong cùng một dự án.
- **Khắc phục:**
  - Khôi phục file `apps_script_collector.js` chuẩn từ Git ở máy local.
  - Sử dụng công cụ `clasp push` đẩy đè lại toàn bộ mã nguồn chuẩn lên dự án Apps Script trên Google Sheets để ghi đè, giải quyết triệt để lỗi trùng lặp.
  - Thêm tạm thời hàm `saveMyTokens()` vào cuối file [site_down_notify.gs](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/site_down_notify.gs) giúp lưu Token ẩn vào Script Properties thành công, sau đó tiến hành Deploy lại Web App phiên bản mới nhất.

### 4. Sửa lỗi thiếu Secrets trong workflow (`daily_reports.yml`)
- **Nguyên nhân:** Tác vụ `plan_report` (`daily_plan_report.py`) sử dụng thư viện Telethon nhưng phần khai báo biến môi trường (`env`) trong `.github/workflows/daily_reports.yml` bị thiếu 3 tham số kết nối.
- **Khắc phục:** Đã bổ sung `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, và `TELEGRAM_SESSION` vào bước `Report 5 — Daily Plan & Results` và push commit lên main.

### 5. Tách biệt báo cáo Asset về từng nhóm Đội và CONTROL (`cron_send.py`)
- **Nguyên nhân:** Trước đây báo cáo Asset tổng hợp (gộp chung cả 4 đội và Total) được gửi chung cho tất cả các nhóm Team và CONTROL, làm lộ số liệu chéo và gây loãng thông tin.
- **Khắc phục:** 
  - Đã thêm hàm `build_team_asset_msg(team_key, now_str, asset_data)` trong [cron_send.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/cron_send.py) để sinh báo cáo Asset riêng lẻ.
  - Sửa đổi vòng lặp gửi Asset ở cuối file: Nhóm CONTROL tiếp tục nhận báo cáo tổng hợp đầy đủ; còn các nhóm Team 1, 2, 3, 4 chỉ nhận báo cáo số liệu của riêng đội mình.
  - Push commit thay đổi thành công lên GitHub main.

### 6. Khắc phục sự cố hết hạn / khóa Telegram Session cá nhân
- **Dấu hiệu:** Các tác vụ cào 30 phút (`botlookup_relay`), báo cáo đọc Note (`read_report`), check status (`check_read_status`) bị lỗi đỏ ngay lập tức do Telegram ngắt kết nối session (thường xảy ra khi đổi IP/VPN trên thiết bị hoặc do máy chủ GitHub Actions chạy ở các nước khác).
- **Khắc phục:**
  - Hướng dẫn người dùng chuyển thư mục ổ đĩa và chạy file [get_session.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/get_session.py) tại máy local để lấy chuỗi Session mới.
  - Người dùng đã tiến hành cập nhật chuỗi Session mới thành công vào GitHub Secrets `TELEGRAM_SESSION`.
  - Xác nhận hệ thống chạy tốt (Run #51 và Run #52 đã báo xanh thành công).

---

## ⚡ Lưu ý quan trọng
1. **GitHub Actions Billing:** Hiện tại các workflow trên GitHub đã chạy bình thường (Run #51, #52 thành công). Khi Session mới đã được cập nhật, hệ thống cào 30 phút từ GAS và các báo cáo Telethon sẽ tự động hoạt động bình thường trở lại kể từ sáng mai lúc **04:00 Myanmar Time**.
2. **Quy tắc kiểm tra Session:** Khi có lỗi đỏ liên quan đến các tác vụ dùng Telethon, hãy yêu cầu chạy thử tác vụ `read_report` hoặc `check_read_status` trên GitHub Actions để kiểm tra tính hợp lệ của `TELEGRAM_SESSION`.
