# Backup Context — v590 — 15/08/2026 15:40 MMT

## Mô tả sự cố & Nguyên nhân (Root Cause)
1. **Sự cố tra cứu Clear Site History (`Clear TNIxxxx` / `/clear TNIxxxx`) chỉ ra 3 dòng**:
   - Trong Google Sheet `Search Site Clear` (GID `610944071`), Hàng 1 là `Manage Staff Township`, Hàng 2 là `Team`, Hàng 3 là mã trạm & `Status`. Từ Hàng 4 trở đi (các dòng lịch sử clear, mốc thời gian, trạng thái Door/New/Clear...), **Cột A để trống** (`label == "nan"`).
   - Hàm `lookup_clear_site` cũ trong `search_bot.py` có điều kiện `if label and label.lower() != "nan": lines.append(...)`, dẫn đến việc **bỏ qua 100% tất cả các dòng lịch sử từ Hàng 4 đến Hàng 586**.

## Giải pháp (Fix & Deployment)
1. **Cập nhật hàm `lookup_clear_site(tni)` trong `search_bot.py` & Cloudflare Worker `worker.js`**:
   - Khi `label` có chữ (Hàng 1, 2, 3): Trích xuất vào khối thông tin Header (`Manage Staff Township`, `Team`, `Status`).
   - Khi `label` trống/nan (Hàng 4 trở đi): Tự động trích xuất toàn bộ các dòng lịch sử clear trạm vào khối `📜 History Records:`.
   - Bổ sung giới hạn an toàn 3800 ký tự (tránh vượt ngưỡng 4096 ký tự của Telegram) kèm nhãn `... (more older records truncated)`.
2. **Deploy lên Production**:
   - Commit & Push lên GitHub `phonghdpxd-cmd/tni-bot` $\rightarrow$ Tự động deploy tức thì lên Vercel Serverless Endpoint `https://tni-bot.vercel.app/api/search_bot`.

## Bảng ánh xạ Chuyến Tàu — Toa Tàu — Số Ghế
- **CHUYẾN TÀU 1: CHUYẾN TÀU SEARCH & TRA CỨU REALTIME 24/7 (SEARCH ENGINE LINE)**
- **TOA 5: 🧹 CLEAR SITE HISTORY SEARCH**
- **DÃY GHẾ A (Đơn lẻ)**:
  - `Ghế 5A`: Quét dòng tiêu đề tìm cột trạm (Header Scan Col Index).
  - `Ghế 5B`: Trích xuất thông tin nhân sự, trạm, và toàn bộ danh sách `📜 History Records` từ các hàng bên dưới.
