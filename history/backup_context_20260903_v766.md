# Backup Context v766 - 5 Distinct Colors for All 5 DG Material Lines in Report 3
## Date: 03/09/2026

### 1. Yêu Cầu Của Người Dùng
- Đưa đủ 5 màu tương ứng cho 5 dòng của Báo cáo 3 (Main DG Material Need) để dễ dàng phân biệt:
  1. Oil Filter: 🔵 Xanh dương
  2. Fuel Filter: 🟡 Vàng
  3. Air Filter: 🟢 Xanh lá
  4. Oil: 🟠 Cam
  5. Water Coolant: 🟣 Tím

### 2. Triển Khai Kỹ Thuật
- Cập nhật hàm format_blue_dots trong backlog_send.py:
  + Dòng 1 (Oil Filter): format_blue_dots(sd['oil_filter'], '🔵')
  + Dòng 2 (Fuel Filter): format_blue_dots(sd['fuel_filter'], '🟡')
  + Dòng 3 (Air Filter): format_blue_dots(sd['air_filter'], '🟢')
  + Dòng 4 (Oil): format_blue_dots(sd['oil'], '🟠')
  + Dòng 5 (Coolant): format_blue_dots(sd['coolant'], '🟣')
- Đồng bộ hóa và push lên cả 3 repositories:
  + tni-sitedown (commit 7c5fa50)
  + Task and WO (commit 729ce8d)
  + tni-search (commit 81a2144)