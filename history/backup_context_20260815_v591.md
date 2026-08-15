# Backup Context — v591 — 15/08/2026 15:55 MMT

## Mô tả sự cố & Yêu cầu
1. **Sự cố màn hình đen khi bấm Thẻ `Gmail Access List` trên BI Portal (`https://tni-bot.vercel.app`)**:
   - Nút điều hướng `<button class="nav-tab" onclick="showTab('access-control-panel', this)">` gọi hiển thị `#access-control-panel`, nhưng thẻ `<div id="access-control-panel">` bị thiếu trong khối `<main>` của `index.html` và `executive_dashboard.html`.
   - JavaScript xử lý phân quyền và danh sách Gmail chưa có cơ chế lưu trữ bền vững (`localStorage`) và bộ đếm tổng hợp theo phân quyền.

## Giải pháp (Fix & Enhancement)
1. **Bổ sung đầy đủ Thẻ `#access-control-panel`**:
   - Khối thống kê 4 thẻ tóm tắt phân quyền: 🌟 **Full Access (Admin)**, 👑 **BOD Assign Only**, 🏢 **Dept Assign Only**, 📊 **Executive Only**.
   - Bảng quản lý tài khoản `#gmailListTable` với tính năng tìm kiếm tức thì `filterGmailTable()`.
   - Hộp thoại Thêm tài khoản Gmail phân quyền (`#gmailModal`) có lưu trữ tự động vào `localStorage.getItem('tni_gmail_access_list')`.
   - Nút Thu hồi quyền truy cập (Remove) và Khôi phục mặc định (Reset Defaults).
2. **Đồng bộ mã nguồn & Deploy Production**:
   - Đồng bộ `index.html` và `executive_dashboard.html` qua toàn bộ workspace (`Task and WO`, `tni-sitedown`, `tni-search`).
   - Commit & Push lên GitHub `phonghdpxd-cmd/tni-bot` $\rightarrow$ Tự động deploy tức thì lên Vercel Production `https://tni-bot.vercel.app`.

## Bảng ánh xạ Chuyến Tàu — Toa Tàu — Số Ghế
- **CHUYẾN TÀU 1: CHUYẾN TÀU SEARCH & TRA CỨU REALTIME 24/7 (SEARCH ENGINE LINE)**
- **TOA BI PORTAL (Độc Lập)**: Web Executive Dashboard & Operations Management.
- **DÃY GHẾ BI-ACCESS (Ghế BI-AUTH-1 đến BI-AUTH-4)**:
  - `Ghế BI-AUTH-1`: Navigation Tab Router (`showTab('access-control-panel')`).
  - `Ghế BI-AUTH-2`: Gmail Role-Based Permission Roster & Summary Counters.
  - `Ghế BI-AUTH-3`: LocalStorage Persistent Storage Engine & Modal Form Handler.
  - `Ghế BI-AUTH-4`: Live Instant Filter & Account Management Action Triggers.
