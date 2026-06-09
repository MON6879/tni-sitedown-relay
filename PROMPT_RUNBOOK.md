# 🚀 TNI Bot — PROMPT TỔNG HỢP & RUNBOOK
> Đọc file này TRƯỚC khi làm bất kỳ thứ gì. Cập nhật sau mỗi lần sửa lớn.

---

## 🎯 MỤC ĐÍCH HỆ THỐNG

Hệ thống tự động gửi báo cáo Telegram cho **4 Teams + Management** tại TNI Tanintharyi Region:

| Loại báo cáo | Trigger | Bot | Nơi gửi |
|---|---|---|---|
| **Tin 1** — Site down list per team | Khi có báo cáo mới vào Col A | `8647102342:AAGwI95-...` | T1/T2/T3/T4 + CONTROL |
| **Tin 2** — Summary (site/cell/DG/link) | Khi AW4:AZ8 thay đổi | `8647102342:AAGwI95-...` | T1/T2/T3/T4 |
| **Daily 17:30** — Task remain + WO | GitHub Actions 11:00 UTC | `SEND_BOT 8897800070:...` | Nhân viên + TL + BOD |
| **Daily 17:00** — Search + Asset stats | GitHub Actions 10:30 UTC | `SEND_BOT` | Tech Dept |

---

## 📁 CẤU TRÚC FILE

```
d:\6. AI\1. QLTC\
├── Task and WO\                    ← Repo chính: phonghdpxd-cmd/tni-bot
│   ├── site_down_notify.gs         ← Apps Script: Tin 1 + Tin 2 (site down)
│   ├── cron_send.py                ← GitHub Actions: Daily task remain 17:30
│   ├── send_now.py                 ← GitHub Actions: Daily search+asset 17:00
│   ├── system_map.md               ← Kiến trúc hệ thống
│   ├── PROMPT_RUNBOOK.md           ← File này
│   ├── api/collector.py            ← Vercel: Bot thu thập order/revoke
│   └── .github/workflows/
│       ├── daily_task.yml          ← ✅ ACTIVE: 0 11 * * * UTC = 17:30 Myanmar
│       ├── daily_send.yml          ← ✅ ACTIVE: 30 10 * * * UTC = 17:00 Myanmar
│       └── telegram_send.yml       ← ❌ DISABLED: cron sai (00:00 Myanmar)
├── QLTC_GAS\                       ← Finance/Settlement system (khác biệt)
├── auto_send_17h30.gs              ← Apps Script: Leader report 17:30
└── telegram_report_bot.gs          ← Apps Script: Task progress report
```

---

## 🔑 IDs QUAN TRỌNG

### Google Sheets
| Sheet | ID | GID | Dùng cho |
|---|---|---|---|
| **Site Down Sheet** | `1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow` | `0` | Col A (input), Col C (output), AW:AZ |
| **Task remain Sheet** | `1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8` | `133591305` | WO/task, chat IDs |

### Telegram Groups
| Key | Chat ID | Tên |
|---|---|---|
| `CONTROL` | `-5251698940` | TNI TECHNICA DEP CONTROL SITE |
| `T1` | `-5180992881` | TNI TEAM 1 |
| `T2` | `-5188855349` | TNI TEAM 2 (T2+T5) |
| `T3` | `-5183480727` | TNI TEAM 3 |
| `T4` | `-5238696719` | TNI TEAM 4 |

### Bots
| Bot | Token (4 số đầu) | Dùng cho |
|---|---|---|
| Site Down Bot | `8647102342:AAGwI95-...` | site_down_notify.gs |
| SEND_BOT | `8897800070:AAHc...` | cron_send.py + send_now.py |
| TNIREPORTTASK_BOT | `8646913750:AAG3...` | telegram_report_bot.gs |
| Collector Bot | `8928677923:AAE_...` | api/collector.py |

### Apps Script
| Script | ID |
|---|---|
| Site Down Notify | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` |

---

## ⚡ QUICK ACTIONS — Làm gì khi có vấn đề

### 🔧 Khi bot không nhận tin từ group
```
1. BotFather → /mybots → Bot Settings → Group Privacy → Turn OFF
   HOẶC: Thêm bot làm Admin của group
2. Test: chạy testGetUpdatesRaw() trong Apps Script
   → Phải thấy: Total updates > 0
```

### 🔧 Khi Tin 1 không gửi (site down)
```
1. Apps Script → checkAndSend() → Run
2. Xem log:
   - "[Poll] Không có tin mới" → Bot chưa nhận được báo cáo từ CONTROL
   - "[Tin1] A1 rỗng" → Col A trống, polling chưa lấy về
   - "[Tin1] A1 không đổi" → Dữ liệu cũ, chạy testTin1Only() để force gửi
3. testTin1Only() → force gửi dữ liệu hiện có trong Col C
```

### 🔧 Khi muốn force gửi ngay (không đợi trigger)
```
Apps Script dropdown → testTin1Only → Run
```

### 🔧 Khi cần reset polling (bỏ qua tin cũ)
```
Apps Script → PropertiesService:
  deleteProperty("SD_LAST_UPDATE_ID")  ← reset polling về 0
  deleteProperty("SD_LAST_TS_A1")      ← force Tin 1 gửi khi có dữ liệu
  deleteProperty("SD_LAST_TS_AW4")     ← force Tin 2 gửi khi có dữ liệu
Hàm: testSendNow() — tự xóa hết + gửi ngay
```

### 🔧 Khi GitHub Actions gửi sai giờ / gửi nhiều lần
```
NGUYÊN NHÂN THƯỜNG GẶP:
  - Nhiều workflow cùng chạy 1 script
  - Cron UTC bị tính sai timezone

KIỂM TRA:
  .github/workflows/*.yml → xem schedule: cron: '...'

TÍNH TIMEZONE:
  Myanmar UTC+6:30:  17:30 Myanmar = 11:00 UTC  → cron: '0 11 * * *'
  Vietnam UTC+7:     17:30 Vietnam = 10:30 UTC  → cron: '30 10 * * *'

TẮT WORKFLOW:
  Xóa dòng schedule: - cron: '...' → chỉ giữ workflow_dispatch
```

### 🔧 Khi webhook bị lỗi 302
```
NGUYÊN NHÂN: Web App "Who has access" ≠ "Anyone"
→ KHÔNG FIX WEBHOOK nữa, dùng POLLING thay thế:
  1. deleteWebhook() → Run
  2. fetchTelegramUpdates() tự chạy qua checkAndSend() trigger 5 phút
```

### 🔧 Khi tin nhắn bị lỗi format / không hiển thị bold
```
NGUYÊN NHÂN: parse_mode: "Markdown" + có ký tự _ trong owner name (OCK_MYTEL)
FIX: Đã đổi sang HTML format trong sendTelegram():
  parse_mode: "HTML"
  <b>bold</b> thay vì *bold*
  escHtml() escape & < > trong dữ liệu
```

### 🔧 Khi muốn tạo bot mới
```
1. Telegram: nhắn @BotFather → /newbot → đặt tên → lấy token
2. Thêm bot vào group với quyền ADMIN (để nhận tất cả tin nhắn)
3. BotFather → /mybots → Bot → Bot Settings → Group Privacy → Turn OFF
4. Test: gửi tin vào group → getUpdates → kiểm tra chat ID
5. Cập nhật token trong code + GitHub Secrets
```

---

## 📋 CHECKLIST KHI SETUP HỆ THỐNG MỚI

```
□ 1. Tạo bot qua @BotFather
□ 2. Tắt Privacy Mode (BotFather → /mybots → Group Privacy → Turn off)
□ 3. Thêm bot vào group cần monitor (nên làm Admin)
□ 4. Lấy Chat ID của group: gửi /start rồi gọi getUpdates
□ 5. Cập nhật SD_GROUPS trong site_down_notify.gs
□ 6. Chạy setupSdTrigger() để cài trigger 5 phút
□ 7. KHÔNG dùng webhook (dùng polling getUpdates thay thế)
□ 8. Test: testGetUpdatesRaw() → testTin1Only() → kiểm tra Telegram
□ 9. Với GitHub Actions: tính cron theo UTC (Myanmar = UTC+6:30)
□ 10. Commit + push lên branch main (không phải master)
```

---

## 🗺️ KIẾN TRÚC SITE DOWN NOTIFY (site_down_notify.gs)

```
┌─────────────────────────────────────────────────────────┐
│  checkAndSend() — trigger 5 phút                        │
│                                                         │
│  BƯỚC 1: fetchTelegramUpdates(sheet)                    │
│    → getUpdates từ Telegram (offset = lastId+1)         │
│    → Lọc: chat=-5251698940 + isSiteDownReport()         │
│    → Nếu có báo cáo → writeToColumnA() → xóa TS_KEY_A1 │
│    → flush() + sleep(3s) chờ Col C tính lại             │
│                                                         │
│  BƯỚC 2: checkColC(sheet)                               │
│    → Đọc A1 → so sánh với TS_KEY_A1 stored             │
│    → Nếu khác → readColC() → buildColCMessage()         │
│    → sendTelegram() cho T1/T2/T3/T4 + CONTROL           │
│    → Cập nhật TS_KEY_A1                                 │
│                                                         │
│  BƯỚC 3: checkAwAz(sheet)                               │
│    → Đọc AW4 → so sánh với TS_KEY_AW4 stored           │
│    → Nếu khác → buildAwAzTeamMessage()                  │
│    → sendTelegram() cho T1/T2/T3/T4                     │
│    → Cập nhật TS_KEY_AW4                                │
└─────────────────────────────────────────────────────────┘
```

### Hàm test quan trọng
| Hàm | Mục đích |
|---|---|
| `testGetUpdatesRaw()` | Xem raw getUpdates Telegram → debug bot nhận tin |
| `testTin1Only()` | Force gửi Tin 1 với dữ liệu hiện tại |
| `testSendNow()` | Xóa key + gửi cả Tin 1 và Tin 2 |
| `checkAndSend()` | Chạy đầy đủ: poll + check + send |
| `checkWebhook()` | Xem webhook status (không dùng nữa) |
| `deleteWebhook()` | Xóa webhook để getUpdates hoạt động |
| `setupSdTrigger()` | Cài trigger 5 phút |
| `testPingBot()` | Test bot có gửi được Telegram không |
| `testDebugColC()` | Debug Col C: xem data per team |
| `testDebugAW4()` | Debug AW4: xem timestamp stored |

---

## ⚠️ NHỮNG LỖI ĐÃ GẶP — ĐỪNG LẶP LẠI

| Lỗi | Đừng làm | Làm thay thế |
|---|---|---|
| Bot không nhận tin group | Mày mò webhook | Tắt Privacy Mode hoặc cấp Admin |
| Webhook 302 | Deploy thêm Web App | Dùng polling getUpdates |
| Gửi nhiều lần | Thêm trigger | Kiểm tra workflows/.yml có cron trùng không |
| Tin nhắn không hiển thị | Dùng Markdown với OCK_MYTEL | Dùng HTML + escHtml() |
| getUpdates trả về rỗng | Tưởng không có tin | Kiểm tra Privacy Mode + deleteWebhook trước |
| A1 không đổi | Nghĩ hệ thống hỏng | Chạy testTin1Only() để force send |
| Cron sai timezone | Thêm workflow mới | Tính kỹ: Myanmar = UTC+6:30, 17:30 → 11:00 UTC |
