# 🗂️ Backup Context — TNI Bot System (10/06/2026)

> ⚠️ **ĐỌC FILE NÀY TRƯỚC KHI SỬA BẤT KỲ THỨ GÌ!**
> Snapshot: 10/06/2026 10:05 (Myanmar UTC+6:30)
> Conversation ID: `250e69eb-5e03-4747-9a84-94d30806a8d8`

---

## 🔴 QUY TẮC BẮT BUỘC

> **Mỗi lần bắt đầu:**
> 1. Đọc file này TRƯỚC
> 2. Làm đúng theo thực tế
> 3. Lưu lại sau khi xong
>
> ❌ KHÔNG đoán mò — KHÔNG push nhầm project — KHÔNG sửa file sai

---

## 📍 Workspace

- **Thư mục gốc:** `D:\6. AI\1. QLTC\`
- **TNI Bot code:** `D:\6. AI\1. QLTC\Task and WO\`
- **QLTC GAS code:** `D:\6. AI\1. QLTC\QLTC_GAS\`

---

## 🎯 HAI HỆ THỐNG HOÀN TOÀN RIÊNG BIỆT

### Hệ thống 1 — TNI Bot (Task and WO)
| Thông tin | Giá trị |
|-----------|---------|
| Thư mục | `D:\6. AI\1. QLTC\Task and WO\` |
| Git repo | `github.com/phonghdpxd-cmd/tni-bot` (branch: **main**) |
| GAS Script ID | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` |
| `.clasp.json` | Trong `Task and WO\` → trỏ đến script trên |
| GAS push | `cd "Task and WO" && clasp push --force` |

### Hệ thống 2 — QLTC Tài Chính (QLTC_GAS)
| Thông tin | Giá trị |
|-----------|---------|
| Thư mục | `D:\6. AI\1. QLTC\QLTC_GAS\` |
| Git repo | `D:\6. AI\1. QLTC\` (local git) |
| GAS Script ID | `1tBBEaLklRrpo8dwp1Dt0Im78Gb0YAo-3XE_TP6BKVENmQofXNpMf_yDb` |
| `.clasp.json` | Trong `QLTC_GAS\` → trỏ đến script trên |
| GAS push | `cd "QLTC_GAS" && clasp push --force` |

> ❌ **KHÔNG BAO GIỜ** push file của hệ thống 1 vào hệ thống 2 và ngược lại!

---

## 🔄 LUỒNG DỮ LIỆU ĐẦY ĐỦ (Hệ thống 1)

```
① GitHub Actions — botlookup_relay.py (mỗi 30 phút, 04:30–21:30 Myanmar)
   → Gửi /down_tni@auto_nocpro_bot vào t.me/Botlookup
   → Nhận phản hồi từ @auto_nocpro_bot
   → Forward → 5 TNI TECHNICA DEP CONTROL SITE (-5251698940)
                        ↓
② 3 cách dữ liệu vào hệ thống:
   A. Tự động: botlookup_relay.py gửi vào CONTROL (như trên)
   B. Thủ công: Nhân sự forward vào CONTROL group
   C. Thủ công: Nhân sự nhập thẳng vào Sheet Col A

③ GAS — site_down_notify.gs (trigger checkAndSend() mỗi 5 phút)
   Script ID: 1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR
   → Poll getUpdates từ CONTROL group
   → Phát hiện "site down" + "tanintharyi" + date → ghi Col A
   → Col C tự tính công thức
   → checkColC() → gửi Tin 1 (per-team + CONTROL)
   → checkAwAz() → gửi Tin 2 summary (per-team + CONTROL)
                        ↓
④ Tin nhắn đến T1/T2/T3/T4 + CONTROL — lặp lại từ đầu
```

---

## 🤖 Bots & Chat IDs

| Bot | Token | Chức năng |
|-----|-------|-----------|
| Site Down Bot | `8647102342:AAGwI95-xeyFfJZusOOrIPVBER-z6taZHZI` | Gửi Tin1+Tin2 đến teams |
| SEND_BOT | `8897800070:AAHc...` | Gửi task remain (cron_send.py) |
| COLLECTOR_BOT | `8928677923:AAE_...` | Thu thập Order/Revoke |
| TECHNICAL_DEP_BOT | `8928677923:AAE_...` | Gửi Technical Dept |

| Nhóm | Chat ID |
|------|---------|
| **5 TNI TECHNICA DEP CONTROL SITE** | `-5251698940` |
| TNI TEAM 1 | `-5180992881` |
| TNI TEAM 2 (T2+T5) | `-5188855349` |
| TNI TEAM 3 | `-5183480727` |
| TNI TEAM 4 | `-5238696719` |

---

## 📊 Google Sheets

| Sheet | ID | Dùng cho |
|-------|----|---------|
| **Input Site Down Telegram** | `1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow` | Col A: raw data, Col C: formula, AW:AZ: summary |
| **Task remain** | `1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8` | GID=133591305 |
| **Config** | `1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8` | GID=1236389870 |
| **Input task** | `1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8` | GID=1755404595 |

---

## 📁 Files chính (Task and WO)

| File | Deploy | Trạng thái |
|------|--------|-----------|
| `botlookup_relay.py` | GitHub Actions | ✅ Relay TNI 30 phút, +3–21p delay |
| `site_down_notify.gs` | GAS Script | ✅ Poll CONTROL → Sheet → Teams |
| `cron_send.py` | GitHub Actions | ✅ Gửi task remain 17:30 |
| `send_now.py` | GitHub Actions | ✅ Gửi search+asset stats |
| `api/collector.py` | Vercel | ✅ Collector bot webhook |
| `apps_script_collector.js` | GAS Script | ✅ Backend xử lý Sheet |

---

## ⏰ GitHub Actions Workflows

| Workflow | Schedule UTC | Giờ Myanmar | Script |
|----------|-------------|-------------|--------|
| `botlookup_relay.yml` | `0,30 22,23 * * *` + `0,30 0-14 * * *` + `0 15 * * *` | 04:30–21:30 mỗi 30p | `botlookup_relay.py` |
| `daily_task.yml` | `0 11 * * *` | 17:30 | `cron_send.py` |
| `daily_send.yml` | `30 10 * * *` | 17:00 | `send_now.py` |
| `telegram_send.yml` | ⚠️ **ĐÃ TẮT cron** | — | `cron_send.py` |

---

## 🔑 GitHub Secrets (repo: phonghdpxd-cmd/tni-bot)

| Secret | Dùng cho |
|--------|---------|
| `TELEGRAM_API_ID` = `38060453` | botlookup_relay.py (Telethon) |
| `TELEGRAM_API_HASH` = `49dbb07f2d226a968571b11eab076d73` | botlookup_relay.py |
| `TELEGRAM_SESSION` | botlookup_relay.py (session string) |
| `SEND_BOT_TOKEN` | cron_send.py |
| `REPORT_TASK_BOT_TOKEN` | (dự phòng) |
| `TECHNICAL_DEP_BOT_TOKEN` | cron_send.py rows 75-87 |
| `APPS_SCRIPT_URL` | collector + send |

---

## 🎨 Định dạng tin nhắn (10/06/2026)

### Tin 1 — Col C per-team (site list)
- Format: `<pre>` monospace
- **Team code có màu emoji:** `| 🔵T1 |` `| 🟡T2 |` `| 🟢T3 |` `| 🔴T4 |` `| 🟠T5 |`
- Hàm: `colorizeTeams()` trong `site_down_notify.gs`

### Tin 2 — AW:AZ summary
- Format: HTML (`<b>`, emoji)
- **Per-team:** `📊 SUMMARY — Team X` + icon từng loại sự cố
- **CONTROL tổng hợp:** `📊 SUMMARY TỔNG HỢP — TẤT CẢ TEAM` + 4 team đầy đủ
- Icon: ⚡ Site down | 🔴 Cell down | ⚙️ DG Abnormal | ⏱️ DG Run>16H | 🔗 Link down

---

## 🐛 Lịch sử thay đổi 10/06/2026

| Thay đổi | Chi tiết |
|---------|---------|
| **Fix nhầm GAS project** | `botlookup_relay.gs` bị push nhầm vào site_down project — đã fix |
| **Fix Chat ID sai** | `-1001234567890` (ví dụ) → đã xóa, relay thật dùng Python |
| **Thêm colorizeTeams()** | Tin 1: `\| T1 \|` → `\| 🔵T1 \|` cho dễ nhìn |
| **Tin 2 CONTROL** | Đổi từ plain text → HTML + emoji, format giống per-team |
| **System map** | Thêm quy trình bắt buộc đọc trước - làm - lưu sau |
| **clasp.json Task and WO** | Đã tạo, trỏ đúng `1rvgWwrAMDb...` |

---

## ⚠️ Bugs đã fix (09/06/2026)

| Bug | Fix |
|-----|-----|
| Gửi 3 lần/ngày | Tắt cron `telegram_send.yml` |
| Privacy Mode bot | Tắt qua @BotFather |
| Webhook 302 | Chuyển sang polling getUpdates |
| Tin 1 quá dài | Format monospace `<pre>`, 1 dòng/site |
| Teams nhận tin tất cả team | Lọc `| T1 |`, `| T2 |`... |
| botlookup delay 1–25p | Đổi thành 3–21p |

---

## 🚀 Deploy commands

```powershell
# Push site_down_notify.gs lên GAS
cd "D:\6. AI\1. QLTC\Task and WO"
clasp push --force

# Push code lên GitHub
git add .
git commit -m "message"
git push origin main

# Push QLTC GAS (hệ thống khác!)
cd "D:\6. AI\1. QLTC\QLTC_GAS"
clasp push --force
```

---

## 🔧 Hàm GAS quan trọng (site_down_notify.gs)

| Hàm | Dùng khi |
|-----|---------|
| `setupSdTrigger()` | Cài trigger 5 phút — chạy 1 lần |
| `checkAndSend()` | Main function — trigger tự gọi mỗi 5p |
| `testSendNow()` | Test ép gửi cả Tin1+Tin2 ngay |
| `testTin1Only()` | Test chỉ Tin 1 |
| `testTin2Only()` | Test chỉ Tin 2 |
| `testPingBot()` | Kiểm tra bot còn sống không |
