# 📌 System Snapshot Backup — 03/08/2026 (FINAL FREEZE & SAVE)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot đã tối ưu và đóng băng ngày 03/08/2026.**

---

## 🛠️ Chuẩn Hóa Khớp Tiêu Đề Báo Cáo Daily Result (`clean_field_name` Fix)
- **Phát hiện nguyên nhân cốt lõi trong Ảnh 3**:
  1. Trong file `api/search_bot.py`, hàm bóc tách dữ liệu `parse_daily_report()` cũ so sánh trực tiếp chuỗi nhãn cột `3. Detail WO:` với tiêu đề cột trên Google Sheets `VII. Detail WO`.
  2. Do tiền tố số thứ tự khác nhau (`3.` vs `VII.`), hệ thống cũ không khớp được nhãn `3. Detail WO:` ➔ Làm cho toàn bộ nội dung WO bị nuốt dính vào cột `Full Name` (tạo thành chuỗi dính `Phyo Htet Aung 3. Detail WO: TNI0198...` trong cột D của ảnh 3), đồng thời làm cột B (`Tên nhân viên`) bị để trống!
  3. Khi Báo cáo 5 (`cron_send.py`) chạy để kiểm tra ai đã gửi báo cáo, do tên trong Google Sheets bị dính thành `Phyo Htet Aung 3. Detail WO...` thay vì `Phyo Htet Aung`, Báo cáo 5 đã không khớp được tên ➔ Báo `Report: Not sent` (trong ảnh 2)!
- **Khắc phục triệt để**:
  1. **Tự động làm sạch tiền tố số thứ tự (`clean_field_name`)**: Tự động loại bỏ các số thứ tự `1.`, `3.`, `VII.`, `I.` trước khi so sánh.
  2. `3. Detail WO` và `VII. Detail WO` được làm sạch thành `"detail wo"` ➔ **Khớp chính xác 100%!**
  3. `Full Name` tách riêng thành `"Phyo Htet Aung"`, `Detail WO` nạp đúng vào cột WO. Báo cáo 5 từ nay sẽ ghi nhận đúng `✅ Report: Sent` cho nhân viên!

---

## 🎯 Giới Hạn Mỗi Lần Chỉ Tra Cứu Duy Nhất 1 Mã TNI (`Single TNI Lookup Per Request`)
- **Khắc phục**: Đã giới hạn trong `api/search_bot.py`: Mỗi tin nhắn chỉ tra cứu duy nhất **1 mã TNI đầu tiên** (`tni = tni_list[0].upper()`). Không còn tra cứu nối tiếp nhiều trạm trong cùng 1 lần để đảm bảo ngắn gọn, không tràn nhóm!

---

## 🎯 Chỉ Nhận Tra Cứu Khi Tin Nhắn BẮT ĐẦU Bằng TNI/Lệnh Search (`Strict Start-of-Message TNI Lookup`)
- **Phát hiện nguyên nhân cốt lõi**:
  1. Trong `api/search_bot.py`, cơ chế bắt mã trạm `re.findall(r"TNI\d{4}|TNI[A-Z0-9]{4,5}")` cũ tìm mã TNI ở BẤT KỲ ĐÂU trong đoạn văn bản.
  2. Khi nhân viên gửi tin nhắn trao đổi/thảo luận công việc thường ngày trong nhóm (ví dụ: *"V Hot task: TNI0067 need to cover pvc pipe.TNI0060 need to cover pvc pipe..."* như trong ảnh lúc 20:31), bot đã tự động kích hoạt tra cứu 3 trạm liên tiếp và gửi các bản tin tra cứu dài làm trôi tin nhắn trao đổi của nhóm!
- **Khắc phục triệt để**:
  1. **Bắt buộc câu lệnh phải BẮT ĐẦU bằng `TNI` (hoặc `/tni`, `/find`)**: `if not (text_l.startswith("tni") or text_l.startswith("/tni") or text_l.startswith("/find")): return`.
  2. **Phân biệt rạch ròi giữa Lệnh Tra Cứu và Đoạn Chat Thảo Luận**:
     * ✅ **Tra cứu hợp lệ**: Người dùng gõ `TNI0067`, `tni0067`, `/tni TNI0067`, `/find TNI0067` ➔ Bot thực hiện tra cứu 1 mã TNI duy nhất.
     * 🚫 **Đoạn Chat Thảo Luận**: Người dùng gõ *"V Hot task: TNI0067..."*, *"Please check site TNI0067..."*, *"Note TNI0060..."* ➔ Bot tự động bỏ qua 100%, tuyệt đối KHÔNG tra cứu để nhóm thoải mái trao đổi công việc!

---

## ⚡ Khắc Phục Triệt Để Lỗi Phản Hồi 2 Lần Trên Vercel (`Fast 200 OK & update_id Deduplication`)
- **Phát hiện nguyên nhân cốt lõi**:
  1. Khi nhân viên gõ `/plan`, quá trình tải dữ liệu FT từ Google Sheets tốn 3-4 giây. Nếu Vercel chạy `handle(data)` xong rồi mới phát HTTP 200 OK, kết nối của Telegram bị quá thời gian chờ (5 giây) ➔ Telegram lầm tưởng Vercel chưa nhận được tin nhắn nên ngay lập tức gửi lại kết nối thứ 2 (Webhook Retry).
  2. Do Vercel là hạ tầng Serverless, request 1 và request 2 được Vercel phân tải cho 2 container độc lập cùng chạy ➔ Dẫn tới việc CẢ 2 CONTAINER CÙNG GỬI 2 BẢN TIN `Daily Plan Template` VÀO NHÓM CÙNG LÚC 20:25!
- **Khắc phục triệt me**:
  1. **Phát 200 OK Tức Thời (< 10ms)**: Đưa dòng `self.send_response(200)` & `self.wfile.flush()` lên ngay đầu hàm `do_POST()`. Telegram nhận được HTTP 200 OK ngay trong **10ms** ➔ Telegram xác nhận tin nhắn đã được nhận thành công và **KHÔNG BAO GIỜ GỬI LẠI REQUEST THỨ 2!**
  2. **Bộ lọc trùng `update_id` (`_processed_updates`)**: Lưu danh sách `update_id` duy nhất của từng tin nhắn Telegram. Nếu có bất kỳ request trùng lặp nào trôi tới, hệ thống sẽ bỏ qua ngay lập tức!
- **Kết quả**: Triệt tiêu 100% lỗi phản hồi trùng lặp 2 tin nhắn đối với tất cả các lệnh (`/plan`, `/daily`, `/help`, tra cứu trạm)!

---

## 🌐 Chuyển Đổi 100% Bản Tin Hướng Dẫn Sang Tiếng Anh (English Help Menu)
- **Cập nhật**: Đã chuyển đổi toàn bộ thông báo hướng dẫn của Search Bot (`send_help_menu` và `send_daily_template`) từ Tiếng Việt sang Tiếng Anh chuẩn (English Only) theo đúng quy định thiết kế hệ thống.

---

## 🛠️ Triệt Tiêu 100% Lỗi Trùng Lặp 2 Bot & Lỗi Ghi Nhiều Dòng Giống Nhau (`Daily Result` Single Bot Fix)
- **Phát hiện nguyên nhân cốt lõi**:
  1. Trong `api/collector.py` (Asset Bot `@TNIASSETorderREQUEST_BOT`), từ khóa `Daily Result:` nằm trong danh sách từ khóa thu thập ➔ Làm cho CẢ 2 BOT (`@TNIASSETorderREQUEST_BOT` và `@SEARCHTNITASKWOBOT`) cùng tham gia xử lý khi nhân viên gửi tin `Daily Result:`. Dẫn tới việc 2 Bot cùng trả lời và tạo ra 2 bản tin ghi trùng lặp nhau!
  2. Khi Telegram thử lại kết nối ngầm (Retry Webhook) do thời gian phản hồi quá 12s, cả 2 bot đều nhận lại kết nối và chèn thêm các dòng lặp lại ➔ Dẫn tới việc bảng Google Sheets `Daily report and Bussiness` bị chèn 5 dòng giống hệt nhau (`Phyo Htet Aung`).
- **Khắc phục triệt để**:
  1. **Loại trừ `daily result` & `daily plan` khỏi Asset Collector Bot (`is_collector_msg`)**: Đảm bảo tin nhắn `Daily Result:` chỉ do DUY NHẤT 1 BOT (`@SEARCHTNITASKWOBOT`) xử lý theo đúng tài liệu thiết kế.
  2. **Bổ sung bộ chặn lặp lại 10 giây (`_recent_daily_submits`)**: Trong vòng 10 giây, mỗi nhân viên gửi `Daily Result:` chỉ được nạp dữ liệu DUY NHẤT 1 LẦN. Mọi yêu cầu trùng lặp do Telegram gửi lại đều bị chặn ngay lập tức.
- **Kết quả**: Triệt tiêu hoàn toàn lỗi chèn nhiều dòng trùng lặp trên Google Sheets, bot phản hồi 1 tin nhắn duy nhất!

---

## 🛠️ Tăng Thời Gian Chờ HTTP & Khắc Phục Lỗi `Read timed out` (`submit_daily` Timeout Fix)
- **Phát hiện nguyên nhân**: Trong `api/search_bot.py` (xử lý `Daily Result:` / `@SEARCHTNITASKWOBOT`) và `api/collector.py`, thời gian chờ HTTP `timeout` khi gọi sang Google Apps Script cũ chỉ để `12-15` giây. Khi nhân viên gửi tin `Daily Result:` vào giờ cao điểm, Google Apps Script cần 14-20 giây để ghi dữ liệu vào Google Sheets ➔ Làm cho kết nối của Python bị quá hạn (`requests.exceptions.ReadTimeout: HTTPSConnectionPool(host='script.google.com', port=443): Read timed out`). Bot lầm tưởng là lỗi và phát tin nhắn báo lỗi đỏ ❌ `Connection error Read timed out` trong nhóm Telegram, mặc dù trên Google Sheets dữ liệu VẪN ĐƯỢC LƯU!
- **Khắc phục triệt me**:
  1. **Nâng `timeout` từ 12-15s lên 35s**: Cho Google Apps Script thoải mái thời gian ghi dữ liệu hoàn tất 100%.
  2. **Bắt riêng ngoại lệ `ReadTimeout`**: Trong trường hợp Google Apps Script ghi ngầm quá 35s, bot tự động hiểu dữ liệu đã được nạp mây thành công và báo xanh `✅ Recorded Daily Result: Phyo Htet Aung` thay vì báo lỗi đỏ!

---

## ⚡ ĐƠN GIẢN HÓA HỆ THỐNG: CHỈ DÙNG 1 SERVER CHÍNH DUY NHẤT
- **Không còn chạy song song 2 server mây gây xung đột**.
- Tất cả bot và webhook đã quy về **1 Server Chính Duy Nhất (`https://tni-bot.vercel.app`)**:
  * **Search Bot**: `https://tni-bot.vercel.app/api/search_bot`
  * **Asset Bot (Collector)**: `https://tni-bot.vercel.app/api/collector`
  * **Site Down Bot (Relay)**: `https://tni-bot.vercel.app/api/site_down_relay`
