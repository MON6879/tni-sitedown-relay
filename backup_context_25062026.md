# 🗂️ Backup Context — TNI Bot System (25/06/2026)

> ⚠️ **ĐỌC FILE NÀY TRƯỚC KHI SỬA BẤT KỲ THỨ GÌ!**
> Snapshot: 25/06/2026 18:52 (Myanmar UTC+6:30)
> Conversation ID: `e9567aec-e661-44e2-87f1-7712b93f6560`

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

## ✅ Hoàn thành ngày 25/06/2026

### 1. Inventory Fuel Collector — Hoàn thành ✅

**Mô tả:** Thêm chức năng thu thập dữ liệu "Inventory Fuel" vào cùng group MDG ("6. TNI COLLECT MDG RUN + INVENTORY FUEL REMAIN").

**Files đã sửa:**

#### `apps_script_mdg.js`
- Thêm constants: `INV_DATA_TAB = "Inventory Main DG"`, `INV_PHOTO_DIR = "2.8 INVENTORY FUEL MAIN DG"`
- Thêm `ICOL` column map (27 cột, 12 photo cols P→AA)
- Thêm hàm `invAdd()` — ghi dữ liệu Inventory vào sheet
- Thêm hàm `invConfirm()` — đánh dấu confirm
- Thay `mdgAddPhoto()` bằng `processPhoto(body, modeStr)` — hỗ trợ AUTO/MDG/INV detect theo Sender ID + 30 phút timeout
- Thêm `getInvSheet_()`, `ensureInvHeaders_()`, `getInvFolder_()`

#### `apps_script_collector.js` (Router chính)
- **BUG FIX QUAN TRỌNG:** Thêm `inv_add`, `inv_confirm`, `inv_add_photo`, `process_photo` vào `doPost(e)` router để chuyển sang `doPostMdg_(e)`
- ⚠️ Nếu thêm action mới cho MDG/INV, **PHẢI** thêm vào router trong file này!

#### `api/collector.py`
- Thêm `INV_FIELDS_LIST` và `parse_inv_fields()` — tự strip đơn vị từ các field số (fuel cm, fuel %, fuel level, kwh, rh)
- Thêm logic detect `"inventory fuel"` trong text → gọi `inv_add`
- Photo routing: dùng `process_photo` (GAS tự detect MDG hay INV)
- Confirm reply: detect `"INVENTORY"` → gọi `inv_confirm`

### 2. Thay đổi ENV quan trọng

- **`MDG_APPS_SCRIPT_URL`** trên Vercel đã được đổi sang deployment chung:
  ```
  CŨ: AKfycbyjTpelRYx1y1g8meYwDZ_3_UBgca1LJq5lV5XN1lvLA0YycdhSpvTzZIT57W1t2QDy
  MỚI: AKfycbzvQrwvk7N0bc2Bh-lZEnLxRE6Lx8NE4xffUmZJSkUg4EdquSKYPg9VfD1VXTfkim2gFg
  ```
- Cả `APPS_SCRIPT_URL` và `MDG_APPS_SCRIPT_URL` giờ trỏ về **cùng 1 deployment** (tất cả đi qua router `doPost()` trong `apps_script_collector.js`)

---

## 🏗️ Kiến trúc hiện tại

### GAS Routing Flow
```
Python (Vercel) → POST to GAS URL
                     ↓
              doPost(e) [apps_script_collector.js]
                     ↓ (dựa theo body.action)
    ┌────────────────┼────────────────────────┐
    ↓                ↓                        ↓
doPostDaily_()   doPostCable_()         doPostMdg_()
                                             ↓
                                   ┌─────────┼──────────┐
                                   ↓         ↓          ↓
                               mdgAdd()   invAdd()  processPhoto()
                               mdgConfirm() invConfirm()
```

### Action → Router mapping
| Action | Router | Handler |
|--------|--------|---------|
| `mdg_add` | `doPostMdg_()` | `mdgAdd()` |
| `mdg_confirm` | `doPostMdg_()` | `mdgConfirm()` |
| `mdg_add_photo` | `doPostMdg_()` | `processPhoto(body,"MDG")` |
| `mdg_get_stats` | `doPostMdg_()` | `mdgGetStats()` |
| `inv_add` | `doPostMdg_()` | `invAdd()` |
| `inv_confirm` | `doPostMdg_()` | `invConfirm()` |
| `inv_add_photo` | `doPostMdg_()` | `processPhoto(body,"INV")` |
| `process_photo` | `doPostMdg_()` | `processPhoto(body,"AUTO")` |

---

## ⚡ Lưu ý quan trọng

1. **Router `apps_script_collector.js`**: Mọi action mới PHẢI được thêm vào `doPost(e)` trong file này. Nếu không, sẽ bị "Unknown action".
2. **GAS Deploy**: Sau khi `clasp push`, PHẢI vào GAS Editor → Deploy → Manage Deployments → New Version → Deploy. Nếu không, Web App vẫn chạy code cũ.
3. **Vercel ENV**: `MDG_APPS_SCRIPT_URL` đã đổi sang cùng URL với `APPS_SCRIPT_URL`. Cả 2 đều dùng chung 1 GAS deployment.
4. **Clasp push:** `npx clasp push --force` để upload toàn bộ `*.js` / `*.gs` lên Apps Script.
5. **Namespace:** Tất cả hàm trong project GAS chia sẻ chung namespace. KHÔNG đặt tên trùng.
6. **Numeric fields:** `parse_inv_fields()` tự động strip đơn vị cho fuel cm, fuel %, fuel level, kwh, rh.

---

## 📊 Google Sheet: "Inventory Main DG"

| Cột | Header | Nội dung |
|-----|--------|----------|
| A | REF | Auto-generated (00001, 00002...) |
| B | Confirm Complete | ✅ + tên + ngày |
| C | Recorded Date | dd/mm/yyyy |
| D | Recorded Time | HH:MM |
| E | Inventory Fuel | Ngày báo cáo |
| F | DG ID | Mã DG |
| G | Fuel Cm | Số (stripped units) |
| H | Fuel % | Số (stripped units) |
| I | Fuel Level | Số (stripped units) |
| J | KWh | Số (stripped units) |
| K | RH | Số (stripped units) |
| L | Note | Text tự do |
| M | Sender Name | Tên Telegram |
| N | Sender ID | ID Telegram |
| O | Raw Content | Nội dung gốc |
| P-AA | Photo 1-12 | HYPERLINK đến Google Drive |
