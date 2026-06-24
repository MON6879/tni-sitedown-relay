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

### Cá nhân nhận báo cáo DM trực tiếp (site_down_notify.gs)

| Người | Telegram | Chat ID cá nhân | Nhận gì |
|---|---|---|---|
| **TNI** (Ha Duc Phong) | @Phongha79 | `6859790680` | Tin1 + Tin2 FULL (giống CONTROL) — qua DM cá nhân |

> **Ghi chú**: `SD_PERSONAL_IDS` trong `site_down_notify.gs` — danh sách Chat ID nhận DM cá nhân, độc lập với group. Thêm/xóa người ở đây để điều chỉnh.

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

| Bot | Token env var | Token | Chức năng | Deploy |
|---|---|---|---|---|
| `@TNIASSETorderREQUEST_BOT` | `COLLECTOR_BOT_TOKEN` | `8928677923:AAE_...` | Thu thập Order/Revoke/Export/Move/Asset Sent/Destroys | Vercel webhook |
| `@SEARCHTNITASKWOBOT` | `TELEGRAM_TOKEN` | `8606383435:AAEs...` | Tra cứu TNI Site/Task/WO + Daily Report | **Vercel webhook 24/7** |
| `@TNIREPORTTASK_BOT` | `REPORT_TASK_BOT_TOKEN` | `8646913750:AAG3...` | ⚠️ Không dùng nữa cho nhân viên (nhân viên chưa start bot này) | — |
| `@TNITECHINICALDEPREPORT_BOT` | `TECHNICAL_DEP_BOT_TOKEN` | `8928677923:AAE_...` | Gửi cho Technical Dept (E75:E87) | GitHub Actions |
| `SEND_BOT` | `SEND_BOT_TOKEN` | `8897800070:AAHc...` | Gửi cho **TẤT CẢ**: Nhân viên + Team Leaders + Management + BOD | GitHub Actions |

---

## 📁 Files chính

| File | Deploy | Chức năng |
|---|---|---|
| [search_bot.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/api/search_bot.py) | **Vercel webhook** | Bot tra cứu TNI + Daily Report — 24/7 miễn phí |
| [collector.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/api/collector.py) | **Vercel webhook** | Bot thu thập — lưu Order/Revoke... vào Sheet |
| [cron_send.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/cron_send.py) | **GitHub Actions** | Gửi task remain hàng ngày 17:30 — dùng SEND_BOT cho tất cả |
| [send_now.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/send_now.py) | **GitHub Actions** | Gửi search stats + asset stats + D75:E87 custom |
| [telegram_bot.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/telegram_bot.py) | ~~GitHub Actions~~ | ⚠️ ĐÃ THAY THẾ bởi `api/search_bot.py` (Vercel webhook) |
| [apps_script_collector.js](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/apps_script_collector.js) | **Apps Script** | Backend xử lý dữ liệu Sheet |

---

## 🚀 Deploy targets

### Vercel (Collector Bot + Search Bot)
- **URL:** `https://tni-bot.vercel.app`
- **Deploy:** `npx -y vercel --prod --yes`
- **Endpoints:**
  - `/api/collector` → `api/collector.py` (Order/Revoke thu thập)
  - `/api/search_bot` → `api/search_bot.py` (TNI Search + Daily Report — **24/7**)
- **Webhook URLs:**
  - Collector: `https://tni-bot.vercel.app/api/collector`
  - Search Bot: `https://tni-bot.vercel.app/api/search_bot`
- **Set webhook:** `python setup_search_webhook.py` (chạy 1 lần)
- **Env vars trên Vercel:**
  - `TELEGRAM_TOKEN` (Search Bot)
  - `COLLECTOR_BOT_TOKEN` (Collector Bot)
  - `APPS_SCRIPT_URL`
  - `DAILY_APPS_SCRIPT_URL`
  - `CABLE_APPS_SCRIPT_URL`
  - `MDG_APPS_SCRIPT_URL`
  - `CABLE_CHAT_ID`
  - `MDG_CHAT_ID`

### GitHub Actions (Scheduled sending)
- **Repo:** `phonghdpxd-cmd/tni-bot`
- **Branch:** `main` (⚠️ KHÔNG PHẢI master!)

| Workflow | File | Schedule | Script |
|---|---|---|---|
| **Daily Task Reminder (17:30 Myanmar)** | `daily_task.yml` | `0 11 * * *` UTC = 17:30 Myanmar | `cron_send.py` |
| Gửi thông báo task | `daily_send.yml` | `30 10 * * *` UTC = 17:00 Myanmar | `send_now.py` |
| **Botlookup TNI Relay** | `botlookup_relay.yml` | `0,30 22,23 * * *` + `0,30 0-14 * * *` + `0 15 * * *` UTC = 04:30–21:30 Myanmar mỗi 30p | `botlookup_relay.py` |
| ~~TNI Search Bot 24/7~~ | `tni_search_bot.yml` | **⚠️ ĐÃ TẮT** — chuyển sang Vercel webhook (`api/search_bot.py`) | ~~`telegram_bot.py`~~ |
| ~~Telegram Daily Send~~ | `telegram_send.yml` | **⚠️ ĐÃ TẮT** — cron cũ `30 17` UTC = 00:00 Myanmar (SAI) | ~~`cron_send.py`~~ |

- **Secrets trên GitHub:**
  - `SEND_BOT_TOKEN`
  - `REPORT_TASK_BOT_TOKEN`
  - `TECHNICAL_DEP_BOT_TOKEN`
  - `APPS_SCRIPT_URL`
  - `TELEGRAM_API_ID` *(dùng cho botlookup_relay)*
  - `TELEGRAM_API_HASH` *(dùng cho botlookup_relay)*
  - `TELEGRAM_SESSION` *(dùng cho botlookup_relay)*

### Apps Script
- **URL:** `https://script.google.com/macros/s/AKfycbwQ4N44xZ92HyiYEOxHgA0VHMrCzKXYSCY32nh0pFgFuFavcUkjxp3h1Z1VkvvO94a9cw/exec`
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

---

## 🐛 Lịch sử bugs đã fix (09/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **Gửi 3 lần (17:32 / 02:08 / 05:24 Myanmar)** | `telegram_send.yml` có cron `30 17 * * *` UTC = 00:00 Myanmar (comment sai: viết 10:30 UTC) → chạy lúc nửa đêm, delay thành 02-05h sáng | Tắt cron của `telegram_send.yml`, chỉ giữ `workflow_dispatch` |
| **Bot không nhận tin từ CONTROL group** | Telegram Privacy Mode BẬT → bot chỉ nhận tin bắt đầu `/` | Tắt Privacy Mode qua @BotFather hoặc cấp Admin cho bot trong group |
| **Webhook 302** | Web App deployment "Who has access" = Anyone with Google account thay vì Anyone | Đổi sang polling `getUpdates` — không cần webhook |

---

## 🤖 Site Down Auto-Notify (09/06/2026)

**File:** [`site_down_notify.gs`](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/site_down_notify.gs) — trong cùng repo `phonghdpxd-cmd/tni-bot`

### Flow hoạt động
```
Báo cáo site down → Gửi vào nhóm CONTROL (-5251698940)
         ↓
Apps Script trigger 5 phút → fetchTelegramUpdates() (polling getUpdates)
         ↓
Ghi vào Col A của Sheet: 1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow (tab GID=0)
         ↓ Col C công thức tự tính
checkColC() → readColCRaw() → bọc <pre>...monospace...</pre>
  ├── CONTROL  → Toàn bộ Col C (full)
  ├── Team 1   → Header + summary T1 + site | T1 |
  ├── Team 2   → Header + summary T2/T5 + site | T2 | | T5 |
  ├── Team 3   → Header + summary T3 + site | T3 |
  └── Team 4   → Header + summary T4 + site | T4 |
         ↓
checkAwAz() → AW4:AZ8 summary → Gửi Tin 2 cho T1/T2/T3/T4
```

### Format Tin 1 (monospace `<pre>`)
```
TNI Site down | DG+Solar+BB    Time down *<7day*
Total Site down: 21, IGT: 4...
Team 1: Total Site down: 11...
...
1: TNI0185 | T1 | 0.36 | MyTel | DG+Solar+BB | Yebyu | Thu Rain Niang | 1 | EAT: ...
```
→ Hiển thị dạng bảng monospace xanh trong Telegram (`<pre>` + `parse_mode: HTML`)

### Bot & Groups
| Bot Token | Nhóm nhận |
|---|---|
| `8647102342:AAGwI95-...` | T1(-5180992881), T2(-5188855349), T3(-5183480727), T4(-5238696719), CONTROL(-5251698940) |

### Apps Script trigger
- **Script ID:** `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR`
- **Trigger:** `checkAndSend()` mỗi 5 phút (cài bằng `setupSdTrigger()`)
- **Polling key:** `SD_LAST_UPDATE_ID` trong PropertiesService
- **Không dùng webhook** (đã thử nhưng lỗi 302 do Privacy Mode)
- **Parse mode:** `HTML` (`<pre>` cho monospace xanh)

---

## 🐛 Lịch sử bugs đã fix (09/06/2026 — phần 2)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **Tin 1 quá dài, khó đọc** | Format cũ: 4 dòng/site (số thứ tự, địa chỉ, EAT...) | Đổi sang `<pre>` monospace, mỗi site 1 dòng |
| **Teams nhận tin của tất cả teams** | Gửi full Col C cho mọi group | Lọc theo `\| T1 \|`, `\| T2 \|`... gửi đúng team |
| **CONTROL không nhận full** | Chỉ gửi per-team | CONTROL riêng → nhận toàn bộ Col C |
| **getUpdates rỗng sau testGetUpdatesRaw** | `offset=0` consume updates sớm hơn | Thêm log offset + raw, fix `lastId=0 → offset=0` |
| **Polling không nhận tin dù bot active** | Privacy Mode BẬT trên Telegram | Tắt qua @BotFather → bot nhận tất cả tin group |

---

## 🐛 Lịch sử thay đổi (09/06/2026 — phần 3)

| Thay đổi | Chi tiết |
|---|---|
| **botlookup_relay.py delay: 3–21p → 1–5p** | `MIN_DELAY_SEC = 1*60`, `MAX_DELAY_SEC = 5*60` — delay ngắn hơn vì công ty đã update TRƯỚC trigger, không cần đợi lâu. Timeout workflow: 50p → 15p |

---

## ⚡ Lỗi thường gặp & Xử lý nhanh

### Gửi tin trùng nhiều lần
- **Nguyên nhân:** Có ≥2 workflow cùng cron chạy cùng script
- **Fix:** Tắt cron của workflow thừa → chỉ giữ `workflow_dispatch`
- **Kiểm tra:** UTC↔Myanmar: Myanmar = UTC+6:30 (cẩn thận `30 17 UTC` = 00:00 Myanmar sáng hôm sau)

### BOD/Manager không nhận tin
- **Nguyên nhân:** Dùng `gviz/tq` đọc sheet → cắt hàng trống 56-61 → lệch row
- **Fix:** Dùng `/export?format=csv` + `HEADER_ROWS=3`

### Bot không nhận tin trong group
- **Nguyên nhân:** Privacy Mode BẬT → bot chỉ nhận tin `/command`
- **Fix:** @BotFather → `/mybots` → Bot Settings → Group Privacy → **Turn off**

### Webhook 302
- **Nguyên nhân:** Web App Google Apps Script deploy "Anyone with Google account"
- **Fix:** Redeploy → "Anyone" (không cần tài khoản)

### botlookup_relay job timeout
- **Nguyên nhân:** `timeout-minutes` nhỏ hơn delay + xử lý
- **Fix:** `timeout-minutes: 55` trong `botlookup_relay.yml`

### botlookup_relay không lấy được phản hồi
- **Nguyên nhân:** `WAIT_REPLY_SEC` quá ngắn (bot chậm)
- **Fix:** Tăng `WAIT_REPLY_SEC` lên 20-30s trong `botlookup_relay.py`

### Message is too long
- **Nguyên nhân:** Content 1 dòng siêu dài, split theo `\n` không cắt được
- **Fix:** Split thêm theo số ký tự, mỗi chunk ≤ 4000 chars

### Nhân viên không nhận tin
- **Nguyên nhân:** Dùng `@TNIREPORTTASK_BOT` cho rows 4-32 nhưng họ chưa `/start`
- **Fix:** Rows 4-32 phải dùng `SEND_BOT`

---

## 🐛 Lịch sử thay đổi (10/06/2026)

| Thay đổi | Chi tiết |
|---|---|
| **Relay gửi trực tiếp T1/T2/T3/T4** | ❌ SAI — relay chỉ trigger bot + gửi CONTROL, site_down_notify.gs lo phân phối |
| **Relay store_site_down → GAS** | ❌ Bỏ — raw data từ BOT LOOKUP thiếu `\| T1 \|` markers |
| **Relay trigger-only** | ❌ Bỏ — CONTROL không nhận gì → Col A trống |
| **Relay gửi raw → CONTROL (sạch)** | ✅ HIỆN TẠI — raw data → CONTROL → site_down_notify.gs ghi Col A |
| **Active window mở rộng** | 04:30–21:30 → 04:30–23:00 Myanmar (để test tối) |
| **Cron schedule** | Đổi từ `*/30` (48/ngày, GitHub throttle) → explicit crons (active window) |

---

## 🔄 Flow Botlookup Relay (HIỆN TẠI — 10/06/2026)

```
GitHub Actions (mỗi 30p, 04:30–23:00 Myanmar)
    ↓
botlookup_relay.py
    ├─ Đăng nhập @Phongha79 (Telethon session)
    ├─ Gửi /down_tni@auto_nocpro_bot vào BOT LOOKUP
    ├─ Chờ 35s → đọc phản hồi từ @auto_nocpro_bot
    └─ Gửi raw text (sạch, không prefix) vào CONTROL (-5251698940)
              ↓
site_down_notify.gs trigger mỗi 5 phút
    ├─ fetchTelegramUpdates() → đọc tin từ CONTROL qua SD_BOT getUpdates
    ├─ isSiteDownMessage() → check "tanintharyi" + date dd/mm/yyyy
    ├─ writeToColumnA() → ghi vào Col A của SD Sheet
    └─ checkColC() → đọc Col C formula → gửi T1/T2/T3/T4 + CONTROL
```

> **⚠️ Giới hạn:** Raw data từ BOT LOOKUP (`STATION | DURATION | OWNER | POWER`) thiếu
> `| T1 |` markers → Col C formula có thể không lọc đúng team nếu không có lookup table.
> Nếu Col C không phân tích được từ raw → dùng phương pháp thủ công bên dưới.

---

## 📋 Hướng dẫn thao tác thủ công

### Khi cần gửi ngay (không chờ tự động)

**Bước 1 — Lấy dữ liệu đầy đủ** (format có `| T1 |`):
- Vào nhóm **CONTROL** → copy tin site down đầy đủ (có emoji team 🟡T2, 🟠T5...)
- Hoặc: Ai đó forward tin gốc màu xanh vào CONTROL → site_down_notify.gs tự đọc

**Bước 2 — Paste vào Sheet** (nếu chưa auto):
- Mở [Sheet "Input Site down Telegram"](https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/edit?gid=0#gid=0)
- Click **A1** → Paste toàn bộ nội dung (mỗi dòng = 1 ô Col A)
- Col C formula tự tính ngay

**Bước 3 — Gửi ngay** (không chờ trigger 5p):
- Vào GAS Editor → Script `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR`
- Chọn function **`checkAndSend`** → ▶ Run

### Kiểm tra trigger có chạy không
- GAS Editor → **Triggers** (icon đồng hồ) → phải có `checkAndSend` mỗi 5 phút
- Nếu không có → chạy `setupSdTrigger()` một lần để tạo lại

---

## 📁 File quan trọng (10/06/2026)

| File | Mô tả |
|---|---|
| [botlookup_relay.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/botlookup_relay.py) | Relay: trigger bot → gửi raw data → CONTROL. Active 04:30–23:00 Myanmar |
| [.github/workflows/botlookup_relay.yml](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/.github/workflows/botlookup_relay.yml) | Workflow: 3 crons explicit trong active window, pip install telethon requests |
| [apps_script_collector.js](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/apps_script_collector.js) | GAS collector: thêm action `store_site_down` (chưa deploy, để dành) |
| [site_down_notify.gs](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/site_down_notify.gs) | GAS site down: polling CONTROL 5p → ghi Col A → gửi T1/T2/T3/T4 |

---

## 🐛 Lịch sử bugs đã fix (16/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **botlookup_relay fail toàn bộ từ ~03:30 AM** | `AuthKeyDuplicatedError` — Telethon session `TELEGRAM_SESSION` bị Telegram vô hiệu hóa do tài khoản `@Phongha79` đăng nhập từ 2 IP khác nhau cùng lúc (GitHub Actions runner IP ≠ IP cũ) | Chạy `get_session.py` trên máy local → tạo session string mới → update GitHub Secret `TELEGRAM_SESSION` |
| **Teams không nhận tin ~7 tiếng (03:43–13:31)** | Hệ quả của lỗi trên — CONTROL không nhận dữ liệu → GAS không có gì để gửi | Fix session là đủ — GAS hoạt động bình thường suốt thời gian đó |

### ⚡ Khi nào cần tạo session mới (`TELEGRAM_SESSION`)
- GitHub Actions fail với lỗi `AuthKeyDuplicatedError` hoặc `SessionExpired`
- Sau khi đổi mật khẩu Telegram `@Phongha79`
- Sau khi đăng nhập tài khoản trên thiết bị mới

### 🔧 Cách tạo session mới (< 2 phút)
```powershell
# 1. Mở PowerShell tại thư mục Task and WO
cd "D:\6. AI\1. QLTC\Task and WO"
python get_session.py

# 2. Nhập SĐT @Phongha79 → nhập OTP từ Telegram
# 3. Copy SESSION STRING xuất hiện
# 4. Vào GitHub → Settings → Secrets → TELEGRAM_SESSION → Update
# 5. Chạy thủ công workflow "Botlookup TNI Relay" để test
```

> **Script:** [`get_session.py`](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/get_session.py) — API_ID: `38060453` | API_HASH: `49dbb07f2d226a968571b11eab076d73`

---

## 🐛 Lịch sử bugs đã fix (18/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **CONTROL không nhận Tin 1 (Col C site list)** | `sendTelegram("<pre>...8000 chars...</pre>")` → `splitMessage` cắt giữa `<pre>...</pre>` → mỗi chunk thiếu tag đóng/mở → Telegram reject 400 "Unclosed tag". Teams ngắn hơn nên không cần split → không lỗi | Thêm hàm `sendTelegramPre()`: split nội dung TRƯỚC, rồi bọc từng chunk bằng `<pre></pre>` riêng |
| **checkColC lưu toàn bộ A1 vào PropertiesService** | A1 dài > 9KB → property bị cắt → key không khớp → gửi trùng lặp hoặc bỏ qua sai | Thay bằng `storeKey = timestamp + 60 ký tự đầu A1` (luôn < 200 bytes) |
| **TNI Search Bot chết sau ~6h, không tự restart** | `tni_search_bot.yml` chỉ có `push` + `workflow_dispatch`, không có `schedule` cron → bot chết sau timeout 350p, không bao giờ restart | Thêm cron `0 0,5,10,15,20 * * *` (mỗi 5h UTC) + `concurrency: cancel-in-progress: true` |
| **CONTROL nhận mgmt_report (cron_send.py)** | `mgmt_report` chỉ gửi cho rows 60-74 cá nhân, không gửi vào group CONTROL SITE | Thêm step 8b gửi `mgmt_report` vào CONTROL SITE dùng `TECHNICAL_DEP_BOT_TOKEN` |

---

## 🐛 Lịch sử bugs đã fix (22/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **Nhân viên (rows 4-32) nhận tin thiếu Detail** | Khi Apps Script match employee (`emp_match`), code dùng `format_employee_report()` chỉ tạo 4 dòng tóm tắt (name, rank, close%, WO remain, dep stats). Toàn bộ phần **Detail** bị mất: Cell Down, DG Abnormal, Smoke, Open Door, Battery Door, Site need refuel, danh sách site, danh sách WO | Bỏ `format_employee_report()` cho employee rows. Luôn dùng Col D content đầy đủ. Nếu nội dung > 4000 ký tự, `send_msg()` tự split thành nhiều tin |

---

## 🐛 Lịch sử bugs đã fix (23/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **Dashboard Report bảng tổng hợp hiển thị toàn 0** | `10_DASHBOARD_REPORT.gs` join Search Log với Task Remain **theo tên** (`name.toLowerCase()`). Search Log col C = Telegram `first_name` (vd: "Bhone"), Task Remain col B = tên đầy đủ (vd: "Bhone Htet Aung") → **không bao giờ khớp** → tất cả search stats = 0 | Đổi key `srch` dict từ `name` (col C, index 2) sang `user_id` (col D, index 3). Lookup đổi từ `srch[name.toLowerCase()]` sang `srch[info.chat_id]`. Vì Telegram `user_id` (Search Log col D) === `chat_id` (Task Remain col E) cho private chats |
| **Info: TNIxxxx không ghi Search Log** | `search_bot.py` chỉ gọi `log_search` khi tra cứu TNI thường (line 463-476), nhưng bỏ qua khi dùng `Info: TNIxxxx` (line 431-450) | Thêm block `log_search` fire-and-forget vào sau xử lý Info lookup (trước `return`) |
| **Dashboard đếm cả tra cứu Info (không phải TNIxxxx)** | `10_DASHBOARD_REPORT.gs` đếm tất cả rows trong Search Log, không filter theo TNI Code (col E). Khi `Info:` cũng ghi log → số liệu bị phồng | Thêm filter `tni.toUpperCase().startsWith("TNI")` trước khi đếm. Chỉ đếm tra cứu TNIxxxx thực sự |

### Dashboard Report — Match logic mới (23/06/2026)
```
Search Log (col D = user_id)  ←→  Task Remain (col E = chat_id)
       "7123456789"           ===         "7123456789"
```
> **Ưu điểm**: user_id không bao giờ thay đổi (khác first_name có thể đổi bất kỳ lúc nào trên Telegram).

### Dashboard Report — Filter logic (23/06/2026)
```
Search Log col E (TNI Code) → chỉ đếm khi bắt đầu bằng "TNI"
Bỏ qua: Info lookup (tni_code = "TNIXXXX" nhưng từ Info: flow — vẫn bắt đầu TNI → cũng được đếm)
```
> **Lưu ý**: Cả TNI lookup và Info: TNIxxxx đều ghi tni_code = "TNIxxxx" → đều được đếm (đúng logic).

---

## 🐛 Lịch sử bugs đã fix (24/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **Search Log không ghi dữ liệu gì cả** | `APPS_SCRIPT_URL` trong Vercel bị lưu là `""` (chuỗi rỗng) → `if APPS_SCRIPT_URL:` luôn `False` → không bao giờ gọi GAS | Xóa biến cũ, thêm lại đúng URL vào Vercel, redeploy |
| **Cột Date/Time trong Search Log trống** | Dùng `setNumberFormat("@STRING@")` trên cells → lock format → gviz CSV không đọc được; `appendRow` tiếp theo kế thừa format đó từ row trên | Thêm `logSheet.getRange("A:B").setNumberFormat("General")` TRƯỚC mỗi `appendRow` để reset format |
| **Date format `dd/mm/yyyy` → trống** | Google Sheets (locale Myanmar) không parse được `"24/06/2026"` → lưu trống | Đổi sang ISO `YYYY-MM-DD` (`now_mm.strftime("%Y-%m-%d")`) — Google Sheets nhận dạng chuẩn |
| **Raw HTML gửi vào nhóm Telegram** | `botlookup_relay.py` lấy Note từ GAS, guard chỉ check `startswith("{")`. Khi GAS URL 404, response là HTML `<!DOCTYPE...>` → guard bỏ qua → gửi HTML vào tất cả groups | Thêm `is_html = raw_note.lower().startswith("<!doctype")` + check `status_code != 200` vào guard |
| **Apps Script URL bị 404 sau clasp deploy** | `clasp deploy --deploymentId` reset authorization settings của Web App → mất quyền "Execute as Me / Anyone" | **KHÔNG dùng** `clasp deploy --deploymentId` nữa. Chỉ dùng `clasp push` rồi vào UI update |

### ⚠️ Quy tắc QUAN TRỌNG khi sửa Apps Script (từ 24/06/2026)

```
ĐÚNG:  clasp push --force          ← chỉ đẩy code lên
       → Vào UI: Deploy → Manage Deployments → Edit → New version → Update

SAI:   clasp deploy --deploymentId  ← PHẢI TRÁNH — làm mất quyền Web App → 404
SAI:   clasp deploy                 ← tạo deployment mới chưa có quyền → 404
```

### Apps Script URLs hiện tại (24/06/2026)

| Biến | URL |
|---|---|
| `APPS_SCRIPT_URL` | `https://script.google.com/macros/s/AKfycbzvQrwvk7N0bc2Bh-lZEnLxRE6Lx8NE4xffUmZJSkUg4EdquSKYPg9VfD1VXTfkim2gFg/exec` |
| Script ID | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` |
| Search Log GID | `1426553697` |

### Search Log — Cấu trúc ghi (24/06/2026)

```
Tab: "Search Log" | GID: 1426553697
Cột: Date (A) | Time (B) | User Name (C) | User ID (D) | TNI Code (E)
date format: YYYY-MM-DD (ISO) — Google Sheets đọc đúng
time format: HH:MM
Chỉ ghi: text khớp TNIxxxx (KHÔNG ghi Info:, KHÔNG ghi Daily)
GAS handleLogSearch: reset A:B về "General" → appendRow([dateStr, timeStr, ...])
```

> **Lưu ý `botlookup_relay.py`**: Guard `raw_note` phải check `is_html` (`<!doctype` / `<html`) VÀ `status_code != 200`. Nếu không, HTML 404 từ GAS sẽ bị gửi vào tất cả Telegram groups.


