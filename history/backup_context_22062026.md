# 🗂️ Backup Context — TNI Bot System (22/06/2026)

> ⚠️ **ĐỌC FILE NÀY TRƯỚC KHI SỬA BẤT KỲ THỨ GÌ!**
> Snapshot: 22/06/2026 18:24 (Myanmar UTC+6:30)
> Conversation ID: `128e178c-fb29-410d-85f5-8938381b3422`

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

## 🐛 Bug đã fix hôm nay (22/06/2026)

### Nhân viên (rows 4-32) nhận tin thiếu Detail

**Triệu chứng:** Nhân viên chỉ nhận 4 dòng tóm tắt, thiếu toàn bộ phần Detail:
- Cell Down
- DG Abnormal
- Smoke
- Open Door / Battery Door
- Site need refuel
- Danh sách site (TNI0271, TNI0245...)
- Danh sách WO (TNI0065, TNI0067...)

**Nguyên nhân:** `cron_send.py` line 694-706 — khi Apps Script match employee (`emp_match` found + `month_days > 0`), code dùng `format_employee_report()` chỉ tạo 4 dòng tóm tắt từ dữ liệu số (name, rank, close%, WO remain, dep stats). Toàn bộ nội dung Col D bị thay thế, mất hết phần Detail.

**Fix:** Bỏ `format_employee_report()` cho employee rows (4-32). Luôn dùng Col D content đầy đủ. Hàm `send_msg()` đã có sẵn logic tự split tin > 4000 ký tự.

**Commits:**
- `c210ead` — fix: employee rows always use full Col D content (include Detail section)
- `9ff358d` — docs: update system_map - bug fix 22/06/2026

---

## 📊 Kiến trúc hiện tại (tóm tắt)

### Cron 17:30 Myanmar (`cron_send.py` via GitHub Actions)

| Rows | Nhóm | Bot | Nội dung |
|---|---|---|---|
| 4-32 | Nhân viên | `SEND_BOT` | Col D đầy đủ (bao gồm Detail) |
| 33-55 | Team Leaders | `SEND_BOT` | TL report + từng NV riêng lẻ |
| 60-74 | Management | `SEND_BOT` | mgmt_report (TL summary + Asset) |
| 75-87 | Technical Dept | `TECHNICAL_DEP_BOT` | Input Task + Col D + Asset + Search |

### Gửi thêm vào Groups

| Group | Chat ID | Bot |
|---|---|---|
| T1 Dawei | -5180992881 | SEND_BOT |
| T2 Myeik | -5188855349 | SEND_BOT |
| T3 Bokpyin | -5183480727 | SEND_BOT |
| T4 Kawthoung | -5238696719 | SEND_BOT |
| CONTROL SITE | -5251698940 | TECHNICAL_DEP_BOT |

### Bots

| Bot | Token env | Chức năng |
|---|---|---|
| `SEND_BOT` | `SEND_BOT_TOKEN` | Gửi cho NV + TL + Management + Groups T1-T4 |
| `@TNITECHINICALDEPREPORT_BOT` | `TECHNICAL_DEP_BOT_TOKEN` | Gửi cho Technical Dept + CONTROL SITE |
| `@TNIASSETorderREQUEST_BOT` | `COLLECTOR_BOT_TOKEN` | Thu thập Order/Revoke (Vercel webhook) |
| `@SEARCHTNITASKWOBOT` | `TELEGRAM_TOKEN` | Tra cứu TNI (Vercel webhook 24/7) |

### Deploy

| Platform | Chức năng |
|---|---|
| **GitHub Actions** | Cron jobs: `cron_send.py` (17:30), `send_now.py` (17:00), `botlookup_relay.py` (30p/lần) |
| **Vercel** | Webhook bots: collector + search (24/7) |
| **Apps Script** | Data processing + Site Down notify (5p/lần) |

---

## ⚡ Lưu ý quan trọng

1. **Push vào branch `main`** — GitHub Actions chỉ đọc `main`
2. **Sheet đọc bằng `/export?format=csv`** — KHÔNG dùng gviz/tq (gviz bỏ hàng trống → lệch row)
3. **HEADER_ROWS = 3** — rows 1-3 là header
4. **Nhân viên rows 4-32 dùng `SEND_BOT`** — KHÔNG dùng `@TNIREPORTTASK_BOT` (họ chưa /start)
5. **Tin > 4096 ký tự** → `send_msg()` tự split (chunk 4000 chars)
6. **`format_employee_report()` KHÔNG dùng cho nhân viên** — chỉ dùng cho TL report (nếu cần)
7. **UTC↔Myanmar:** Myanmar = UTC+6:30 (cron `0 11 * * *` UTC = 17:30 Myanmar)
