# 🗂️ Backup Context — TNI Bot System (30/06/2026)

> ⚠️ **ĐỌC FILE NÀY TRƯỚC KHI SỬA BẤT KỲ THỨ GÌ!**
> Snapshot: 30/06/2026 17:30 (Myanmar UTC+6:30)
> Conversation ID: `620dc64e-d895-40fd-b641-670b2b3cc8f2`

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

## ✅ Hoàn thành ngày 30/06/2026

### 1. Hệ thống lại Báo cáo từ 1 đến 6 & Đánh số nhóm CONTROL
Đã hệ thống hóa và đánh số hiệu tất cả các báo cáo của nhóm Team và nhóm **CONTROL SITE** để đồng bộ, thống nhất và có trình tự thời gian logic:

#### 📋 Danh sách Báo cáo gửi nhóm CONTROL:
- `📋 1. Report — Technical Dept Task Progress` (từ `cron_send.py` gửi lúc 17:30 và `combined_bot.py` gửi lúc 17:00)
- `📋 2. Report — Daily BOD Assign — Summary` (từ `daily_bod_assign.py` gửi lúc **17:00**)
- `📋 4. Report — Daily EOD Task & Stats — Summary` (từ `cron_send.py` gửi lúc 17:30)
- `📋 5. Report — Daily Plan & Results — Summary` (từ `daily_plan_report.py` gửi lúc **20:00**)
- `📋 6. Report — Daily Note Read Report — Summary` (từ `daily_read_report.py` gửi lúc 20:30)

#### 📋 Danh sách Báo cáo gửi nhóm TEAM:
- `📋 1. Report — Daily Backlog (Category/Description)` (17:10)
- `📋 2. Report — Daily Backlog (Task Progress)` (17:10)
- `📋 3. Report — Main DG Material Need` (17:10)
- `📋 4. Report — Daily EOD Task & Stats` (17:30)
- `📋 5. Report — Daily Plan & Results` (20:00)
- `📋 6. Report — Daily Note Read Report` (20:30, Cutoff 20:25)

### 2. Báo cáo mới: BOD-assigned Task Statistics (`📋 2. Report` CONTROL)
- **File nguồn:** [daily_bod_assign.py](file:///D:/6.%20AI/1.%20QLTC/Task%20and%20WO/daily_bod_assign.py)
- **Workflow:** [daily_bod_assign.yml](file:///D:/6.%20AI/1.%20QLTC/Task%20and%20WO/.github/workflows/daily_bod_assign.yml)
- **Giờ gửi:** **17:00 Myanmar** (được trigger tự động từ Google Apps Script).
- **Tab nguồn:** Tab `BOD assign` trong Google Sheet (tải trực tiếp bằng tham số `sheet=BOD+assign`).
- **Logic tổng hợp:**
  - Gom nhóm dữ liệu theo cột A (`Assign Admin` - chức vụ/phòng ban như Admin, Asset, CM, M&E...).
  - Đếm tổng số task đã giao (`Task assign`).
  - Đếm số lượng task hoàn thành theo ngày hoàn thành tại cột H (`Dep update Date complete`) theo mốc 3Day (`d2/d1/d0`), 7Day, và Month hiện tại.
  - Đếm số lượng task hoàn thành nhưng chưa xác nhận (cột H khác rỗng và cột J `Manager Confirm` bằng rỗng).
  - Định dạng hiển thị kèm chấm màu để dễ phân biệt:
    `🔵 Admin: Task assign : 10 = 3 day 0/0/0 7 day: 1 Month: 5 Not Yet Cofirm : 3 case`
- **Xóa tin cũ:** Tự động xóa tin nhắn BOD Assign cũ trên CONTROL trước khi gửi tin mới (dùng key `BOD_ASSIGN_CONTROL`).

### 3. Thay đổi quan trọng về Logic & Loại bỏ hoàn toàn tin nhắn Cá nhân
- **LOẠI BỎ TOÀN BỘ TIN NHẮN CÁ NHÂN (Hàng 4-87)**:
  - Theo yêu cầu của user, số liệu các đội từ hàng 4 đến 74 đã được gửi đầy đủ vào các nhóm Team, nên **không gửi tin nhắn cá nhân đến từng người** nữa.
  - Đã loại bỏ hoàn toàn logic gửi tin nhắn cá nhân cho các hàng 4-74 (nhân viên, quản lý) và 75-87 (Technical Dept) trong daemon scheduler (`combined_bot.py`).
  - Toàn bộ hệ thống hiện tại **KHÔNG còn gửi bất kỳ tin nhắn cá nhân nào nữa**.
- **Đổi giờ gửi Plan (`5. Report`)**: Chuyển thời gian chạy `daily_plan_report.py` từ 21:00 về **20:00 Myanmar**. Thay đổi này được cập nhật trong `site_down_notify.gs` (khung quét trigger `19:55–20:25`) và tên workflow trên GitHub Actions.
- **Bỏ khung giờ đọc Note (`6. Report`)**: Loại bỏ điều kiện chỉ tính lượt đọc Note trong khung `18:00 - 20:00`. Chuyển sang logic **Cutoff lúc 20:25 Myanmar** (bất cứ ai đã đọc tin nhắn trước/tại thời điểm 20:25 đều được tính là đã đọc).
- **Thứ tự chạy GitHub Actions**: Điều chỉnh thứ tự trong file `daily_task.yml` để chạy `backlog_send.py` (Report 1, 2, 3) trước `cron_send.py` (Report 4) để tin nhắn xuất hiện đúng thứ tự từ trên xuống dưới trên Telegram.
- **Gộp tin nhắn phòng ban (rows 75-87) lên CONTROL**:
  - Gộp tất cả task của Technical Dept thành một tin nhắn báo cáo duy nhất và gửi lên nhóm **CONTROL SITE** sử dụng bot với chức năng tự động xóa tin nhắn cũ (`SCHEDULER_TECHDEP_CONTROL`).
- **Gửi Báo cáo Asset tổng hợp cho Từng Team + CONTROL**:
  - Chỉnh sửa `cron_send.py` để tin nhắn tổng hợp Asset (`asset_msg`) được gửi đồng thời lên nhóm **CONTROL SITE** và **tất cả 4 nhóm Team** (T1, T2, T3, T4).
  - Tích hợp chức năng tự động xóa tin nhắn Asset cũ trước khi gửi tin mới trong từng nhóm thông qua Apps Script API.
- **Tính năng Xóa Tin Cũ trên CONTROL**: Đảm bảo tất cả các báo cáo gửi lên CONTROL (gồm báo cáo EOD TLs, báo cáo Asset, báo cáo Tech Dept, báo cáo Plan và báo cáo đọc Note) đều tích hợp chức năng xóa tin nhắn cũ trước khi gửi tin mới.

### 4. Sửa lỗi bỏ qua dòng (Bug Fix)
- Sửa lỗi trong `backlog_send.py` khi bỏ qua nhầm dòng 4 và 5 của Google Sheet (làm mất thông tin của `Cable Patrol for (BB)` và `Cable Patrol for (AC)`). Giờ vòng lặp chạy từ dòng 4 (`idx < 3`).

### 5. Cập nhật Keyword Nhận Diện Daily Report của Chatbot
- **Hỗ trợ từ khóa "Result"**: Cập nhật hàm `is_daily` trong [search_bot.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/api/search_bot.py) và `is_daily_report` trong [telegram_bot.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/telegram_bot.py) để tự động nhận diện tin nhắn nộp báo cáo chứa từ khóa `"daily"` hoặc `"result"` (không phân biệt hoa thường).
- **Ánh xạ ngày báo cáo**: Cập nhật hàm `parse_daily_report` để nếu dòng tiêu đề chứa chữ `"result"` hoặc `"daily"` (ví dụ: `Daily Result: 30/06/2026`), giá trị ngày tháng sẽ tự động được gán chính xác vào cột `"Daily report"` trong dữ liệu gửi lên Google Sheet thay vì bị bỏ sót và lấy ngày hiện tại mặc định.

---

## ⚡ Lưu ý quan trọng
1. **GitHub Actions**: Do các tác vụ này được kích hoạt qua `workflow_dispatch` bởi Google Apps Script (`site_down_notify.gs`), bạn hoàn toàn có thể chạy thủ công trên GitHub UI bất cứ lúc nào bằng cách vào mục **Actions** -> Chọn Workflow tương ứng -> Chọn **Run workflow**.
2. **Triển khai Google Apps Script**: Khi chỉnh sửa xong, cần copy mã nguồn của `site_down_notify.gs` đè lên Apps Script Editor hiện tại và thực hiện Deploy Version mới để giờ gửi 20:00 Myanmar có hiệu lực.
