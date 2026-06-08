# 🗺️ TNI Bot System Map

> [!IMPORTANT]
> **Đọc file này TRƯỚC khi sửa bất kỳ thứ gì!**

---

## 📊 Google Sheet
**ID:** `1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8`

### Sheet tabs

| Sheet | GID | Mục đích |
|---|---|---|
| **Task remain** | `133591305` | Dữ liệu WO + chat_id nhân viên/quản lý |
| **Config** | `1236389870` | Keywords (col A), Chat ID authorized (col D), Asset recipients (col C) |
| **Data** | DATA_TAB | Collector bot lưu tin nhắn Order/Revoke/Export... |
| **Input task** | `1755404595` | Nội dung task cho E75:E87. Col B=Dep, Col D=content, Col J=Done date |

### Task remain — Cấu trúc row (ĐÃ XÁC NHẬN từ screenshot 07/06/2026)

| Row | Nhóm | Col C | Col D | Col E | Bot gửi |
|---|---|---|---|---|---|
| 1-2 | Header | — | — | — | — |
| 3 | — | `export sms` | — | — | — |
| **4-32** | **Nhân viên** | Tên hệ thống | Nội dung WO chi tiết | **Telegram ID** | `SEND_BOT` ⚠️ (nhân viên đã start SEND_BOT, không phải @TNIREPORTTASK) |
| **33-55** | **Team Leaders** | `Team leader 1-4` | Báo cáo team | **Telegram ID** | `SEND_BOT` |
| 56-61 | *(Hàng trống)* | — | — | — | — |
| 62 | Header | `Control all` | — | — | — |
| **63** | **BOD** | `BOD` | — | `6859790680` | `SEND_BOT` |
| 64 | Manager | `Manager` | — | *(trống)* | — |
| **65** | **Duty Manager** | `Duty Manger` | — | `1728528589` | `SEND_BOT` |
| 66-69 | *(Trống hoặc dept)* | — | — | — | — |
| 70+ | Departments... | Finance/M&E/PM... | — | — | — |
| **75-87** | **Technical Dept** | Department names | Nội dung từ Input task | **Telegram ID** | `@TNITECHINICALDEPREPORT_BOT` |

### Row 60-74 (Management) nhận:
1. 📦 Asset stats (Order/Revoke/Export... per team) + 3Day/7Day/Month
2. 🔍 Search stats per team + 3Day/7Day/Month  
3. 👑 Team Leader reports (col D truncated)

> **Ghi chú quan trọng**: Code đọc row 60-74 và gửi `mgmt_report` cho bất kỳ cid hợp lệ nào trong vùng này (kể cả cột D trống). BOD ở row 63 sẽ nhận báo cáo tổng hợp.

### Row 75-87 (Technical Dept) nhận:
1. 📋 Header cố định + Input task summary theo Dep (Done/Total/Remain từ gid=1755404595)
2. 📝 Col D content **đã chèn dòng tổng** (Total/3day/7day/Month) ngay sau mỗi section header (vd: "CM 06/06/2026")
3. 📦 Asset stats + 3Day/7Day/Month
4. 🔍 Search stats + 3Day/7Day/Month

> **Format dòng tổng tự động chèn:**
> ```
> CM 06/06/2026
> 📊 Tổng: Total:61 | 3day:0/0/0 | 7day:0 | Month:0  ← tự động
> Team 01
> Request Export material : total : 28  Progress 3 day: 0/0/0, 7 day: 0, Month: 0
> ...
> ```

---

## 🤖 Bots

| Bot | Token env var | Token | Chức năng |
|---|---|---|---|
| `@TNIASSETorderREQUEST_BOT` | `COLLECTOR_BOT_TOKEN` | `8928677923:AAE_...` | Thu thập Order/Revoke/Export/Move/Asset Sent/Destroys |
| `@TNIREPORTTASK_BOT` | `REPORT_TASK_BOT_TOKEN` | `8646913750:AAG3...` | ⚠️ Không dùng nữa cho nhân viên (nhân viên chưa start bot này) |
| `@TNITECHINICALDEPREPORT_BOT` | `TECHNICAL_DEP_BOT_TOKEN` | `8928677923:AAE_...` | Gửi cho Technical Dept (E75:E87) |
| `SEND_BOT` | `SEND_BOT_TOKEN` | `8897800070:AAHc...` | Gửi cho **TẤT CẢ**: Nhân viên + Team Leaders + Management + BOD |

---

## 📁 Files chính

| File | Deploy | Chức năng |
|---|---|---|
| [collector.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/api/collector.py) | **Vercel** | Bot thu thập — webhook, lưu Order/Revoke... vào Sheet |
| [cron_send.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/cron_send.py) | **GitHub Actions** | Gửi task remain hàng ngày 17:30 — dùng SEND_BOT cho tất cả |
| [send_now.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/send_now.py) | **GitHub Actions** | Gửi search stats + asset stats + D75:E87 custom |
| [combined_bot.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/combined_bot.py) | **Render** (nếu dùng) | Scheduler 24/7 (thay thế bởi cron_send.py) |
| [apps_script_collector.js](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/apps_script_collector.js) | **Apps Script** | Backend xử lý dữ liệu Sheet |

---

## 🚀 Deploy targets

### Vercel (Collector Bot)
- **URL:** `https://tni-bot.vercel.app`
- **Deploy:** `npx -y vercel --prod --yes`
- **Files:** `api/collector.py`
- **Env vars trên Vercel:**
  - `COLLECTOR_BOT_TOKEN`
  - `APPS_SCRIPT_URL`

### GitHub Actions (Scheduled sending)
- **Repo:** `phonghdpxd-cmd/tni-bot`
- **Branch:** `main` (⚠️ KHÔNG PHẢI master!)

| Workflow | File | Schedule | Script |
|---|---|---|---|
| Daily Task Reminder (17:30 Myanmar) | `daily_task.yml` | `0 11 * * *` (UTC) | `cron_send.py` |
| Gửi thông báo task lúc 17:30 VN | `send_task.yml` | `0 11 * * *` (UTC) | `send_now.py` |
| **Telegram Daily Send** | `telegram_send.yml` | `30 17 * * *` (UTC+7→10:30 UTC) | `cron_send.py` |

- **Secrets trên GitHub:**
  - `SEND_BOT_TOKEN`
  - `REPORT_TASK_BOT_TOKEN`
  - `TECHNICAL_DEP_BOT_TOKEN`
  - `APPS_SCRIPT_URL`

### Apps Script
- **URL:** `https://script.google.com/macros/s/AKfycbxJF4FJHHI93bMELdm6YgFN-Tz8tUKrwl3QXWyrQn_WzDsaoqWjZEO41TvudGyMBKo7wg/exec`
- **Actions:** `collect`, `done`, `get_asset_stats`, `get_report_data`, `refresh_general`

---

## 📋 Config Sheet (GID: 1236389870)

| Cột | Nội dung | Ví dụ |
|---|---|---|
| **A** | Keywords (trước dấu `:`) | `Order:`, `Revoke:`, `Export:`, `Move:`, `Asset Sent:`, `Destroys:` |
| **C** | Telegram ID nhận Asset stats | `6859790680`, `1728528589`... |
| **D** | Telegram ID được phép reply Done | `6859790680`, `1728528589`... |

---

## ⚠️ Quy tắc quan trọng

1. **Push vào branch `main`** — GitHub Actions chỉ đọc `main`
2. **Collector keywords** load động từ Config col A — thêm keyword mới chỉ cần sửa sheet
3. **Chỉ ID trong Config col D** mới được reply Done
4. **Asset stats recipients** lấy từ Config col C
5. **Row mapping**: đọc sheet PHẢI dùng `/export?format=csv` (KHÔNG dùng gviz/tq vì gviz/tq bỏ hàng trống khiến rows 56-61 trống cắt mất rows 63+ của Management)
6. **HEADER_ROWS = 3** — rows 1, 2, 3 là header (row 3 có `export sms`)
7. **Nhân viên (rows 4-32)** dùng `SEND_BOT` vì họ đã `/start` SEND_BOT — KHÔNG dùng `@TNIREPORTTASK_BOT`
8. **Tin nhắn >4096 ký tự**: tự chia nhỏ gửi nhiều message (chunk by line + by char count)
9. **Vercel** = collector bot, **GitHub Actions** = scheduled sending, **Apps Script** = data processing

---

## 🐛 Lịch sử bugs đã fix (07/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| Nhân viên không nhận tin | Dùng `@TNIREPORTTASK_BOT` nhưng họ start `SEND_BOT` | Đổi rows 4-32 sang `SEND_BOT` |
| BOD không nhận tin | `gviz/tq` cắt ở row 48 vì hàng trống rows 56-61 | Đổi sang `/export?format=csv` |
| `Message is too long` rows 31,32 | Split chỉ theo `\n` nhưng nội dung là 1 dòng siêu dài | Thêm split theo số ký tự (4000 chars/phần) |
| `APPS_SCRIPT_URL` không đọc được | Biến chưa được thêm vào GitHub Secrets | Thêm secret trên GitHub |

## 🐛 Lịch sử bugs đã fix (08/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **Technical Dept (rows 75-87) không nhận nội dung đúng** | `send_now.py` → `get_custom_messages()` dùng `gviz/tq` với `offset=74` — gviz/tq bỏ 6 hàng trống (rows 56-61) nên offset bị lệch, thực ra đang đọc rows 80-87 thay vì 75-87 | Đổi sang `/export?format=csv` + đọc theo `sheet_row` chính xác (giống `cron_send.py`) |
