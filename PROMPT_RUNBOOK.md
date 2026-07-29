# 🚀 TNI Bot — PROMPT TỔNG HỢP & RUNBOOK
> Đọc file này TRƯỚC khi làm bất kỳ thứ gì. Cập nhật sau mỗi lần sửa lớn.

---

## 🎯 MỤC ĐÍCH HỆ THỐNG

Hệ thống tự động gửi báo cáo Telegram cho **4 Teams + Management** tại TNI Tanintharyi Region:

| Loại báo cáo | Trigger | Bot | Nơi gửi |
|---|---|---|---|
| **Tin 1** — Site down list per team | Khi có báo cáo mới vào Col A | `8647102342:AAGwI95-...` | T1/T2/T3/T4 + CONTROL |
| **Tin 2** — Summary (site/cell/DG/link) | Khi AW7 thay đổi | `8647102342:AAGwI95-...` | T1/T2/T3/T4 + CONTROL |
| **Daily 16:00** — Task remain + WO | GitHub Actions 09:30 UTC | `SEND_BOT 8897800070:...` | Nhân viên + TL + BOD |

---

## 📁 CẤU TRÚC FILE

```
d:\6. AI\1. QLTC\
├── Task and WO\                    ← Repo chính: phonghdpxd-cmd/tni-bot
│   ├── apps_script/
│   │   ├── site_down_v2.gs         ← Apps Script: Tin 1 + Tin 2 (site down) - Decoupled
│   │   └── apps_script_collector.js← Apps Script: Main data collector
│   ├── cron_send.py                ← GitHub Actions: Daily task remain 17:30
│   ├── SYSTEM_DOC.md               ← Tài liệu hệ thống
│   ├── PROMPT_RUNBOOK.md           ← File này
│   ├── api/collector.py            ← Vercel: Bot thu thập order/revoke
│   └── tni_site_down_repo/         ← Sub-repo: phonghdpxd-cmd/TNI-SITE-DOWN
│       ├── .github/workflows/
│       │   └── botlookup_relay.yml ← Chạy cào dữ liệu qua workflow_dispatch
│       ├── botlookup_relay.py      ← Script Python cào botlookup (đã gỡ Note)
│       └── site_down_v2.gs         ← Bản lưu trữ của Apps Script
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
| Site Down Bot | `8647102342:AAGwI95-...` | site_down_v2.gs |
| SEND_BOT | `8897800070:AAHc...` | cron_send.py |
| Collector Bot | `8928677923:AAE_...` | api/collector.py |

### Apps Script Projects
- **TNI Main Project:** Contains `apps_script_collector.gs`, `10_DASHBOARD_REPORT.gs`, etc.
- **TNI Site Down Bot Project:** Standalone project containing only `site_down_v2.gs` (ID: `1fglR_frjlOHBt4o3STTjGmHYaKfuiSb3zAtp7IrO__uLSIuRQGJ2Oc6X`).

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
  2. fetchTelegramUpdates() tự chạy qua checkAndSend() trigger 1 phút (phút :08/:38)
```

### 🔧 Khi tin nhắn bị lỗi format / không hiển thị bold
```
NGUYÊN NHÂN: parse_mode: "Markdown" + có ký tự _ trong owner name (OCK_MYTEL)
FIX: Đã đổi sang HTML format trong sendTelegram():
  parse_mode: "HTML"
  <b>bold</b> thay vì *bold*
  escHtml() escape & < > trong dữ liệu
```

## 🗺️ KIẾN TRÚC SITE DOWN V2 (site_down_v2.gs)

```
┌─────────────────────────────────────────────────────────────┐
│  GITHUB ACTIONS: botlookup_relay.yml                        │
│    (Được kích hoạt bởi trigger của Apps Script hoặc manual)  │
│    1. Gửi lệnh /down_tni tới auto_nocpro_bot               │
│    2. Nhận tin nhắn phản hồi từ Botlookup                  │
│    3. POST tin nhắn raw về Web App của Apps Script         │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST (action: store_site_down)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  APPS SCRIPT: doPost(e)                                     │
│    1. Ghi tin nhắn raw vào Cột A của Google Sheets          │
│    2. Chờ 10 giây để công thức Cột C và AW7 cập nhật        │
│    3. Gọi checkAndSend(true) để gửi tin tức thì             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  checkAndSend()                                             │
│    - Gửi Tin 1 (chi tiết site down từ Cột C)                │
│    - Gửi Tin 2 (bảng tổng hợp sự cố từ AW7:AZ15)            │
│    - Nơi nhận: Nhóm T1, T2, T3, T4 và CONTROL               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 CHECKLIST KHI SETUP HỆ THỐNG MỚI

```
□ 1. Tạo bot qua @BotFather
□ 2. Tắt Privacy Mode (BotFather → /mybots → Group Privacy → Turn off)
□ 3. Thêm bot vào group cần monitor (nên làm Admin)
□ 4. Lấy Chat ID của group: gửi /start rồi gọi getUpdates
□ 5. Cập nhật SD_GROUPS trong site_down_v2.gs
□ 6. Chạy setupSdTrigger() để cài trigger 1 phút (có gate 08/38)
□ 7. KHÔNG dùng webhook (dùng polling getUpdates hoặc Web App relay)
□ 8. Test: testFullFlow() → kiểm tra Telegram
□ 9. Với GitHub Actions: tính cron theo UTC (Myanmar = UTC+6:30)
□ 10. Commit + push lên branch main (không phải master)
```

---

### Hàm test quan trọng
| Hàm | Mục đích |
|---|---|
| `testFullFlow()` | Xóa cache, giả lập kích hoạt GitHub Actions cào và gửi tin ngay lập tức |
| `setupSdTrigger()` | Cài trigger chạy mỗi 1 phút (chỉ thực sự chạy vào phút :08 và :38 Myanmar, khung giờ 03:38 - 22:08) |
| `resetSiteDownProperties()` | Xóa cache ghi nhận A1 và AW7 cũ trên Sheets |
| `testTin1Only()` | Ép gửi Tin 1 (danh sách chi tiết site) bằng dữ liệu hiện có trong Col C |
| `testTin2Only()` | Ép gửi Tin 2 (bảng tổng hợp sự cố) bằng dữ liệu hiện có trong AW7:AZ15 |

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
| GitHub Actions fail 3-5s (đỏ) | Để yên | Chạy `get_session.py` ở local để tạo session mới và update vào Secret `TELEGRAM_SESSION` |
| Dispatch GitHub 24/7 gây lãng phí | Trigger vô điều kiện từ GAS | Kiểm tra khung giờ hoạt động (04:00 - 21:30 Myanmar) trên GAS trước khi gọi API dispatch |
| Tin Team (T2, T3, T4) gửi chui vào CONTROL | Quên Re-deploy GAS hoặc gán nhầm Chat ID T1..T4 thành ID CONTROL | Kiểm tra `SD_GROUPS` trên Script Properties có đúng ID Channel riêng cho T1..T4 không, và Re-deploy New Version sau khi sửa `checkColC()` |


