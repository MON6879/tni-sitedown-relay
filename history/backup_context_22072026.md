# Backup Context — 22/07/2026

## 📌 Summary of Completed Work & Updates

### 1. Site Down Bot (`site_down_v2.gs`)
- **Fix Column C Parsing**: Replaced regex team block extraction with exact cell row mapping matching the Google Sheet `1. Input Site down Telegram`:
  - `C1:C3`: Total header & summary lines.
  - `C4`: Team 1 summary line (`Team 1: Total Site down...`).
  - `C5`: Team 2 summary line (`Team 2: Total Site down...`).
  - `C6`: Team 3 summary line (`Team 3: Total Site down...`).
  - `C7`: Team 4 summary line (`Team 4: Total Site down...`).
  - `C10:C`: Site detail lines (`1: TNI... | 🔵T1 | ...`).
- **CONTROL Group Copy ALL**: CONTROL group now receives 100% full text of Column C inside `<pre>copy\n...</pre>` format without dropping lines or excluding teams.
- **Per-Team Skipping**: For individual Team groups (T1, T2, T3, T4), messages are ONLY sent if that team has data. Teams with no site down / no data are automatically skipped (no empty or error messages sent).
- **Icon & Formatting Improvements**:
  - Added newlines before all metric icons: ⚡ `Site down:`, 🔥 `Dont Forget`, 🔴 `Cell down:`, ⚙️ `DG Abnormal:`, ⏱️ `DG Run>16H:`, 🔗 `Link down:`, 🕒 `Duty:`.
  - Fixed JS Regex by removing lookbehinds (`(?<!...)`) for 100% Google Apps Script V8 runtime compatibility.
  - **Summary (Tin 2)**: Added `formatTsHeader()` helper to extract concise timestamp (`dd/MM/yyyy HH:mm`) for the header, removing duplicate full-text timestamp lines and eliminating empty blank lines between metrics.

### 2. TNI Attendance Bot (`TNI attendance.js`)
- **English Translation**: All bot responses translated to English (`⚠️ Today's attendance for you/your group has already been recorded for this time slot.`).
- **4 Time Slot Reporting Windows**: Added support for 4 distinct time slots per day:
  1. `< 08:30` (Slot morning 1)
  2. `10:00 - 12:00` (Slot morning 2)
  3. `13:00 - 14:00` (Slot afternoon 1)
  4. `16:00 - 17:00` (Slot afternoon 2)
  Workers posting attendance photos in a new time slot window are accepted and recorded cleanly.
- **Dynamic Web App URL**: Added `ScriptApp.getService().getUrl()` fallback in `setupAttendanceWebhook()` so webhook setup automatically retrieves deployment URL.

### 3. Daily Plan Report (`daily_plan_report.py`)
- Added `fmt_sent_at()` helper to format submission timestamps as `DD/MM/YYYY HH:MM` (e.g. `(sent at 22/07/2026 06:53)`).
- Applied timestamp display across Plan Tomorrow, Morning Plan, Control Summary, and 3-Day Completion Rate sections.
- Configured 8 exact UTC cron schedule triggers in `.github/workflows/daily_reports.yml` (07:00, 07:30, 08:00, 08:30, 10:00, 17:20, 20:00, 22:00 Myanmar time).

### 4. GitHub Actions Infrastructure & Relay Integration
- Integrated `botlookup_relay.py` and `.github/workflows/botlookup_relay.yml` directly into the main repository `phonghdpxd-cmd/tni-bot` running every 30 minutes (`8,38 * * * *`).
- Fixed Telethon `RuntimeError` by switching from `async for iter_dialogs()` to `await client.get_dialogs(limit=200)`.
- Switched repository `phonghdpxd-cmd/tni-bot` visibility from **Private** to **Public**, unblocking GitHub Actions and unlocking **UNLIMITED 24/7 FREE MINUTES**.

---

## 📂 Key File Locations

| File | Location | Purpose |
|---|---|---|
| `site_down_v2.gs` | `tni_site_down_repo/site_down_v2.gs` & `apps_script/site_down_v2.gs` | Site Down auto-notification GAS script |
| `TNI attendance.js` | `apps_script_attendance/TNI attendance.js` | TNI Daily Attendance GAS script |
| `botlookup_relay.py` | `botlookup_relay.py` | Telethon botlookup relay python script |
| `botlookup_relay.yml` | `.github/workflows/botlookup_relay.yml` | 30-minute cron workflow for relay |
| `daily_plan_report.py` | `daily_plan_report.py` | Daily plan report generator |
| `daily_reports.yml` | `.github/workflows/daily_reports.yml` | GitHub Actions workflow schedule |

---

## 🔒 Security Status
- All secrets, API keys, and bot tokens are secured via **GitHub Repository Secrets**.
- No sensitive keys or tokens are hardcoded in source files.
- `.env` file is excluded from Git via `.gitignore`.
- Google Sheets access permissions:
  - Attendance & Site Down sheets: Restricted or Viewer.
  - Report export sheets: "Anyone with the link can VIEW" (Viewer access).
