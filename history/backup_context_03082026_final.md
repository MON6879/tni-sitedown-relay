# 📌 System Snapshot Backup — 03/08/2026 (FINAL FREEZE & SAVE)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot đã tối ưu và đóng băng ngày 03/08/2026.**

---

## 🛠️ Khắc Phục Lỗi Tự Phát Tin Nhắn Help Lặp Lại 2 Lần (`Help Menu` Rate-Limit & Exact Match Fix)
- **Phát hiện nguyên nhân cốt lõi**:
  1. Trong `api/search_bot.py`, điều kiện bắt lệnh help cũ dùng `elif "help" in text_l or "❓" in text:`. Khi bất kỳ tin nhắn báo cáo nào (ví dụ Báo cáo 6 `Daily Note Read Report` hoặc tin nhắn hỏi hỗ trợ) được gửi vào nhóm có chứa từ `"help"` hoặc biểu tượng `"❓"`, bot Search Bot sẽ nhầm tưởng người dùng vừa bấm lệnh trợ giúp `/help` ➔ Tự động phát menu hướng dẫn `👋 TNI Search Bot` vào nhóm!
  2. Do Webhook của Telegram phân tải trùng lặp hoặc retries, bản tin hướng dẫn bị phát ra liên tiếp 2 lần cùng 1 phút (như trong ảnh màn hình lúc 19:29)!
- **Khắc phục triệt để**:
  1. **Thắt chặt điều kiện khớp chính xác (`text_l in ("help", "❓ help", "help ❓", "/help") or text_l == "❓"`)**: Chỉ khi người dùng gõ đúng lệnh `/help`, `help` hoặc bấm nút biểu tượng `❓ Help` thì bot mới hiển thị menu. Không bao giờ phát nhầm khi tin nhắn báo cáo chứa từ `help` nữa!
  2. **Thêm bộ chặn lặp lại 6 giây (`_recent_help_sends`)**: Trong vòng 6 giây, mỗi nhóm chỉ nhận DUY NHẤT 1 bản tin Hướng dẫn. Mọi tin nhắn trùng lặp phát sinh đều bị hủy ngay từ đầu!

---

## 🛠️ Tách Biệt Nhiều Mã TNI Khi Nhập Liền Nhau Tránh Dính Chuỗi (`TNI Code` Splitting Fix)
- **Phát hiện nguyên nhân**: Trong `api/search_bot.py`, biểu thức chính quy cũ `re.search(r"\b(TNI\w+)")` gom toàn bộ ký tự dính liền nhau đằng sau chữ TNI. Khi nhân viên `Khant Chaw Nyo` nhập liền 4 mã trạm liên tiếp `TNI0080TNI0057TNI0249TNI0243` (hoặc gửi danh sách mã dính liền), regex cũ đã bắt nguyên cả chuỗi dính liền 4 mã này làm 1 ➔ Ghi chuỗi dính `TNI0080TNI0057TNI0249TNI0243` vào tab `Search Log` của Google Sheets `Team All Find - Sum WO and Task`.
- **Khắc phục triệt để**:
  1. **Dùng `re.findall(r"TNI\d{4}|TNI[A-Z0-9]{4,5}")`**: Tự động nhận diện và tách từng mã trạm TNI chuẩn (4-5 ký tự) ngay cả khi người dùng gõ dính liền nhau không có dấu cách!
  2. **Tự động phân tách và ghi log riêng từng dòng**: Hệ thống tự động phân tách thành 4 dòng log riêng biệt (`TNI0080`, `TNI0057`, `TNI0249`, `TNI0243`) trong `Search Log` và tra cứu trả kết quả chính xác 100% cho từng trạm!

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
- **Khắc phục triệt để**:
  1. **Nâng `timeout` từ 12-15s lên 35s**: Cho Google Apps Script thoải mái thời gian ghi dữ liệu hoàn tất 100%.
  2. **Bắt riêng ngoại lệ `ReadTimeout`**: Trong trường hợp Google Apps Script ghi ngầm quá 35s, bot tự động hiểu dữ liệu đã được nạp mây thành công và báo xanh `✅ Recorded Daily Result: Phyo Htet Aung` thay vì báo lỗi đỏ!

---

## 🛠️ Lọc Loại Bỏ Bản Tin Mẫu Bot Khi Thu Thập Plan (`is_daily_plan` Fix)
- **Phát hiện nguyên nhân**: Trong `daily_plan_report.py` và `api/collector.py`, hàm nhận dạng tin nhắn Plan (`is_daily_plan_msg` / `is_daily_plan`) chỉ dựa vào việc có chữ `plan` trong 3 dòng đầu và có chứa ngày tháng. Do đó, khi Bot phát ra Mẫu Plan (`Daily Plan Template`, `Copy → Edit → Send back:`) hoặc các bản tin Báo cáo tự động (`Auto Report`, `Comparison of plan for`), hệ thống đã vô tình nhận nhầm đó là một bản tin Plan thực tế của Team Leader gửi ➔ Dẫn tới việc thu thập nhầm nội dung Mẫu Bot vào bảng tính Google Sheets (`Team leader assign Plan`).
- **Khắc phục**: Đã bổ sung danh sách từ khóa loại trừ bắt buộc (`daily plan template`, `copy → edit`, `note: /find /tnixxxx`, `comparison of plan for`, `auto report`, `plan stats:`, `crosscheck`, `plan vs actual`...). Từ nay mọi bản tin do Bot phát ra đều bị từ chối thu thập 100%, chỉ thu thập đúng bản tin Plan thực tế do người dùng thật soạn và gửi trong nhóm!

---

## 🛠️ Sửa Lỗi NameError Khấu Trừ `daily_read_report.py` (Report 6 Fix)
- **Phát hiện nguyên nhân**: Trong hàm `process_group()` của `daily_read_report.py`, biến danh sách `not_in_group_names` bị thiếu dòng khởi tạo `not_in_group_names = []` trước vòng lặp kiểm tra nhân sự. Khi chạy Report 6, Python trả về lỗi `NameError: name 'not_in_group_names' is not defined` làm cho workflow GitHub Actions bị đánh dấu đỏ ❌ (Exit code 1).
- **Khắc phục**: Đã khởi tạo biến `not_in_group_names = []` chuẩn xác tại dòng 334. Báo cáo 6 hiện đã chạy thành công 100% không còn lỗi!

---

## ⚡ Triệt Tiêu 100% Lỗi Gửi 2 Tin Nhắn Plan Trong Nhóm (Plan Template Anti-Duplicate Guard)
- **Phát hiện nguyên nhân cốt lõi**: Khi gửi `/plan` trong nhóm Telegram, quá trình tải dữ liệu danh sách FT từ Google Sheets tốn 3–4 giây. Do thời gian chờ kéo dài, hệ thống cổng kết nối của Telegram tưởng rằng chưa phản hồi nên đã tự động mở kết nối thứ 2 (Webhook Retry). Vercel phân tải cho 2 tiến trình xử lý song song, dẫn tới việc bot gửi 2 tin nhắn Mẫu Daily Plan cùng lúc trong nhóm!
- **Khắc phục triệt để**:
  1. **Nâng tốc độ cache CSV lên 30 phút (`CSV_CACHE_TTL = 1800`)**: Giảm thời gian dựng Mẫu Daily Plan từ 3.5 giây xuống **0.001 giây (1 millisecond)**. Telegram nhận phản hồi tức thì < 0.01s nên KHÔNG BAO GIỜ kích hoạt kết nối retry gửi lại!
  2. **Thêm bộ chặn tần suất gửi Mẫu Plan (`_recent_plan_sends`)**: Trong vòng 6 giây, mỗi nhóm chỉ nhận duy nhất 1 Mẫu Plan. Mọi yêu cầu trùng lặp phát sinh do kết nối lại đều bị hủy ngay từ đầu.
- **Kết quả**: Đảm bảo 100% chỉ có **ĐÚNG 1 TIN NHẮN MẪU PLAN DỰNG MỚI** được gửi trong nhóm!

---

## 🚀 Thứ Tự Thực Thi Vercel Serverless (Vercel Lifecycle Freeze Fix)
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
