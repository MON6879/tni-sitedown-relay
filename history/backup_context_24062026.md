# 🗂️ Backup Context — TNI Bot System (24/06/2026)

> ⚠️ **ĐỌC FILE NÀY TRƯỚC KHI SỬA BẤT KỲ THỨ GÌ!**
> Snapshot: 24/06/2026 10:04 (Myanmar UTC+6:30)
> Conversation ID: `440c0dbb-2b9e-4cf6-b2cf-410cd881872f`

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

## 🐛 Kiến trúc mới & Bug đã fix (24/06/2026)

### 1. Nâng cấp Photo Upload (apps_script_collector.js & api/collector.py)
- **Tăng giới hạn ảnh:** Từ 6 ảnh (Col F-K) lên **tối đa 12 ảnh** (Col F-Q).
- **Hỗ trợ Base64:** Apps Script giờ đây có thể nhận `photo_b64` (được Python tự động download và chuyển sang Base64) thay vì chỉ nhận `tg_url` như trước. Điều này giúp loại bỏ triệt để lỗi 404/401 khi GAS cố gắng tải file từ Telegram URL.
- **Folder lưu ảnh:** Đã gán cứng `FOLDER_ID` (`1yvTYN5Dmjh-6QGjjNTwVb43CpzXVIpH6`) để tối ưu hiệu suất, dự phòng logic fallback nếu ID bị lỗi.

### 2. Gộp Google Apps Script & Định tuyến (Routing)
- Thay vì để `apps_script_cable.js`, `apps_script_mdg.js`, `daily_report_collector.gs` hoạt động như các Web App độc lập, tất cả đã được **GỘP VÀO CHUNG MỘT PROJECT**.
- File `apps_script_collector.js` trở thành Router chính:
  - Tất cả POST requests vào `doPost(e)`
  - Dựa theo `body.action`, hệ thống điều hướng sang `doPostDaily_(e)`, `doPostCable_(e)`, `doPostMdg_(e)`.
- **Đổi tên bot token:** `TG_BOT_TOKEN` trong cable và mdg được đổi thành `CABLE_BOT_TOKEN` và `MDG_BOT_TOKEN` tương ứng để dễ nhận diện và tránh nhầm lẫn.

### 3. Xử lý Trùng lặp Namespace (Namespace Collision)
- Vì toàn bộ các file được compile chung một Project, **tất cả hàm và biến toàn cục cùng chia sẻ chung một Namespace**.
- Hàm `json_()` trong `apps_script_cable.js` và `apps_script_mdg.js` bị trùng lặp, gây xung đột.
- **Fix:** Đã sử dụng hàm `json()` mặc định trong `apps_script_collector.js` và xóa toàn bộ các định nghĩa trùng lặp ở những file khác.
- Đã chạy Python script quét kiểm tra toàn bộ workspace và xác nhận **KHÔNG CÒN TRÙNG LẶP** Hàm hay Biến Global nào gây lỗi compile trên GAS.

---

## ⚡ Lưu ý quan trọng

1. **Clasp push:** Khi thêm chức năng mới, luôn chạy `npx clasp push --force` để upload toàn bộ các file (`*.js` / `*.gs`) lên Apps Script.
2. **Namespace:** BẤT KỲ hàm mới nào được viết ra trong một file sẽ "nhìn thấy" được từ các file khác. Hãy cẩn thận **KHÔNG ĐẶT TÊN TRÙNG LẶP**. Sử dụng tiền tố hoặc hậu tố (VD: `_`) cho các hàm private.
3. **Quản lý file:** GitHub Actions chỉ tự động triển khai mã Python/Node lên Vercel/VPS. Mã GAS cần được cập nhật tay qua `clasp push` hoặc deploy trực tiếp trên Editor.
