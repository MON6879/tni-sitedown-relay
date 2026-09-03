# Backup Context v765 - Support Part Codes in Filters & Change Oil/Coolant Dots to Orange 🟠
## Date: 03/09/2026

### 1. Yêu Cầu Của Người Dùng
- Người dùng đã thêm mã vật tư (part numbers) vào các ô trên Google Sheet:
  + Cột AT (Oil Filter): '(HH160-32093 +  + ) = 8KVA: /9 <+> (HH164-32430) = 12KVA: /3 <+> (129150-35153 + HH160-32093 + HH160-32093 + ) = 30KVA: /0 <+> (HH164-32430) = 12DKVA: /2'
  + Cột BI (Fuel Filter): '(15221-43171 + ) = 8KVA: /9 <+> (16631-43562) = 12KVA: /3 <+> (119802-55801 + 15221-43171) = 30KVA: /1 <+> (16631-43562) = 12DKVA: /2'
  + Cột BX (Air Filter): '( + ) = 8KVA: /4 <+> (5606-1108-1) = 12KVA: /2 <+> (129935-12520 + ) = 30KVA: /1 <+> (5606-1108-1) = 12DKVA: /1'
- Đổi các chấm xanh dương ở đoạn Nhớt (Oil) và Nước làm mát (Coolant) sang chấm cam 🟠 để dễ phân biệt:
  🛢️ Sum DG KVA Need change Oil:
    🟠 8KVA: 12 <+> 🟠 12KVA: 2 <+> 30KVA: 0 <+> 🟠 12DKVA: 2
    👉 Sum Need: 101.2 L | Have at Team: 86 L | Diff: -15.2 L
  ❄️ Sum DG KVA Need change water Coolant:
    🟠 8KVA: 1 <+> 🟠 12KVA: 1 <+> 30KVA: 0 <+> 12DKVA: 0
    👉 Sum Need: 1.3 L | Have at Team: 130 L | Diff: 128.7 L

### 2. Xử Lý Kỹ Thuật
1. Cập nhật hàm format_blue_dots:
   - Dùng re.search(r'[-+]?\d*\.?\d+', v) để bóc tách số liệu kể cả khi có tiền tố gạch chéo '/9' hay văn bản phía trước.
   - Thêm tham số dot_char: mặc định '🔵' cho các bộ lọc, truyền '🟠' cho Nhớt và Nước làm mát.
   - Mục có số lượng = 0 thì không gán chấm.
2. Đồng bộ và push lên cả 3 repositories:
   - tni-sitedown (commit 5600ee8)
   - Task and WO (commit 49c99af)
   - tni-search (commit 93cfec6)