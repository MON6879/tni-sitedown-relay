# Backup Context — v593 — 15/08/2026 16:38 MMT

## Mô tả Tính năng Phân Quyền Hàng Loạt & Copy Gmail Theo Từng Nhóm
1. **Dán Hàng Loạt Gmail Cùng Lúc (Bulk Paste)**:
   - Thay thế ô nhập đơn lẻ bằng `<textarea>` cho phép dán danh sách hàng chục/hàng trăm Gmail cùng lúc (tự động bóc tách email qua regex, hỗ trợ phân tách bằng dấu xuống dòng Enter, dấu phẩy, chấm phẩy, khoảng trắng).
   - Tự động lọc trùng (De-duplication) và cập nhật/thêm mới toàn bộ tài khoản chỉ với 1 cú click `Lưu & Phân Quyền Hàng Loạt`.
2. **Mẫu Phân Quyền Nhanh theo Nhóm (Group Presets)**:
   - Nút chọn 1 chạm: 🌟 **Full Access**, 👑 **Nhóm BOD**, 🏢 **Nhóm Trưởng Phòng**, 👷 **Nhóm Kỹ Sư**, 📊 **Nhóm Báo Cáo**.
3. **Sao Chép Danh Sách Gmail Theo Từng Nhóm (Copy Group Emails)**:
   - Bổ sung nút `📋 Copy Gmail Nhóm` trực tiếp trên từng Thẻ thống kê nhóm quyền (Full Access, BOD, Dept, Exec) và nút `📋 Copy Tất Cả Gmail` trên đầu bảng danh sách để dán trực tiếp vào Excel, Sheet, Telegram hoặc gửi email hàng loạt.

## Bảng ánh xạ Chuyến Tàu — Toa Tàu — Số Ghế
- **CHUYẾN TÀU 1: CHUYẾN TÀU SEARCH & TRA CỨU REALTIME 24/7 (SEARCH ENGINE LINE)**
- **TOA BI PORTAL (Độc Lập)**: Web Executive Dashboard & Operations Management.
- **DÃY GHẾ BI-ACCESS (Ghế BI-AUTH-1 đến BI-AUTH-5)**:
  - `Ghế BI-AUTH-1`: Navigation Tab Router (`showTab('access-control-panel')`).
  - `Ghế BI-AUTH-2`: Gmail Multi-Checkbox Role Roster & Permission Badges.
  - `Ghế BI-AUTH-3`: Bulk Regex Email Parser & Batch LocalStorage Storage Engine.
  - `Ghế BI-AUTH-4`: Quick Permission Group Presets (`applyPermissionPreset`).
  - `Ghế BI-AUTH-5`: 1-Click Clipboard Group Exporter (`copyGroupEmails`).
