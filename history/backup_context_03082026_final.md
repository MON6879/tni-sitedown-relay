# 📌 System Snapshot Backup — 03/08/2026 (FINAL FREEZE & SAVE)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot đã tối ưu và đóng băng ngày 03/08/2026.**

---

## 🛠️ Lọc Trùng Lập Lệnh Telegram (Telegram Update Deduplication Cache)
- **Phát hiện nguyên nhân**: Khi gửi lệnh `/plan` trong nhóm, nếu thời gian đọc Google Sheets kéo dài > 3-4 giây, Telegram tự động gửi lại bản tin Webhook Retry lần 2. Do không lọc `update_id`, bot xử lý cả 2 bản tin dẫn đến gửi 2 phản hồi trùng lặp trong nhóm!
- **Khắc phục**: Đã thêm bộ nhớ đệm lọc trùng `_processed_updates = set()`. Mỗi `update_id` từ Telegram chỉ được xử lý DUY NHẤT 1 LẦN. Mọi yêu cầu gửi lại từ Telegram sẽ bị từ chối tức thì, đảm bảo 100% chỉ xuất hiện **ĐÚNG 1 TIN NHẮN PHẢN HỒI NGUYÊN BẢN**.

---

## 🚀 thứ Tự Thực Thi Vercel Serverless (Vercel Lifecycle Freeze Fix)
- **Phát hiện nguyên nhân**: Trong hàm `do_POST()`, dòng gửi phản hồi `self.send_response(200)` & `self.wfile.write(b'{"ok":true}')` nằm TRƯỚC hàm `handle(data)`. Trên hạ tầng Vercel Serverless (WSGI Proxy), ngay sau khi header HTTP 200 được ghi xong, proxy Vercel coi như request đã kết thúc và ĐÓNG BĂNG/DỪNG TIẾN TRÌNH PYTHON ngay lập tức trước khi `handle(data)` kịp chạy xong ➔ Dẫn tới việc bot ngưng phản hồi (đứng bot)!
- **Khắc phục**: Đã đảo thứ tự cho `handle(data)` thực thi xong 100% trước, sau đó mới phát `200 OK` cho Vercel. Bot từ nay chạy phản hồi liên tục 100% không bao giờ bị đứng hay rơi tin nhắn!

---

## ⚡ ĐƠN GIẢN HÓA HỆ THỐNG: CHỈ DÙNG 1 SERVER CHÍNH DUY NHẤT
- **Không còn chạy song song 2 server mây gây xung đột**.
- Tất cả bot và webhook đã quy về **1 Server Chính Duy Nhất (`https://tni-bot.vercel.app`)**:
  * **Search Bot**: `https://tni-bot.vercel.app/api/search_bot`
  * **Asset Bot (Collector)**: `https://tni-bot.vercel.app/api/collector`
  * **Site Down Bot (Relay)**: `https://tni-bot.vercel.app/api/site_down_relay`
- Đã loại bỏ hoàn toàn server phụ `tni-done` khỏi Master Keepalive để triệt tiêu mọi rủi ro trôi code hay ghi đè lặp lại!

---

## 🛡️ NGUYÊN TẮC BẮT BUỘC (STRICT RULE ADDED)
- **Tuyệt đối không được tiện tay hay đoán đường dẫn Webhook / Endpoint**.
- Trước khi can thiệp bất kỳ kết nối nào, **bắt buộc phải đọc lại `SYSTEM_DOC.md` và `backup_context_03082026_final.md`**.
- Mọi quy tắc và bản đồ đường dẫn đã được lưu chặt chẽ tại [`AGENTS.md`](file:///d:/6.%20AI/1.%20QLTC/AGENTS.md) và [`.agents/rules/strict_doc_and_endpoint_verification.md`](file:///d:/6.%20AI/1.%20QLTC/.agents/rules/strict_doc_and_endpoint_verification.md).

---

## ⏰ Cấu hình 3 Workflows Chuẩn đã khóa gọn gàng trên Public Repo (`MON6879/tni-sitedown-relay`)

### 1. `🔄 1. Master Keepalive 24/7 (All Bots)` (`keepalive_all_bots.yml`):
- 🔄 Ping tự động mỗi 5 phút (`cron: '*/5 * * * *'`): Ping Server Chính `tni-bot` (`search_bot`, `collector`), `tni-sitedown`, Google Apps Script Main Backend và Auto Copy Paste GAS Backend (`AKfycbwi3J0V...`). **Đảm bảo tất cả Bot & Tác vụ Copy Paste hoạt động 24/7 vĩnh viễn 100% miễn phí!**

### 2. `📡 2. Site Down Tin 1 Relay (Every 20 Min)` (`botlookup_relay.yml`):
- 📡 Quét tự động đếm trạm Site Down tin 1 mỗi 20 phút (`cron: '*/20 * * * *'`).
- 🛡️ **Cơ chế Ngắt Mạch Thông Minh theo Kế Thừa 3 Lệnh `/down_` Gần Nhất**:
  * Quét lấy **3 lệnh `/down_` gần nhất** trong nhóm `BOT LOOKUP` (của bất kỳ ai trong nhóm).
  * Nếu từ thời điểm lệnh thứ 3 đó đến nay **KHÔNG CÓ BẤT KỲ TIN NHẮN NÀO chứa tiêu đề `Auto Report NocPro`** ➔ XÁC NHẬN BOT CÔNG TY ĐANG LỖI/DOWN ➔ **BỎ QUA KHÔNG GỬI REQUEST MỚI** để tuyệt đối không làm loãng nhóm!
  * Mỗi mốc 20-30 phút chỉ quét xem lịch sử nhóm. Khi nào có tin **`Auto Report NocPro`** xuất hiện (xác nhận Bot Công ty đã sửa xong) ➔ Ngay lập tức tự động mở lại và phát lệnh cào dữ liệu bình thường!

### 3. `📊 3. Unified Daily Reports (Reports 1-6, Refuel, Cable)` (`daily_reports.yml`):
- 📋 Tập trung toàn bộ lịch phát các Báo cáo:
  * **05:45 SÁNG & 16:20 CHIỀU**: Báo cáo 1, 2, 3, 4 (kèm Report 2 BOD Assign), 5A, 6, Refuel Request & Cable Report.
  * **05:25, 08:25, 09:50 AM & 15:20, 19:00, 22:00 PM**: Báo cáo 5.1 (Plan Reminder).
  * **21:00 TỐI**: Báo cáo 5B (Plan Update).
  * **14:00, 17:15, 19:00, 20:30 PM**: Báo cáo 6 (Check Read Status).

---

## 🌐 Quy định ngôn ngữ Báo cáo
- **100% TIẾNG ANH (ENGLISH ONLY)**: Tất cả thông báo, tiêu đề, trạng thái trong các báo cáo tự động đều dùng Tiếng Anh chuẩn.

---

## 🔗 Đường link Live Google Apps Script
- **Main Apps Script URL**: `https://script.google.com/macros/s/AKfycbwHyzulEMVGjslfjN_m38HzpFZHRfk2qwbQmdwb6MMqBM8xNm20JJxxzW_4zTNzp3n24Q/exec`
- **Auto Copy-Paste Apps Script URL**: `https://script.google.com/macros/s/AKfycbwi3J0VrrIE91mnPvIUuykPjwGvNc4y9JDxCNPvJTtOmVAvvalDXu5ZwYZmu5jW-fSo0w/exec`

---

## 🔒 Cam kết bảo mật & Lọc Bot
- Mọi Google Spreadsheet ID đều được nạp qua biến môi trường `SPREADSHEET_ID`.
- Mọi Telegram Bot Token nằm trong GitHub Encrypted Secrets và Vercel Environment Variables.
- Bot Search & Collector tự động lọc bỏ `is_bot`, chỉ thu thập khi người dùng thật gửi tiêu đề `Daily result:`.
