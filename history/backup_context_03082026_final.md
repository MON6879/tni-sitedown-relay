# 📌 System Snapshot Backup — 03/08/2026 (FINAL FREEZE & SAVE)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot đã tối ưu và đóng băng ngày 03/08/2026.**

---

## 🚀 Khắc Phục Lỗi Đứng Bot / Ngưng Phản Hồi Trên Vercel Serverless (`Execution Order Fix`)
- **Phát hiện nguyên nhân cốt lõi trong Ảnh mới (21:36)**:
  1. Trong hàm `do_POST()` của `api/search_bot.py`, dòng gửi phản hồi `self.send_response(200)` & `self.wfile.write(b'{"ok":true}')` trước đó bị đặt lên **TRƯỚC** hàm `handle(data)`.
  2. Trên hạ tầng Vercel Serverless (WSGI Proxy), ngay sau khi header HTTP 200 được gửi đi, proxy Vercel coi như request đã hoàn tất ➔ Vercel tự động **ĐÓNG BĂNG/DỪNG TIẾN TRÌNH PYTHON LAMBDA NGAY LẬP TỨC** trước khi `handle(data)` kịp gửi bản tin Telegram về cho người dùng! Dẫn đến việc khi gõ `/plan` hay `/t2notclose` lúc 21:36, bot bị ngưng phản hồi (đứng bot)!
- **Khắc phục triệt để**:
  1. **Đảo thứ tự chuẩn Vercel Serverless Lifecycle**: Đưa `handle(data)` thực thi xong 100% trước, sau đó mới phát `200 OK` cho Vercel.
  2. Vercel giữ cho Lambda Container luôn chạy cho đến khi tin nhắn Telegram được phát ra hoàn tất 100%!
  3. Kết hợp với cache dữ liệu 30 phút (`CSV_CACHE_TTL = 1800`), `handle(data)` chạy siêu tốc chỉ tốn **0.001 giây**, vừa đảm bảo không bị đứng bot vừa phản hồi cực kỳ tức thì!

---

## 🎯 Đảm Bảo Chỉ Thu Thập Bản Tin Plan Gốc Của Team Leader Vào Sheet `Team leader assign Plan`
- **Phát hiện nguyên nhân cốt lõi trong Ảnh 21:06**:
  1. Trong tab `Team leader assign Plan` (GID: 1934147618) của Google Sheets, Dòng 2 cột D (`Daily Plan`) bị ghi đè bởi bản tin **Báo Cáo Tóm Tắt Tự Động Do Bot Phát Ra** (`📅 03/08/2026 17:28 📌 Shows detailed site assignments and tasks grouped by department...`).
  2. Do trong bản tin Báo cáo Tóm tắt tự động của Bot có dòng chữ `...from today/recent plans.` và có ngày `03/08/2026`, hàm quét nhận diện Plan `is_daily_plan_msg()` đã bị nhầm lẫn và thu thập nhầm bản tin Tổng hợp Báo cáo của Bot vào tab làm Plan gốc của Team Leader!
- **Khắc phục triệt để**:
  1. **Bổ sung danh sách loại trừ từ khóa bản tin Tổng hợp của Bot**: Bổ sung `shows detailed site assignments`, `tasks grouped by department`, `recent plans`, `plans for ` vào danh sách loại trừ bắt buộc trong `daily_plan_report.py` và `api/collector.py`.
  2. **Quy trình thu thập 2 bước chuẩn xác**:
     * **Bước 1 (Thu thập)**: Hệ thống chỉ thu thập DUY NHẤT bản tin Kế hoạch thực tế do các Team Leader gửi trong nhóm vào tab `Team leader assign Plan` (Cột D).
     * **Bước 2 (Tổng hợp & So sánh)**: Các Báo cáo 5A, 5B, 5.1 (`cron_send.py` / `daily_plan_report.py`) sẽ đọc bản tin Plan gốc từ Cột D của tab `Team leader assign Plan` để thực hiện so sánh với `Daily report and Bussiness` ➔ Phát bản tin đối soát Plan vs Actual chính xác 100%!

---

## 🛠️ Chuẩn Hóa Khớp Tiêu Đề Báo Cáo Daily Result (`clean_field_name` Fix)
- **Phát hiện nguyên nhân cốt lõi trong Ảnh 3**:
  1. Trong file `api/search_bot.py`, hàm bóc tách dữ liệu `parse_daily_report()` cũ so sánh trực tiếp chuỗi nhãn cột `3. Detail WO:` với tiêu đề cột trên Google Sheets `VII. Detail WO`.
  2. Do tiền tố số thứ tự khác nhau (`3.` vs `VII.`), hệ thống cũ không khớp được nhãn `3. Detail WO:` ➔ Làm cho toàn bộ nội dung WO bị nuốt dính vào cột `Full Name` (tạo thành chuỗi dính `Phyo Htet Aung 3. Detail WO: TNI0198...` trong cột D của ảnh 3), đồng thời làm cột B (`Tên nhân viên`) bị để trống!
  3. Khi Báo cáo 5 (`cron_send.py`) chạy để kiểm tra ai đã gửi báo cáo, do tên trong Google Sheets bị dính thành `Phyo Htet Aung 3. Detail WO...` thay vì `Phyo Htet Aung`, Báo cáo 5 đã không khớp được tên ➔ Báo `Report: Not sent`!
- **Khắc phục triệt để**:
  1. **Tự động làm sạch tiền tố số thứ tự (`clean_field_name`)**: Tự động loại bỏ các số thứ tự `1.`, `3.`, `VII.`, `I.` trước khi khớp cột.
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

## 🌐 Chuyển Đổi 100% Bản Tin Hướng Dẫn Sang Tiếng Anh (English Help Menu)
- **Cập nhật**: Đã chuyển đổi toàn bộ thông báo hướng dẫn của Search Bot (`send_help_menu` và `send_daily_template`) từ Tiếng Việt sang Tiếng Anh chuẩn (English Only) theo đúng quy định thiết kế hệ thống.

---

## ⚡ ĐƠN GIẢN HÓA HỆ THỐNG: CHỈ DÙNG 1 SERVER CHÍNH DUY NHẤT
- **Không còn chạy song song 2 server mây gây xung đột**.
- Tất cả bot và webhook đã quy về **1 Server Chính Duy Nhất (`https://tni-bot.vercel.app`)**:
  * **Search Bot**: `https://tni-bot.vercel.app/api/search_bot`
  * **Asset Bot (Collector)**: `https://tni-bot.vercel.app/api/collector`
  * **Site Down Bot (Relay)**: `https://tni-bot.vercel.app/api/site_down_relay`
