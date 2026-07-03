# Backup Context — 03/07/2026

## Tóm tắt thay đổi hôm nay

### 1. `cron_send.py` — Điều kiện lọc 2 cột (rows 4-59)
**Yêu cầu:** Bắt buộc Cột A ≠ trống VÀ Cột D ≠ trống mới gởi.

**Quy tắc routing đã xác nhận:**
- Row 4-32 (Nhân viên): xác định team từ **Cột A**
- Row 33-59 (Team Leader): xác định team từ số trong **Cột C** (`Team leader 1/2/3/4`)
- Cả hai: bắt buộc Cột A ≠ trống VÀ Cột D ≠ trống

**Code sau khi sửa (rows 4-59):**
```python
if 4 <= sheet_row <= 59:
    if not col_a_val:   # Cột A trống → skip
        continue
    if not content:     # Cột D trống → skip
        continue

    is_tl = 33 <= sheet_row <= 59 and bool(col_c and "team leader" in col_c.lower())

    if is_tl:
        # TL: dùng số trong Cột C để xác định team
        m_tl = re.search(r'team\s*leader\s*(\d+)', col_c, re.IGNORECASE)
        tl_num = int(m_tl.group(1)) if m_tl else 0
        team_val = TEAM_BY_NUMBER.get(tl_num, col_a_val)
    else:
        # NV: dùng Cột A
        team_val = col_a_val
```

**Lỗi đã sửa:**
- Lần 1: Xóa exception cho team leader bypass cột A (đúng)
- Lần 2: Phát hiện TL không hiện trong báo cáo → khôi phục logic đọc số team từ cột C

---

### 2. `.github/workflows/daily_reports.yml` — Cron tự động 17:00 Myanmar

**Thay đổi:**
- Thêm cron `30 10 * * *` UTC = 17:00 Myanmar cho `daily_task` (cron_send.py + backlog_send.py)
- Tách riêng: `0 11 * * *` UTC = 17:30 Myanmar chỉ cho `cable_report`
- Trước đây `daily_task` chỉ chạy thủ công (workflow_dispatch)

---

### 3. `SYSTEM_DOC.md` — Cập nhật giờ
- cron_send.py: 17:30 Myanmar → **17:00 Myanmar** (10:30 UTC)

---

### Commits hôm nay
1. `521cd66` — fix: strict col A+D filter; auto cron daily_task 17:00 Myanmar
2. `c5f5e48` — docs: add mandatory backup+freeze rules and changelog to system_map
3. `b272be6` — fix: restore col C team routing for TL rows 33-59
