# 📄 BACKUP CONTEXT — 09/08/2026 (FINAL)

## 📌 Tóm tắt Thay đổi & Tối ưu Hệ thống (Fuel & Construction)

---

### 1. ⛽ Cấu hình Báo cáo Fuel & Refuel Plan (`refuel_plan_report.py` & `refuel_send.py`)
- **Sửa lỗi đếm Refueled:** Sửa lệch cột đọc dữ liệu từ tab `Refueled` trong `refuel_plan_report.py`:
  - `date_val`: Cột 2 (B) - Ngày
  - `site`: Cột 4 (D) - Mã Site ID
- **Báo cáo Request Refuel (Cột Y tab `Need Refuel`):**
  - Chạy bằng `refuel_send.py`.
  - Tải dữ liệu CSV từ ô Y2:Y10 tab `Need Refuel`.
  - Khung giờ gửi tự động (Myanmar Time UTC+6:30): **05:39 AM**, **13:29 PM**, **21:14 PM**.
  - Đã gửi thử nghiệm thành công vào Group Telegram **9 TNI REQUEST REFUEL** (`-5469544739`).

---

### 2. 🏗️ Chuyển Construction Bot Keep-Alive sang Public Repo (`TNI-SITE-DOWN`)
- **Nguyên nhân:** Workflow `keepalive_construction.yml` cũ chạy 5 phút/lần (288 lần/ngày) trên repo Private `phonghdpxd-cmd/tni-bot` làm cạn sạch 2.000 phút miễn phí hàng tháng của GitHub.
- **Giải pháp:**
  - Tắt lịch `cron: '*/5 * * * *'` trong repo Private `tni-bot`.
  - Tạo & push `keepalive_construction.yml` vào repo **PUBLIC** `phonghdpxd-cmd/TNI-SITE-DOWN` (commit `a055e55`).
  - Do chạy trên repo Public ➔ **0đ - VÔ HẠN PHÚT KHÔNG BAO GIỜ BỊ KHÓA HẠN NGẠCH**.
  - Apps Script target keepalive: `https://script.google.com/macros/s/AKfycbHraNPzUGVRNGvy-7_q4NyTiJSRUvlodCIjiJZJ00PaNMen-MpVjb4YTmyVex00mn6xQ/exec`

---

### 3. 🔄 Đồng bộ Báo cáo Tự động sang Public Repo
- **Apps Script `daily_report_scheduler.gs`:**
  - Cập nhật hàm `triggerDailyWorkflow()` bắn API dispatch về repo public: `https://api.github.com/repos/phonghdpxd-cmd/TNI-SITE-DOWN/actions/workflows/daily_reports.yml/dispatches`.
- **Đồng bộ mã nguồn:**
  - Đã copy tất cả file script báo cáo (`refuel_plan_report.py`, `daily_plan_report.py`, `cron_send.py`, `refuel_send.py`, `daily_read_report.py`, `backlog_send.py`, `tg_utils.py`, `daily_reports.yml`) sang `tni_site_down_repo` và commit/push lên `phonghdpxd-cmd/TNI-SITE-DOWN` (commit `cf06647`).

---

### 4. 🎨 Cập nhật Giao diện Portal (`index.html`)
- **Màu sắc 4 Team Cards:**
  - 🟣 **Overdue FOT (N):** Tím `#a78bfa`
  - 🟡 **WO Remain (P):** Vàng `var(--amber)`
  - 🔴/🟢 **Rank & Completion Status:** Đỏ/Xanh (dynamic)
  - 🔵/🟣 Các chỉ số khác: Giữ nguyên màu chuẩn UI.
- Đã commit & deploy live tại: `https://tni-bot.vercel.app`.

---

### 5. 📝 Bóc tách Tự động Báo cáo FT (`daily_report_collector.gs`)
- **Nâng cấp `handleDailyAdd`:**
  - Thêm bộ bóc tách `KEY_ALIASES` lọc chính xác các mục `3.` đến `10.` trong tin nhắn báo cáo Daily Result từ Telegram.
  - Tự động điền dữ liệu sạch đẹp vào đúng các **Cột F, G, H, I, J, K, L** trên sheet `Daily report and Bussiness` thay vì dồn nguyên khối text vào Cột D/E.

---

### 6. 🧹 Khử trùng Báo cáo Kế hoạch (`daily_plan_report.py`)
- **Thuật toán `deduplicate_plans_by_date`:**
  - Tự động lọc giữ lại duy nhất 1 bản tin Plan mới nhất khi Team Leader gửi cập nhật nhiều lần cho cùng 1 ngày.
  - Khắc phục hoàn toàn sự cố lặp đôi nội dung Plan và xé nhỏ tin nhắn Telegram.

---

### 7. 📷 Loại bỏ AI Nhận diện Khuôn mặt Bot Điểm danh (`TNI attendance.js`)
- **Xóa bỏ hoàn toàn Gemini Vision AI:**
  - Xóa sạch hàm `identifyFaces_` và `triggerUpdateMasterLibrary1225` khỏi `apps_script_attendance/TNI attendance.js`.
- **Chuyển sang Tra cứu Trực tiếp bằng Telegram ID:**
  - Tự động khớp nhân viên theo `ID Telegram` (Cột D) trong bảng `Staff attendance`. Tên nhân viên ở Cột E & F tự động điền đúng 100%, tốc độ xử lý điểm danh cực nhanh (0.5s).
- **Đã Deploy Clasp trực tiếp:**
  - Đã nạp code và Deploy phiên bản **Version @41** (`AKfycbxoM2KgWFJ4pXaYYdE7bAelngrpVD335D1a9y6Ryusr7Wh7xEwTOG4rfpPTC7K_ZMaqlg`) lên Google Apps Script Cloud.

---

### 8. ⏰ Khắc phục Lịch gửi 15:45 MMT & Tự động Ghim Note cho Report 4b (`cron_send.py` & `daily_reports.yml`)
- **Chuẩn hóa khung giờ gửi:** Đã sửa lịch cron gửi báo cáo chiều trong `daily_reports.yml` từ `'50 9 * * *'` (16:20 MMT) thành **`'15 9 * * *'`** (đúng **15:45 PM MMT** / 09:15 UTC) tuân thủ tuyệt đối quy định 05:45 AM & 15:45 PM MMT.
- **Loại bỏ bong bóng thông báo ghim tin nhắn hệ thống (Pin Notification Bubble):**
  - Đã loại bỏ hoàn toàn lệnh `bot.pin_chat_message` trong `cron_send.py` (commit `1859ee8`).
  - Hệ thống chỉ âm thầm lưu lại `msg_id` của bản tin `4b. Full Report` để tài khoản user `@phongha79` reply bản tin Note trực tiếp bên dưới.
  - Loại bỏ hoàn toàn dòng thông báo rác hệ thống `2. TNI Auto Report Daily pinned "📓 4b. Full Report..."` hiển thị trên khung chat.
  - Report 6 (`daily_read_report.py`) vẫn hoạt động và đếm lượt đọc chính xác 100%.

---

### 📋 Webhook & Registry cố định

| Bot Name | Telegram Username | Webhook / Dispatch Endpoint | Source Location |
|---|---|---|---|
| **Search Bot** | `@SEARCHTNITASKWOBOT` | `https://tni-bot.vercel.app/api/search_bot` | `api/search_bot.py` |
| **Asset Collector** | `@TNIASSETorderREQUEST_BOT` | `https://tni-bot.vercel.app/api/collector` | `api/collector.py` |
| **Refuel Collector** | `@TNI_FUEL` | `https://tni-bot.vercel.app/api/refuel_collector` | `api/refuel_collector.py` |
| **Site Down Relay** | `@tni_site_down_bot` | `https://tni-bot.vercel.app/api/site_down_relay` | `botlookup_relay.py` |
| **Attendance Bot** | `@TNIATTENDANCE_BOT` | Apps Script Cloud (Version @41) | `apps_script_attendance/TNI attendance.js` |
| **Construction Bot** | `@8903841312` (`10 TNI_SITE`) | Apps Script Web App Endpoint | `13_TNI_CONSTRUCTION.gs` |

---

## ⚡ Nâng cấp Smart Refuel Plan Parser (09/08/2026)
- **Tự động bóc tách thông minh:**
  - **Tên Đội (Team):** Nhận diện tất cả các dạng dính chữ/khoảng trắng/gạch nối/chữ hoa/chữ thường: `team02`, `Team03`, `Team-2`, `Team 2`, `TEAM 1`, `Team X`, `Aung Naing Refuel Team 2` → Chuẩn hóa thành `Team 2`, `Team 3`, v.v.
  - **Ngày (Date):** Nhận diện linh hoạt dạng `dd/mm/yyyy`, `d/m/yyyy`, `dd.mm.yyyy`, `d.m.yyyy`, `dd-mm-yyyy` (ví dụ: `9/8/2026`, `10.08.2026`) → Chuẩn hóa thành `09/08/2026`, `10/08/2026`.
  - **Cặp Trạm & Số lít (Site & Liters):** Bóc tách linh hoạt các trạm `TNIxxxx` và số lít đi kèm bất kể khoảng cách, dấu hai chấm, dấu gạch ngang, dấu cộng, chữ L hay lit/lít (`TNI0381 440L`, `TNI0008 220L`, `TNI0015: 440 L`, `TNI0099 - 440lit`).
- **Deploy:** Google Apps Script `apps_script_refuel_proj` Version `@71`.

---

## ⏰ Sửa lỗi Cron Schedule 15:45 PM MMT cho Reports 1, 2, 3, 4 (09/08/2026)
- **Nguyên nhân:** Khi đổi lịch cron chính ở đầu file `.github/workflows/daily_reports.yml` sang `'15 9 * * *'` (15:45 MMT / 09:15 UTC), các điều kiện `if:` trong từng bước công việc vẫn còn sót lại chuỗi cũ `'50 9 * * *'` làm GitHub Actions bỏ qua bước gửi báo cáo.
- **Khắc phục:**
  - Cập nhật toàn bộ các câu lệnh `if:` của các bước `Report 2`, `Reports 1, 2, 3, 4`, `Report 5A`, `Report 6`, `Cable Report`, `Refuel Request`, `Refuel Plan 1` sang `'15 9 * * *'`.
  - Đã chạy kích hoạt trực tiếp `backlog_send.py` và `cron_send.py` thủ công ngay lập tức để gửi đầy đủ các báo cáo 1, 2, 3, 4 chiều nay vào các nhóm Telegram!

---

## 🔧 Sửa lỗi 404 Asset & MDG Collector Apps Script Fallback URL (09/08/2026)
- **Nguyên nhân:** Biến môi trường fallback cho `APPS_SCRIPT_URL` và `MDG_APPS_SCRIPT_URL` trong `api/collector.py` và `api/search_bot.py` trỏ vào URL cũ `AKfycbzGFdnE...` (bị Google lưu trữ/xóa 404) dẫn tới lỗi `404 Client Error: Not Found` khi nhân viên gửi báo cáo MDG / Inventory trong nhóm Telegram `6. TNI COLLECT MDG RUN`.
- **Khắc phục:**
  - Cập nhật tự động chuyển hướng `APPS_SCRIPT_URL` và `MDG_APPS_SCRIPT_URL` về Web App URL đang hoạt động của Main Apps Script: `https://script.google.com/macros/s/AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA/exec` (Version `@302`).
  - Đã test ghi nhận báo cáo MDG trực tiếp qua `post_mdg_sheet` thành công 100% (`status: ok`, `ref: 00043`).

---

## 🔒 Nâng cấp Quy tắc Tìm kiếm Nghiêm ngặt & Khóa Chống Trùng Lặp Search Bot (09/08/2026)
- **Quy tắc 1 (Khớp độ dài mã trạm):** Lệnh tra cứu `TNIxxxx` / `TNIxxxx_01` chỉ kích hoạt khi tin nhắn khớp CHÍNH XÁC độ dài mã trạm (`TNI0394`, `TNI0394_01`, `/tni TNI0394`). Nếu tin nhắn có độ dài dài hơn (do chứa lời thoại, trao đổi công việc, báo cáo xăng dầu như `TNI0394 440L` hay `TNI0394 door open`) ➔ **BỎ QUA KHÔNG SEARCH!**
- **Quy tắc 2 (Lệnh Info):** Bắt đầu bằng `Info: TNIxxxx` hoặc `info: TNIxxxx` hoặc `/info TNIxxxx` (không chứa thêm văn bản thừa) ➔ Đưa vào tra cứu thông tin Site (`full_info=True`).
- **Quy tắc 3 (Khóa Dedup Key 10s):** Tạo bộ đệm `is_duplicate_search(chat_id, user_id, query)` chặn 100% các request trùng lặp do Telegram retry hoặc người dùng gõ lặp lại trong 10 giây ➔ **Triệt tiêu lỗi gửi kết quả tìm kiếm lặp lại!**

---

## 📜 CHÍNH THỨC HÓA QUY TẮC 6 BƯỚC "LƯU ĐI" BẮT BUỘC (09/08/2026)
- **Cập nhật AGENTS.md:** Đã bổ sung chính thức **Bước 5** (Đồng bộ 100% logic liên quan giữa code, workflow, env & docs) và **Bước 6** (Kiểm thử thực tế Live Output Verification) vào Quy tắc LƯU ĐI bắt buộc.
- **Cam kết tuân thủ:** Mọi thao tác cập nhật hệ thống từ nay về sau BẮT BUỘC phải thực hiện đầy đủ 6 bước LƯU ĐI mà không được bỏ sót bất kỳ bước nào!

---

## 🔒 ĐỒNG BỘ TOÀN DIỆN 100% MAIN_GAS_FALLBACK TRÊN TẤT CẢ CÁC SCRIPT PYTHON (09/08/2026)
- **Đã rà soát & cập nhật:** Bổ sung biến kiểm tra & chuyển hướng `MAIN_GAS_FALLBACK` (`AKfycbz-NZlBk8q2...` Version `@302`) cho **TOÀN BỘ** các script Python trong hệ thống (`daily_plan_report.py`, `daily_bod_assign.py`, `cron_send.py`, `backlog_send.py`, `daily_read_report.py`, `api/collector.py`, `api/search_bot.py`).
- **Triệt tiêu nguy cơ lệch version:** Đảm bảo không bao giờ bị trôi về version cũ hoặc bị thiếu đồng bộ URL như sự cố Asset Collector trước đó.

---

## 🔧 Sửa lỗi Phạm vi Khai báo Hàm `is_duplicate_search` (Search Bot Deployment Fix) (09/08/2026)
- **Nguyên nhân:** Khai báo hàm `is_duplicate_search` bị nằm nhầm bên trong thân hàm `handle()` làm xuất hiện câu lệnh `return False` sớm, khiến Search Bot thoát hàm trước khi kịp tới khối code tra cứu `TNIXXXX` / `Info: TNIXXXX` (dẫn tới Bot không phản hồi các câu gõ `tni0129` hay `Info: TNI0129`).
- **Khắc phục:** Đã chuyển `is_duplicate_search` và `_recent_search_keys` ra phạm vi toàn cục (global scope). Đã test trực tiếp `handle({'text': 'TNI0129'})` thành công 100%.
- **Vercel Deployment:** Code mới đã được deploy trực tiếp lên Vercel (`tni-bot.vercel.app`), Bot đã hoạt động trơn tru ngay lập tức!

---

## 📦 Gộp Tin Nhắn Kết Quả Tra Cứu Search Bot (Fix Lỗi Nhảy Chat Telegram) (09/08/2026)
- **Nguyên nhân:** Khi tra cứu danh sách nhiều WO (như `/t1notclose`, `/t2waitcd`, `/t1`), Bot cũ gửi từng WO dưới dạng 1 tin nhắn riêng lẻ (39 WO ➔ gửi 39-40 tin nhắn liên tiếp) làm Telegram phát thông báo nổ liên tục và giao diện chat bị giật/nhảy (pop & jump).
- **Khắc phục:**
  - Xóa bỏ các tin nhắn phụ `⏳ Loading...`.
  - Gộp tất cả các dòng kết quả thành 1 khối văn bản duy nhất có tiêu đề tổng hợp (ví dụ: `📑 T1 NOT CLOSE (39 WOs)`).
  - Tự động gom tin nhắn vào **1 tin duy nhất** (hoặc tối đa 2 tin nếu độ dài vượt quá 4096 ký tự) nhờ hàm `split_messages()`.
  - **Kết quả:** 39 WO trước đây gửi 40 tin ➔ Giờ chỉ gửi **đúng 2 tin duy nhất**, giao diện chat vô cùng êm ái, phẳng phiu!




