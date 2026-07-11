# 🗂️ Backup Context — TNI Bot System (29/06/2026)

> ⚠️ **ĐỌC FILE NÀY TRƯỚC KHI SỬA BẤT KỲ THỨ GÌ!**
> Snapshot: 29/06/2026 00:30 (Myanmar UTC+6:30)
> Conversation ID: `5d8d606f-d82b-42a8-af4b-7e6cb74ee7ca`

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

## ✅ Hoàn thành ngày 29/06/2026

### 1. Refine Consolidated Plan vs Actual Report (`daily_plan_report.py`)
- **Loại bỏ Đội trưởng khỏi danh sách FT**: Lọc bỏ các tài khoản của Đội trưởng (`Team leader 1`, `Team leader 2`...) khỏi bảng thống kê `📋 FT Plan & Actual Summary` vì đội trưởng không đi làm trạm trực tiếp giống như FT.
- **Cải tiến trạng thái Chấm tròn màu**:
  - `🟢` = Hoàn thành 100% trạm được giao hôm nay.
  - `🟡` = Hoàn thành >0% nhưng <100% trạm được giao hôm nay.
  - `🔴` = Có lịch trạm giao nhưng **chưa nộp báo cáo** (0% completed).
  - `🔵` = Không có lịch giao trạm hôm nay, nhưng **vẫn nộp báo cáo** tự do.
  - `⚫` = Không có lịch giao trạm hôm nay, và **chưa nộp báo cáo** (thay thế chấm trắng `⚪` trước đây để dễ nhìn hơn trên nền Telegram sáng).
- **Bộ lọc tin nhắn Plan của Đội trưởng**: Tự động lấy danh sách Telegram ID của các Đội trưởng từ Sheet `Task remain` và chỉ nhận tin nhắn Plan gửi từ đúng tài khoản Đội trưởng trong các nhóm, ngăn việc quét nhầm tin nhắn báo cáo kết quả của thành viên khác làm dữ liệu Plan.

### 2. Dọn dẹp mã nguồn & Tác vụ gửi tin nhắn cá nhân cũ
- **Lý do**: Trước đây có các tác vụ gửi tin nhắn báo cáo/tra cứu đến từng cá nhân (FT/TL) nhưng nay đã chuyển hẳn sang gửi vào các nhóm Telegram chung. Việc này giúp tiết kiệm hạn mức 2.000 phút chạy miễn phí của GitHub Actions.
- **Các file đã xóa hoàn toàn khỏi repository**:
  - `send_teams_telethon.yml` & `send_teams_telethon.py` (Tác vụ chạy Telethon 5 phút/lần).
  - `daily_send.yml` & `send_now.py` (Tác vụ gửi tin nhắn cá nhân).

### 3. Sửa lỗi Báo cáo Cáp (`cable_daily_report.yml`)
- Loại bỏ cấu hình sai `working-directory: Task and WO`.
- Cấu hình lại để tác vụ chạy trực tiếp tại thư mục gốc (Root) của repository trên GitHub Actions.

---

## ⚡ Lưu ý quan trọng
1. **GitHub Actions Minutes**: Sau khi xóa tác vụ chạy 5 phút/lần (`send_teams_telethon`), lượng phút tiêu thụ hàng tháng của repository sẽ chỉ còn khoảng 150 phút (nhỏ hơn rất nhiều so với hạn mức 2.000 phút miễn phí). Tài khoản sẽ hoạt động hoàn toàn miễn phí và không bao giờ bị khóa nữa.
2. **Cập nhật Tài liệu**: Đã cập nhật `system_map.md` và `PROMPT_RUNBOOK.md` để đồng bộ cấu trúc thư mục và file mới.
