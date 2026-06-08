# 🗂️ Backup Context — TNI Bot System (08/06/2026)

> Đây là snapshot trạng thái hệ thống để bắt đầu tác vụ mới.
> Đọc trước khi sửa bất kỳ thứ gì.

---

## 📍 Workspace

- **Thư mục dự án:** `d:\6. AI\1. QLTC\`
- **Main code:** `d:\6. AI\1. QLTC\Task and WO\`
- **GAS code:** `d:\6. AI\1. QLTC\QLTC_GAS\`

---

## 📊 Google Sheet

**ID:** `1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8`

| Sheet | GID | Mục đích |
|---|---|---|
| **Task remain** | `133591305` | Dữ liệu WO + chat_id nhân viên/quản lý |
| **Config** | `1236389870` | Keywords (col A), Asset recipients (col C), Authorized Done (col D) |
| **Input task** | `1755404595` | Col B=Dep, Col D=content, Col J=Done date |

### Cấu trúc Row — Task remain (ĐÃ XÁC NHẬN 07/06/2026)

| Row | Nhóm | Bot gửi |
|---|---|---|
| 1-3 | Header (row 3 = `export sms`) | — |
| **4-32** | **Nhân viên** | `SEND_BOT` ⚠️ (không phải @TNIREPORTTASK) |
| **33-55** | **Team Leaders** | `SEND_BOT` |
| 56-61 | Hàng trống | — |
| **62** | Header `Control all` | — |
| **63** | BOD (`6859790680`) | `SEND_BOT` |
| **65** | Duty Manager (`1728528589`) | `SEND_BOT` |
| **60-74** | Management (nhận mgmt_report) | `SEND_BOT` |
| **75-87** | Technical Dept | `@TNITECHINICALDEPREPORT_BOT` |

> ⚠️ **`HEADER_ROWS = 3`** — phải đọc sheet bằng `/export?format=csv` (KHÔNG dùng gviz/tq vì cắt hàng trống)

---

## 🤖 Bots

| Bot | Env var | Chức năng |
|---|---|---|
| `@TNIASSETorderREQUEST_BOT` | `COLLECTOR_BOT_TOKEN` | Thu thập Order/Revoke/Export/Move... |
| `@TNIREPORTTASK_BOT` | `REPORT_TASK_BOT_TOKEN` | ⚠️ Không dùng cho nhân viên |
| `@TNITECHINICALDEPREPORT_BOT` | `TECHNICAL_DEP_BOT_TOKEN` | Gửi cho Technical Dept (E75:E87) |
| `SEND_BOT` | `SEND_BOT_TOKEN` | Gửi TẤT CẢ: NV + TL + Mgmt + BOD |

---

## 📁 Files chính (trạng thái hiện tại)

| File | Deploy | Trạng thái |
|---|---|---|
| [cron_send.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/cron_send.py) | GitHub Actions | ✅ OK — gửi task remain 17:30 hàng ngày |
| [send_now.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/send_now.py) | GitHub Actions | ✅ OK — gửi search stats + asset stats + D75:E87 |
| [api/collector.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/api/collector.py) | Vercel | ✅ Collector bot webhook |
| [apps_script_collector.js](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/apps_script_collector.js) | Apps Script | ✅ Backend xử lý dữ liệu Sheet |
| [system_map.md](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/system_map.md) | — | ✅ Tài liệu hệ thống |

### GAS Scripts (QLTC_GAS/)
- `00_CONFIG.gs` — Cấu hình toàn cục
- `01_SETUP.gs` — Setup sheet
- `06_RECONCILIATION.gs` — Đối soát
- `09_DASHBOARD.gs` — Dashboard
- `10_ON_EDIT.gs` — Trigger on_edit

---

## 🚀 Deploy Targets

### Vercel
- **URL:** `https://tni-bot.vercel.app`
- **Env:** `COLLECTOR_BOT_TOKEN`, `APPS_SCRIPT_URL`

### GitHub Actions
- **Repo:** `phonghdpxd-cmd/tni-bot` — branch **`main`** (KHÔNG phải master!)

| Workflow | Schedule | Script |
|---|---|---|
| `daily_task.yml` | `0 11 * * *` UTC | `cron_send.py` |
| `telegram_send.yml` | `30 17 * * *` UTC (= 11:00 UTC+6:30) | `cron_send.py` |
| `send_task.yml` | `0 11 * * *` UTC | `send_now.py` |

- **GitHub Secrets:** `SEND_BOT_TOKEN`, `REPORT_TASK_BOT_TOKEN`, `TECHNICAL_DEP_BOT_TOKEN`, `APPS_SCRIPT_URL`

### Apps Script
- **URL:** `https://script.google.com/macros/s/AKfycbxJF4FJHHI93bMELdm6YgFN-Tz8tUKrwl3QXWyrQn_WzDsaoqWjZEO41TvudGyMBKo7wg/exec`
- **Actions:** `collect`, `done`, `get_asset_stats`, `get_report_data`, `refresh_general`

---

## 🐛 Bugs đã fix (07/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| Nhân viên không nhận tin | Dùng `@TNIREPORTTASK_BOT` thay vì `SEND_BOT` | Đổi rows 4-32 → `SEND_BOT` |
| BOD không nhận tin | `gviz/tq` cắt row tại hàng trống 56-61 | Đổi sang `/export?format=csv` |
| `Message is too long` rows 31,32 | Split theo `\n` không đủ | Thêm split theo số ký tự (4000 chars) |
| `APPS_SCRIPT_URL` không đọc | Chưa thêm vào GitHub Secrets | Thêm secret |

---

## ⚠️ Quy tắc quan trọng (KHÔNG được quên)

1. **Push vào branch `main`** — Actions chỉ đọc `main`
2. **Keywords** load động từ Config col A
3. **Chỉ ID trong Config col D** mới được reply Done
4. **Asset stats recipients** từ Config col C
5. **Đọc sheet = `/export?format=csv`** — KHÔNG dùng `gviz/tq`
6. **HEADER_ROWS = 3** (rows 1-3 là header)
7. **Nhân viên (4-32) = SEND_BOT** — KHÔNG dùng TNIREPORTTASK
8. **Tin nhắn > 4096 ký tự** → tự chia nhỏ theo dòng + ký tự

---

## 🔍 Logic cron_send.py (v hiện tại)

```
main():
  1. Đọc sheet Task remain (CSV export)
  2. Thu thập team_leader_content + all_rows có chat_id hợp lệ
  3. get_asset_stats() → build_asset_msg()
  4. get_report_data() → build_search_summary()
  5. Build mgmt_report (asset + search + leaders)
  6. get_input_task_summary() (Input task gid=1755404595)
  7. Group rows theo token và gửi:
     - Row 60-74 → mgmt_report
     - Row 75-87 → header + input_task_summary + col D + asset + search
     - Row 4-59 (có content) → format employee/fallback col D
```

---

## 🔍 Logic send_now.py (v hiện tại)

```
main():
  1. get_report_data() (retry 3 lần)
  2. Gửi từng nhân viên: search stats cá nhân
  3. Gửi từng đội trưởng: team search summary
  4. Gửi ban quản lý: tổng hợp search + leader content
  5. get_asset_stats() → gửi đến Config col C recipients
  6. Gửi custom messages từ D75:E87 (gviz/tq offset 74)
```

---

*Snapshot: 08/06/2026 12:27 (UTC+6:30)*
