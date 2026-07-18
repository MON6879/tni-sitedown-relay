# Backup Context — 18/07/2026
> Session: Refuel Plan Report System — Bug fixes & Report redesign

---

## 🔧 Vấn đề đã giải quyết

### 1. Telethon delete-by-title không hoạt động
**Root cause 1**: `iter_messages(from_user=bot_id)` — Telethon cần cache entity của bot trước.
**Fix**: Bỏ `from_user`, dùng `if msg.sender_id != bot_id: continue`.

**Root cause 2**: Telegram HTML `<b>text</b>` → Telethon đọc lại thành `**text**` (markdown).
Nên `first_line.startswith("📋 [Report 1]")` KHÔNG match `"📋 **[Report 1]..."`.
**Fix**: `first_line_clean = first_line.replace("**", "").replace("__", "").strip()` rồi mới startswith.

**Root cause 3**: `load_dotenv()` load `SEND_BOT_TOKEN=8897800070` (bot task), không phải bot refuel.
**Fix**: Thêm `REFUEL_BOT_TOKEN=8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME` vào `.env`.

### 2. GAS parse sai qty và team name
**Root cause qty**: `parseSitesAndQty` dùng separator `[\s:,+]` — thiếu `=`.
Nên `TNI0385=220L` → pat1 không match → pat2 default 440L.
**Fix**: Đổi thành `[\s:,+=]`.

**Root cause team**: Regex `/Team\s*(\d+)/i` không match `Team-3` hay `Team -2`.
**Fix**: Đổi thành `/Team[\s\-]*(\d+)/i`.

---

## ✨ Report 1 — Format mới (Sender → Team → Sites)

```
📋 [Report 1] Plan - Request - Refueled
📅 18/07/2026 | ⏰ 23:09 Myanmar
Site ID      |  Plan | Refueled |  Req
─────────────┼───────┼──────────┼───────

👤 Aung Naing Refuel Team 2
  🏷 Team 2
    ❌ TNI0385      |  440L |      0L |   0L
    ❌ TNI0386      |  440L |      0L |   0L
  🏷 Team 3
    ❌ TNI0383      |  440L |      0L |   0L
─────────────┴───────┴──────────┴───────
Total        | 1320L |      0L |   0L
```

- Grouping: `sender_id → {name, team_order, team_sites}`
- Team infer từ lịch sử toàn bộ PLAN records (không chỉ hôm nay)
- Team được đọc từ col C "Name Team Plan" của sheet "Plan refuel"

## ✨ Report 2 — Format mới (Progress Sent Plan)

```
📊 [Report 2] Progress Sent Plan
📅 18/07/2026 | ⏰ Myanmar

📝 Letter Progress:
  📤 Submitted on: 10/07/2026
  ✅ Approved on: 16/07/2026

📋 Plan Sent Today: N
Name            | 3D | 7D |  1M
✅ Maung Maung   |  2  |  5  |  15
```

---

## 📁 Files thay đổi

| File | Commit |
|------|--------|
| `refuel_plan_report.py` | `6565505` feat: Report 1 Sender>Team>Sites |
| `tg_utils.py` | `9348f9e` fix: strip Telethon bold markdown |
| `delete_old_helper.py` | `9348f9e` fix: strip Telethon bold markdown |
| `.env` | (local only) thêm REFUEL_BOT_TOKEN |
| `apps_script/apps_script_refuel_plan.gs` | `6565505` fix = separator + Team dash |

## 🔑 Key Config

```
REFUEL_BOT_TOKEN = 8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME  (bot @TNI_REFUEL_BOT)
REFUEL_CHAT_ID   = -5469544739   (group "9 TNI REQUEST REFUEL")
REFUEL_APPS_SCRIPT_URL = https://script.google.com/macros/s/AKfycbzZmFwP0j_Vr_m9mhQczzuVKFVoc7rNfVsz_HyM4JQTcgcdEFh8Zb5bNM5dsfHxZlxk/exec

Refuel Spreadsheet: 1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM
Tabs: Plan refuel | Team request | Refueled | Lettel Progress | Template
```

## 🧪 Telethon Session
- API_ID: 38060453
- Bot user_id để filter: lấy từ `getMe` → `result.id` (hiện tại = 8811503647)
- Session: `TELEGRAM_SESSION` trong `.env`

## ⚡ Lệnh chạy thử local
```powershell
cd "d:\6. AI\1. QLTC\Task and WO"
python refuel_plan_report.py --report 1       # Report 1
python refuel_plan_report.py --report 2       # Report 2
python refuel_plan_report.py --report 1 2 3  # Multiple
python refuel_plan_report.py                  # All 5 reports
```

## 📌 Lưu ý quan trọng
- `apps_script_refuel_plan.gs` là file GAS — mỗi lần sửa cần `clasp push` trong `apps_script/`
- Sau `clasp push` cần **re-deploy** Web App trên GAS Editor (hoặc update existing deployment)
- `.env` **KHÔNG** push lên Git (có trong `.gitignore`)
- `scratch/sheet_refuel.xlsx` là cache local — bị xóa khi `download_spreadsheet()` chạy lại
