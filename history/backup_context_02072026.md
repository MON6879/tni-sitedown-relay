# 🗂️ Backup Context — TNI Bot System (02/07/2026)

> ⚠️ **ĐỌC FILE NÀY TRƯỚC KHI SỬA BẤT KỲ THỨ GÌ!**
> Snapshot: 02/07/2026 12:30 (Myanmar UTC+6:30)
> Conversation ID: `569355fe-cbab-463d-a01f-9eeaed9cae49`

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

## ✅ Hoàn thành ngày 02/07/2026

### 1. Sửa lỗi tin nhắn Asset bị gửi trùng 2 lần ở nhóm CONTROL
- **File sửa:** [cron_send.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/cron_send.py)
- **Thay đổi:**
  - Loại bỏ `"CRON_ASSET_CONTROL"` khỏi `ASSET_RECIPIENTS` để không gửi báo cáo Asset đơn lẻ vào CONTROL nữa (do CONTROL đã nhận báo cáo này tích hợp ở cuối tin nhắn "4. Report").
  - Thêm cơ chế tự động xóa tin nhắn Asset cũ lẻ loi bằng cách gọi `delete_old_messages_bot(SEND_BOT_TOKEN, -5251698940, APPS_SCRIPT_URL, "CRON_ASSET_CONTROL")` ngay đầu Mục 8.

### 2. Gộp tin nhắn nhắc việc cá nhân thành Báo cáo nhóm gửi lên CONTROL
- **File sửa:** [combined_bot.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/combined_bot.py)
- **Thay đổi:**
  - Chuyển `SHEET_URL` sang format `/export?format=csv` (thay vì `gviz/tq` bị bỏ qua hàng trống làm lệch chỉ số dòng) và đổi `HEADER_ROWS = 3`.
  - Loại bỏ hoàn toàn logic gửi tin nhắn cá nhân đến từng người cho tất cả các dải hàng.
  - Thu thập tất cả các dòng task từ sheet Task remain (không lọc bỏ qua các dòng thiếu Telegram Chat ID do cá nhân hóa đã dừng) và phân loại thành 3 nhóm báo cáo gộp gửi vào CONTROL (`-5251698940`):
    - `📋 1. Report — Technical Dept Task Progress` (Technical Dept dòng 75-87, key: `SCHEDULER_TECHDEP_CONTROL`)
    - `📋 3. Report — Employees Task Progress` (Employees dòng 4-32, key: `SCHEDULER_EMP_CONTROL`)
    - `📋 7. Report — Management Task Progress` (Management dòng 33-74, key: `SCHEDULER_MGMT_CONTROL`)
  - Tất cả các báo cáo này đều sử dụng bot `SEND_BOT_TOKEN` để gửi và đều tích hợp cơ chế xóa tin nhắn cũ trước khi gửi mới.
  - Viết thêm hàm bổ trợ `send_msg` để tự động chia nhỏ tin nhắn khi vượt quá giới hạn 4000 ký tự của Telegram, có hỗ trợ cơ chế retry 3 lần và timeout 20s để hạn chế lỗi nghẽn/timeout mạng.

### 3. Sửa lỗi lọc Technical Dept trong `cron_send.py`
- **File sửa:** [cron_send.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/cron_send.py)
- **Thay đổi:** Cập nhật điều kiện bỏ qua dòng ở `cron_send.py` để dòng trong dải `75 <= sheet_row <= 87` luôn được thu thập và gộp báo cáo gửi lên CONTROL kể cả khi cột Chat ID trong sheet bị bỏ trống.

---

## 🚀 Cách Test và Vận Hành

- Chạy cục bộ `cron_send.py` để test báo cáo tổng hợp và asset:
  ```bash
  python cron_send.py
  ```
- Chạy cục bộ `combined_bot.py` qua file test trung gian để test báo cáo gộp nhắc việc 17:00 Myanmar:
  ```bash
  python test_combined_bot.py
  ```
