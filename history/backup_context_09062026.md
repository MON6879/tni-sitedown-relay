# 🗂️ Backup Context — TNI Bot System (09/06/2026)

> Đây là snapshot trạng thái hệ thống để bắt đầu tác vụ mới.
> **Đọc trước khi sửa bất kỳ thứ gì!**
> File trước: `backup_context_08062026.md`

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
| **Data** | `DATA_TAB` | Collector bot lưu Order/Revoke/Export... |
| **Input task** | `1755404595` | Col B=Dep, Col D=content, Col J=Done date |

### Cấu trúc Row — Task remain (ĐÃ XÁC NHẬN 07/06/2026)

| Row | Nhóm | Bot gửi |
|---|---|---|
| 1-3 | Header (row 3 = `export sms`) | — |
| **4-32** | **Nhân viên** | `SEND_BOT` ⚠️ (KHÔNG phải @TNIREPORTTASK) |
| **33-55** | **Team Leaders** | `SEND_BOT` |
| 56-61 | Hàng trống | — |
| **62** | Header `Control all` | — |
| **63** | BOD (`6859790680`) | `SEND_BOT` |
| **65** | Duty Manager (`1728528589`) | `SEND_BOT` |
| **60-74** | Management (nhận mgmt_report) | `SEND_BOT` |
| **75-87** | Technical Dept | `@TNITECHINICALDEPREPORT_BOT` |

> ⚠️ **`HEADER_ROWS = 3`** — phải đọc sheet bằng `/export?format=csv` (KHÔNG dùng `gviz/tq` vì cắt hàng trống rows 56-61 → lệch row management/BOD)

---

## 🤖 Bots

| Bot | Env var | Token (4 ký tự cuối) | Chức năng |
|---|---|---|---|
| `@TNIASSETorderREQUEST_BOT` | `COLLECTOR_BOT_TOKEN` | `...WO8` | Thu thập Order/Revoke/Export/Move/Asset Sent/Destroys |
| `@TNIREPORTTASK_BOT` | `REPORT_TASK_BOT_TOKEN` | `...WO8` | ⚠️ Không dùng cho nhân viên (họ chưa /start) |
| `@TNITECHINICALDEPREPORT_BOT` | `TECHNICAL_DEP_BOT_TOKEN` | `...WO8` | Gửi Technical Dept (E75:E87) |
| `SEND_BOT` | `SEND_BOT_TOKEN` | `...i-A` | Gửi TẤT CẢ: NV + TL + Mgmt + BOD |
| `Site Down Bot` | — | `8647102342:AAGwI95-...` | Site down notify cho T1/T2/T3/T4/CONTROL |

---

## 📁 Files chính (trạng thái 09/06/2026)

| File | Deploy | Trạng thái |
|---|---|---|
| [cron_send.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/cron_send.py) | GitHub Actions | ✅ OK — gửi task remain 17:30 Myanmar hàng ngày |
| [send_now.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/send_now.py) | GitHub Actions | ✅ OK — gửi search stats + asset stats + D75:E87 |
| [botlookup_relay.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/botlookup_relay.py) | GitHub Actions | ✅ OK — relay TNI từ Botlookup → CONTROL mỗi 30p |
| [api/collector.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/api/collector.py) | Vercel | ✅ Collector bot webhook |
| [apps_script_collector.js](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/apps_script_collector.js) | Apps Script | ✅ Backend xử lý dữ liệu Sheet |
| [site_down_notify.gs](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/site_down_notify.gs) | Apps Script | ✅ Site down polling + gửi T1/T2/T3/T4/CONTROL |
| [system_map.md](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/system_map.md) | — | ✅ Tài liệu hệ thống (cập nhật 09/06/2026) |

---

## 🚀 Deploy Targets

### Vercel (Collector Bot)
- **URL:** `https://tni-bot.vercel.app`
- **Env:** `COLLECTOR_BOT_TOKEN`, `APPS_SCRIPT_URL`
- **Deploy:** `npx -y vercel --prod --yes`

### GitHub Actions
- **Repo:** `phonghdpxd-cmd/tni-bot` — branch **`main`** (KHÔNG phải master!)

| Workflow | File | Schedule (UTC) | Schedule (Myanmar) | Script |
|---|---|---|---|---|
| Daily Task Reminder | `daily_task.yml` | `0 11 * * *` | 17:30 | `cron_send.py` |
| Gửi thông báo task | `daily_send.yml` | `30 10 * * *` | 17:00 | `send_now.py` |
| Botlookup Relay | `botlookup_relay.yml` | `0,30 22,23 * * *` + `0,30 0-14 * * *` + `0 15 * * *` | 04:30–21:30 mỗi 30p | `botlookup_relay.py` |
| ~~Telegram Daily Send~~ | `telegram_send.yml` | **⚠️ ĐÃ TẮT** (gây gửi trùng) | — | ~~`cron_send.py`~~ |

> **timeout-minutes** của `botlookup_relay.yml` = **55 phút** (đủ cho delay tối đa 21p + xử lý)

- **GitHub Secrets cần có:**
  - `SEND_BOT_TOKEN`
  - `REPORT_TASK_BOT_TOKEN`
  - `TECHNICAL_DEP_BOT_TOKEN`
  - `APPS_SCRIPT_URL`
  - `TELEGRAM_API_ID`
  - `TELEGRAM_API_HASH`
  - `TELEGRAM_SESSION`

### Apps Script
- **URL Web App:** `https://script.google.com/macros/s/AKfycbxJF4FJHHI93bMELdm6YgFN-Tz8tUKrwl3QXWyrQn_WzDsaoqWjZEO41TvudGyMBKo7wg/exec`
- **Actions:** `collect`, `done`, `get_asset_stats`, `get_report_data`, `refresh_general`
- **Site Down Script ID:** `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR`
  - Trigger: `checkAndSend()` mỗi 5 phút (cài bằng `setupSdTrigger()`)
  - Polling key: `SD_LAST_UPDATE_ID` trong PropertiesService

---

## 🔄 Thay đổi so với backup 08/06/2026

| Ngày | Thay đổi |
|---|---|
| 09/06/2026 | Tắt cron `telegram_send.yml` — gây gửi 3 lần (17:32 / 02:08 / 05:24 Myanmar) |
| 09/06/2026 | Fix Bot không nhận tin CONTROL: Tắt Privacy Mode @BotFather → dùng polling getUpdates |
| 09/06/2026 | Fix Webhook 302: Web App "Who has access" đổi thành Anyone (không cần login) |
| 09/06/2026 | Thêm `site_down_notify.gs` — Site down auto-notify cho T1/T2/T3/T4/CONTROL |
| 09/06/2026 | Thêm `botlookup_relay.py` + `botlookup_relay.yml` — relay TNI từ Botlookup mỗi 30p |
| 09/06/2026 | **Đổi delay botlookup_relay.py: 1–25 phút → 3–21 phút** |

---

## 🐛 Lỗi thường gặp & Cách xử lý

### 1. Gửi tin trùng lặp nhiều lần

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| Bot gửi 2-3 lần cùng nội dung (các giờ khác nhau) | Có 2+ workflow đều có `cron` chạy cùng script | Tắt cron của workflow thừa, chỉ giữ `workflow_dispatch` |
| Gửi đúng giờ nhưng lặp lại sau 6-8 tiếng | Workflow có cron UTC bị tính sai (ví dụ: `30 17` UTC = 00:00 Myanmar = sáng hôm sau) | Kiểm tra lại công thức UTC↔Myanmar: Myanmar = UTC+6:30 |

### 2. BOD / Manager không nhận được tin

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| Nhân viên nhận, BOD không nhận | Đọc sheet bằng `gviz/tq` → bỏ hàng trống 56-61 → lệch row, BOD ở "row 48" tưởng không tồn tại | Đổi sang `/export?format=csv` + `HEADER_ROWS=3` |
| Tất cả không nhận | Secret `APPS_SCRIPT_URL` chưa được thêm vào GitHub Secrets | Vào repo → Settings → Secrets → thêm |

### 3. Nhân viên không nhận tin

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| Team Leader và Manager nhận, nhân viên không | Dùng `@TNIREPORTTASK_BOT` gửi nhân viên nhưng họ chưa `/start` bot này | Rows 4-32 phải dùng `SEND_BOT` |

### 4. Lỗi "Message is too long"

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| Telegram trả `400 Bad Request: message is too long` | Nội dung cột D rows 31-32 là 1 dòng siêu dài, split theo `\n` không cắt được | Thêm split theo số ký tự: mỗi chunk tối đa 4000 chars |

### 5. Bot không nhận tin trong nhóm

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| Bot được add vào group nhưng `getUpdates` rỗng | **Privacy Mode BẬT** — bot chỉ nhận tin bắt đầu `/` | Vào @BotFather → `/mybots` → chọn bot → `Bot Settings` → `Group Privacy` → `Turn off` |
| Webhook luôn trả 302 | Web App Google Apps Script "Who has access" = "Anyone with Google account" (yêu cầu login) | Đổi Deploy → "Anyone" (không cần tài khoản) |

### 6. botlookup_relay — không lấy được phản hồi

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| `⚠️ Không tìm thấy phản hồi từ @auto_nocpro_bot` | `WAIT_REPLY_SEC` quá ngắn hoặc bot chậm | Tăng `WAIT_REPLY_SEC` từ 15 lên 20-30s |
| `getUpdates rỗng` sau lần test đầu | `offset=0` tiêu thụ hết updates, lần sau không còn để đọc | Script dùng `GetHistoryRequest` thay `getUpdates` — không bị lỗi này |
| Job timeout trước khi chạy xong | `timeout-minutes` quá nhỏ (ví dụ 30p) với delay tối đa 21p + xử lý | Đặt `timeout-minutes: 55` trong `botlookup_relay.yml` |

### 7. Technical Dept (rows 75-87) nhận nội dung sai

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| Nhận nội dung của rows 80-87 thay vì 75-87 | `get_custom_messages()` dùng `gviz/tq` với `offset=74` — gviz bỏ 6 hàng trống → lệch 6 row | Đổi sang `/export?format=csv` + đọc theo `sheet_row` |

### 8. Apps Script — lỗi thường gặp

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `getContent() trên TextOutput khi gọi nội bộ` | Gọi hàm web-only (`ContentService`) từ trong script | Dùng hàm `Raw_()` trả thẳng object, không qua `ContentService` |
| Trigger `checkAndSend()` không nhận tin mới | `SD_LAST_UPDATE_ID` chưa được reset sau lần test | Chạy `resetOffset()` / xóa property `SD_LAST_UPDATE_ID` |

---

## ⚠️ Quy tắc quan trọng (KHÔNG được quên)

1. **Push vào branch `main`** — Actions chỉ đọc `main`, KHÔNG phải `master`
2. **Đọc sheet = `/export?format=csv`** — KHÔNG dùng `gviz/tq` (cắt hàng trống)
3. **HEADER_ROWS = 3** — rows 1-3 là header (row 3 có `export sms`)
4. **Nhân viên rows 4-32 = SEND_BOT** — KHÔNG dùng `@TNIREPORTTASK_BOT`
5. **Keywords** load động từ Config col A
6. **Chỉ ID trong Config col D** mới được reply Done
7. **Asset stats recipients** từ Config col C
8. **Tin nhắn > 4096 ký tự** → chia nhỏ theo dòng + ký tự (max 4000/chunk)
9. **botlookup_relay** delay ngẫu nhiên **3–21 phút** (SKIP_DELAY=1 để test nhanh)
10. **Privacy Mode của bot phải TẮT** nếu bot cần đọc tin trong group

---

## 🔍 Logic các script chính

### cron_send.py
```
main():
  1. Đọc sheet Task remain (CSV export, HEADER_ROWS=3)
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

### send_now.py
```
main():
  1. get_report_data() (retry 3 lần)
  2. Gửi từng nhân viên: search stats cá nhân
  3. Gửi từng đội trưởng: team search summary
  4. Gửi ban quản lý: tổng hợp search + leader content
  5. get_asset_stats() → gửi đến Config col C recipients
  6. Gửi custom messages từ D75:E87 (CSV export)
```

### botlookup_relay.py
```
main():
  0. Kiểm tra khung giờ 04:30–21:30 Myanmar
  1. Delay ngẫu nhiên 3–21 phút (bỏ qua nếu SKIP_DELAY=1)
  2. Kết nối Telegram bằng tài khoản cá nhân (Telethon + SESSION_STRING)
  3. Gửi lệnh /down_tni@auto_nocpro_bot vào nhóm Botlookup
  4. Chờ 20s bot phản hồi
  5. Đọc GetHistoryRequest (30 tin gần nhất) → lọc tin từ @auto_nocpro_bot
  6. Forward sang nhóm CONTROL (-5251698940)
```

### site_down_notify.gs (Apps Script)
```
checkAndSend() [trigger mỗi 5 phút]:
  1. fetchTelegramUpdates() → polling getUpdates từ nhóm CONTROL
  2. Ghi báo cáo site down vào Col A Sheet (gid=0)
  3. readColCRaw() → bọc <pre>monospace</pre>
  4. Gửi Tin 1 (bảng site down) → lọc T1/T2/T3/T4/CONTROL riêng
  5. checkAwAz() → AW4:AZ8 summary → Gửi Tin 2 cho T1/T2/T3/T4
```

---

## 🗺️ Groups & Chat IDs

| Nhóm | Chat ID |
|---|---|
| 5 TNI TECHNICA DEP CONTROL SITE | `-5251698940` |
| Team 1 | `-5180992881` |
| Team 2 | `-5188855349` |
| Team 3 | `-5183480727` |
| Team 4 | `-5238696719` |
| BOD | `6859790680` |
| Duty Manager | `1728528589` |

---

*Snapshot: 09/06/2026 21:38 (UTC+6:30)*
