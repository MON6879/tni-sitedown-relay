# 🗂️ Backup Context — TNI Bot System (01/07/2026)

> ⚠️ **ĐỌC FILE NÀY TRƯỚC KHI SỬA BẤT KỲ THỨ GÌ!**
> Snapshot: 01/07/2026 05:58 (Myanmar UTC+6:30)
> Conversation ID: `f1c2a8c9-b628-43e4-8f7b-c49c3be05748`

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

---

## ⚡ Lưu ý quan trọng
1. **GitHub Actions Billing:** Tài khoản GitHub Private của người dùng đã sử dụng hết hạn mức 2.000 phút chạy miễn phí của chu kỳ cũ. Theo múi giờ Mỹ (chậm hơn Myanmar 13.5 tiếng), chu kỳ sẽ được tự động reset lại vào ngày **02/07** (ngày mai). Hệ thống sẽ tự hoạt động lại bình thường ngay sau khi được reset.
2. **Google Apps Script:** Khi chỉnh sửa xong code trong Apps Script Editor, người dùng bắt buộc phải thực hiện **Deploy -> Manage deployments -> Edit -> chọn New version -> Deploy** để các thay đổi cất Token ẩn hoạt động chính xác đối với API gửi tin nhắn.
