# Session Backup Log — 22/07/2026 (FINAL FREEZE)

## Summary of All Tasks Completed

### 1. Site Down Bot (`site_down_v2.gs`)
- **CONTROL Group Format**: Takes C1..C3 (Header / Total Site Down / Duty info) and C10:C (Site detail lines). Skips Team 1..4 Totals.
- **Per-Team Format**: Takes Team Summary + Team Site details. Skips sending if a team has no data.
- **Delete & Send Mode**: Completely removed `editMessageText`. For all report types (`TIN1_CONTROL`, `TIN1_T1..T4`, `TIN2_T1..T4`, `TIN2_CONTROL`, `TIN2_DM`), the script ALWAYS deletes old message(s) via `deleteOldMessages_` and sends a brand new message bubble via `sendTelegramCollectIds_` or `sendTelegramPreCollectIds_`. Telegram message bubbles now display the exact current update timestamp (`16:06`, `16:38`, etc.).
- **Formula Recalculation Dedup Fix**: `checkAwAz()` extracts stable date/time string `tsKey = formatTsHeader(rawTs)` (e.g. `"22/07/2026 15:16"`) and uses it as the PropertyService dedup key. Minor minute-by-minute Google Sheet formula recalculations (`14.2` -> `14.3`) are ignored, stopping message spam completely.
- **Icon Formatting**: Title icons (⚡, 🔥, 🔴, ⚙️, ⏱️, 🔗, 🕒) are placed on new lines (`\n`). 100% Apps Script V8 runtime compatible.

### 2. Search Bot (`telegram_bot.py`)
- **Google Sheet Permission Error Handling**: Catches HTTP 401 Unauthorized errors and raises a clear human-readable prompt to set Google Sheet Share permission to "Anyone with the link can view (Viewer)".
- **Viewer Access Verified**: Sheet set to Viewer mode. Search queries (`TNI0051`, `TNI0231`) execute flawlessly.

### 3. GitHub Multi-Account & Action Workflows
- **Account 1**: `phonghdpxd-cmd` (Repo `tni-bot` -> **PRIVATE** mode). Disabled/removed `daily_reports.yml` and `botlookup_relay.yml`. Runs Render web services only.
- **Account 2**: `MON6879` (Repo `tni-sitedown-relay` -> **PRIVATE** mode). Contains 14 GitHub Actions Encrypted Secrets and active workflows `daily_reports.yml` and `botlookup_relay.yml`.
- **Duplicate Execution Elimination**: Only 1 GitHub account runs scheduled crons and polling. No double message delivery.
- **Schedule Update**: Shift-end daily reports (`daily_task`, `plan_eod`, `bod_assign`, `cable_report`, `refuel_send`) updated from 17:20/17:30 to **16:00 Myanmar time (`30 9 * * *` UTC)**.

---
*System is frozen, fully synchronized, committed, and pushed to both GitHub repositories.*
