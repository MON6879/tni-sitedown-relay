# Backup Context — v592 — 15/08/2026 16:35 MMT

## Mô tả Cập nhật Giao diện Phân quyền Gmail BI Portal
1. **Lược bỏ trường User Name**:
   - Chỉ giữ duy nhất ô nhập **Địa chỉ Gmail (`#newGmailInput`)** theo yêu cầu người dùng.
2. **Chuyển đổi sang Checkbox Đa lựa chọn (Multi-Select Checkboxes)**:
   - Thay thế thẻ `<select>` bằng 5 ô tích vuông tương ứng với 5 Thẻ của hệ thống BI Portal:
     - ☑️ 📊 **Executive Summary** (Báo Cáo Tổng Quan & AI Audio)
     - ☑️ 🏢 **Department Assign** (Giao Việc Phòng Ban TNI)
     - ☑️ 📋 **WO Detail** (Chi Tiết 9 Bảng Work Orders & Kỹ Sư)
     - ☑️ 👑 **BOD Assign** (Chỉ Đạo & Giao Việc Ban Giám Đốc)
     - ☑️ 🔒 **Gmail Access List** (Quản Lý Phân Quyền Hệ Thống)
   - Nút thao tác nhanh `Chọn Tất Cả / Bỏ Chọn Tất Cả`.
3. **Cập nhật Bảng Roster Phân quyền**:
   - Hiển thị đầy đủ các huy hiệu (Badges) tương ứng với từng Thẻ được cấp quyền cho mỗi Gmail.
   - Lưu trữ bền vững qua `localStorage` (`tni_gmail_access_list_v2`).

## Bảng ánh xạ Chuyến Tàu — Toa Tàu — Số Ghế
- **CHUYẾN TÀU 1: CHUYẾN TÀU SEARCH & TRA CỨU REALTIME 24/7 (SEARCH ENGINE LINE)**
- **TOA BI PORTAL (Độc Lập)**: Web Executive Dashboard & Operations Management.
- **DÃY GHẾ BI-ACCESS (Ghế BI-AUTH-1 đến BI-AUTH-4)**:
  - `Ghế BI-AUTH-1`: Navigation Tab Router (`showTab('access-control-panel')`).
  - `Ghế BI-AUTH-2`: Gmail Multi-Checkbox Role Roster & Permission Badges.
  - `Ghế BI-AUTH-3`: LocalStorage Persistence Engine & Dynamic Accounts Array.
  - `Ghế BI-AUTH-4`: Instant Keyword Filter & Account Action Triggers.
