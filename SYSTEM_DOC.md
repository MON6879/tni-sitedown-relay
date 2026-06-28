# TNI Bot System Documentation
> **Last Updated:** 24/06/2026 21:49 Myanmar  
> **Maintainer:** Phong Ha Duc  
> **Repo:** github.com/phonghdpxd-cmd/tni-bot

---

## 🏗️ Architecture Overview

```
Google Sheets (Data Source)
    ↓ CSV export / Apps Script API
cron_send.py (17:30 Myanmar)          ← GitHub Actions: daily_task.yml
    ↓ Bot API (SEND_BOT_TOKEN)
Telegram Groups (T1, T2, T3, T4, CONTROL)

daily_read_report.py (20:30 Myanmar)  ← GitHub Actions: daily_read_report.yml
    ↓ Telethon (User Account API)
Telegram Groups (per-team + consolidated to CONTROL)
```

---

## 📁 Core Files

### 1. `cron_send.py` — Daily Task Report (17:30 Myanmar)
- **Trigger:** GitHub Actions `daily_task.yml` (workflow_dispatch from GAS relay)
- **Schedule:** 17:30 Myanmar = 11:00 UTC
- **Bot:** `@TNIREPORTTASK_BOT` (SEND_BOT_TOKEN)
- **What it sends:**

#### Per Team Group (T1, T2, T3, T4):
```
𝗥𝗲𝗽𝗼𝗿𝘁 Team1 Dawei – 24/06/2026 17:30
━━━━━━━━━━━━━━━━━━━━
👤 ▸ Employee Name
  [7-day task results, WO details, alarms...]
━━━━━━━━━━━━━━━━━━━━
📦 Asset: Order: 1 /1 | Revoke: 0 /0 | ...
📅 3Day: 0/0/0 7Day: 1 Month: 1
🔍 Search: 3Day:0/0/0 7Day:0 Month:0
🔍 Search per member (X not searched today):
  ❌ Name1: 3Day:0/0/0 7Day:2 Month:8
  ✅ Name2: 3Day:1/1/1 7Day:7 Month:25
━━━━━━━━━━━━━━━━━━━━
👥 Total: 8 members
```

#### CONTROL Group (5 TNI TECHNICA DEP CONTROL SITE):
- **Asset Stats** — all teams combined with 3Day/7Day/Month
- **Summary Report** — all TL reports + Search Stats (all teams)

### 2. `daily_read_report.py` — Note Read Report (20:30 Myanmar)
- **Trigger:** GitHub Actions `daily_read_report.yml` (cron + workflow_dispatch)
- **Schedule:** 20:30 Myanmar = 14:00 UTC
- **API:** Telethon (TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION)
- **Tracks:** Who read the **Note message** ("Team leader and Staff control Site down make plan rescue Site not forgot Bring MDG or MBB")
- **Read Window:** Only counts reads between **18:00–20:00 Myanmar** per day
- **Member Source:** Sheet col E (rows 4-59) for Teams, group participants for CONTROL

#### Per Team Group (T1, T2, T3, T4):
```
👁 NOTE READ REPORT — T1
📅 24/06/2026  |  🕐 20:30
⏰ Read Window: 18:00–20:00 Myanmar
📝 Note: Team leader and Staff control Site down...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 Team Members: 8  |  ✅ Read: 6  |  ❌ Unread: 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ❌ Name1: 3Day:0/0/0  7Day:2  Month:8
  ❌ Name2: 3Day:1/1/0  7Day:5  Month:15
  ✅ Name3: 3Day:1/1/1  7Day:7  Month:25
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### CONTROL Group — Consolidated:
```
👁 NOTE READ REPORT — Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ T1  |  👥 8  |  ✅ 6  ❌ 2
  ❌ Name1: 3Day:0/0/0  7Day:2  Month:8
  ✅ Name3: 3Day:1/1/1  7Day:7  Month:25
🏷️ T2  |  👥 12  |  ✅ 10  ❌ 2
  ...
🏷️ CONTROL  |  👥 13  |  ✅ 11  ❌ 2
  ...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total: 44 members  |  ✅ Read: 37  |  ❌ Unread: 7
```

### 3. `apps_script_collector.js` — Google Apps Script Data Collector
- **Deployed as:** Web App (Google Apps Script)
- **URL:** Set in `APPS_SCRIPT_URL` secret
- **Returns JSON** with: employees, leaders, teamSummary, searchStats, taskSummary, asset data
- **Per-person search fields:** `search_today`, `search_d1`, `search_d2`, `search_week`, `search_month`
- **Per-team summary:** `today`, `d1`, `d2`, `week`, `month`
- ⚠️ **Must deploy manually** via Google Apps Script Editor → Deploy → New version

### 4. `check_read_status.py` — Quick Read Check (manual)

### 5. `daily_plan_report.py` — Daily Plan Collection & Report (17:30 Myanmar)
- **Trigger:** GitHub Actions `daily_plan_report.yml` (cron + workflow_dispatch)
- **Schedule:** 17:30 Myanmar = 11:00 UTC
- **API:** Telethon (read messages) + SEND_BOT (send reports) + Apps Script (sheet I/O)
- **Sheet:** `1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y` (cùng spreadsheet Daily Report)
- **Tab:** "Team leader assign Plan" (GID: 853981745)
- **Collects:** Any message containing "Daily Plan" from T1/T2/T3/T4 groups
- **Columns:** A=REF, B=Date, C=Team, D=Daily Plan, E=Daily Report results (B:S), F=Comparison
- **Comparison:** Extract TNI site codes from Plan vs Daily Report → done/remaining count
- **Reports:** 3Day/7Day/Month stats + Plan vs Actual comparison

#### Per Team Group (T1, T2, T3, T4):
```
📋 DAILY PLAN REPORT — Team4 Kawthoung
📅 26/06/2026  |  🕐 17:30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Plan Stats: 3Day: 1/1/1 | 7Day: 7 | Month: 25

📝 Today's Plan:
──────────
I. Hot task Rescue Cell down: TNI0052, TNI0288

📊 Plan vs Actual:
📋 Plan: 8 stations
✅ Done: 5 stations (62%)
⏳ Remaining: 3 stations
Missing: TNI0052, TNI0185, TNI0058
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### CONTROL Group — Consolidated:
```
📋 DAILY PLAN REPORT — Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ Team1 Dawei:
   Plan: 10 | Done: 8 (80%) | Remain: 2
   3Day: 1/1/1 | 7Day: 7 | Month: 25
🏷️ Team2 Myeik:
   ❌ No plan today
   3Day: 0/0/0 | 7Day: 3 | Month: 15
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total: Plan: 24 | Done: 19 (79%) | Remain: 5
📊 3Day: 1/1/1 | 7Day: 10 | Month: 40
```

- One-time check: who read last message in each group
- Uses Telethon

### 6. `backlog_send.py` — Daily Backlog Report (17:35 Myanmar)
- **Trigger:** GitHub Actions `daily_task.yml` (runs right after `cron_send.py`)
- **Schedule:** 17:35 Myanmar = 11:05 UTC
- **Bot:** `@TNIREPORTTASK_BOT` (SEND_BOT_TOKEN)
- **What it sends:**
  - **Report 2 (sent first):** Category/Description backlog details by columns K:L and M:P.
  - **Report 1 (sent second):** Task progress backlog details by columns C and D:H (appending Team 5 to Team 2).
  - **Report 3 (sent third):** Generator Materials Summary (KVA filter capacities, oil/coolant plans, stocks and differences) grouped separately by sub-team (e.g., `T3`, `T3 S1` separately), highlighting numbers > 0 with a blue indicator (`🔵`).
- **Key Features:**
  - **Message Deletion Isolation:** Deletes its own previous backlog messages (using keys like `BACKLOG_TEAM_T1`, etc.) via the Apps Script helper API before sending new ones, ensuring they are independent and not touched/deleted by `cron_send.py` (freezing).
  - **No CONTROL Group Send:** Only sends reports to the respective Team groups (T1, T2, T3, T4), never to the CONTROL group.

---

## 📡 Telegram Groups & IDs

| Group | Chat ID | Content |
|---|---|---|
| **TNI TEAM 1** (Dawei) | `-5180992881` | Per-team task report |
| **TNI TEAM 2** (Myeik, includes Team 5) | `-5188855349` | Per-team task report |
| **TNI TEAM 3** (Bokpyin) | `-5183480727` | Per-team task report |
| **TNI TEAM 4** (Kawthoung) | `-5238696719` | Per-team task report |
| **5 TNI TECHNICA DEP CONTROL SITE** | `-5251698940` | Consolidated reports |

---

## 🤖 Bots

| Bot | Username | Token Secret | Used In |
|---|---|---|---|
| **SEND_BOT** | `@TNIREPORTTASK_BOT` ("2. TNI Auto Report Daily") | `SEND_BOT_TOKEN` | cron_send.py |
| **Telethon User Account** | Personal account | `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION` | daily_read_report.py, check_read_status.py |

---

## 📊 Google Sheet Structure

**Sheet ID:** `1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8`  
**GID:** `133591305`

| Column | Field | Used For |
|---|---|---|
| **A** (col 0) | Team name (e.g., `MYT_TNI_TEAM01_Dawei`) | Team mapping |
| **B** (col 1) | Employee name | Display name |
| **C** (col 2) | Role (e.g., `team leader 1`) | TL detection |
| **E** (col 4) | Telegram Chat ID | Read tracking, search tracking |

- **Rows 4-32:** Employees (FT)
- **Rows 33-59:** Team Leaders (TL)
- **Header rows:** 1-3 (skipped)

### Team Mapping

| Sheet Team Pattern | Group Key | Group |
|---|---|---|
| `TEAM01`, `TEAM 1`, `TEAM1` | T1 | TNI TEAM 1 (Dawei) |
| `TEAM02`, `TEAM 2`, `TEAM2` | T2 | TNI TEAM 2 (Myeik) |
| `TEAM05`, `TEAM 5`, `TEAM5` | T2 | → Merged into Team 2 |
| `TEAM03`, `TEAM 3`, `TEAM3` | T3 | TNI TEAM 3 (Bokpyin) |
| `TEAM04`, `TEAM 4`, `TEAM4` | T4 | TNI TEAM 4 (Kawthoung) |

---

## ⏰ Daily Schedule (Myanmar Time)

| Time | Script | Workflow | What |
|---|---|---|---|
| **17:30** | `cron_send.py` | `daily_task.yml` | Task + Asset + Search reports to all groups |
| **17:30** | `daily_plan_report.py` | `daily_plan_report.yml` | Daily Plan collection + 3Day/7Day/Month report |
| **17:35** | `backlog_send.py` | `daily_task.yml` | Daily Backlog reports (Report 2, 1, 3) to team groups |
| **20:30** | `daily_read_report.py` | `daily_read_report.yml` | Note read status per-person to teams + CONTROL |

---

## 🔑 GitHub Secrets Required

| Secret | Used By |
|---|---|
| `SEND_BOT_TOKEN` | cron_send.py |
| `REPORT_TASK_BOT_TOKEN` | cron_send.py |
| `TECHNICAL_DEP_BOT_TOKEN` | cron_send.py |
| `APPS_SCRIPT_URL` | cron_send.py |
| `TELEGRAM_API_ID` | daily_read_report.py |
| `TELEGRAM_API_HASH` | daily_read_report.py |
| `TELEGRAM_SESSION` | daily_read_report.py |

---

## 🔧 Key Design Decisions

1. **Per-person tracking:** Both Search Stats and Note Read use per-person format with 3Day/7Day/Month
2. **3Day format:** `d2/d1/d0` = day-before-yesterday / yesterday / today
3. **Deduplication:** Team member lists deduplicate by name (keep highest search count)
4. **Read Window:** Note reads only count if read between 18:00–20:00 Myanmar (not anytime)
5. **Team members source:** Sheet col E rows 4-59 (not Telegram group participants) — ensures only actual team members are counted
6. **CONTROL gets consolidated:** All teams + CONTROL data in one message
7. **Team groups get own report:** Each team only sees their own data
8. **Note detection:** Messages matching ≥2 keywords: "team leader", "site down", "make plan", "rescue", "mdg", "mbb"
9. **All user-facing text in English** — code comments may remain in Vietnamese
10. **Team 5 merged into Team 2** group

---

## 🚀 How to Test

### cron_send.py (local):
```bash
# Requires .env with SEND_BOT_TOKEN, APPS_SCRIPT_URL
python cron_send.py
```

### daily_read_report.py (GitHub Actions only):
```
GitHub → Actions → "Daily Note Read Report (20:30 Myanmar)" → Run workflow
```
Requires: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION` in GitHub Secrets

### daily_read_report.py (local):
```bash
# Add to .env:
# TELEGRAM_API_ID=...
# TELEGRAM_API_HASH=...
# TELEGRAM_SESSION=...
python daily_read_report.py
```

---

## 📝 Workflow Files

| File | Schedule | Script |
|---|---|---|
| `daily_task.yml` | workflow_dispatch (GAS trigger) | `cron_send.py` |
| `daily_plan_report.yml` | 11:00 UTC (17:30 Myanmar) + manual | `daily_plan_report.py` |
| `daily_read_report.yml` | 14:00 UTC (20:30 Myanmar) + manual | `daily_read_report.py` |
| `botlookup_relay.yml` | — | `botlookup_relay.py` |
| `send_teams_telethon.yml` | — | `send_teams_telethon.py` |
| `check_read_status.yml` | — | `check_read_status.py` |
| `check_read_loop.yml` | — | `check_read_loop.py` |

---

## ⚠️ Important Notes

1. **Apps Script deployment:** `apps_script_collector.js` is a LOCAL copy. Changes must be manually copied to Google Apps Script Editor and re-deployed (Publish → Deploy as web app → New version)
2. **Telethon session:** The session string is a personal Telegram account login. If the session expires, generate a new one with `get_session.py`
3. **Search data = 0:** If all search values show 0, check that Apps Script is deployed with the latest version that includes per-person search fields
4. **Duplicate names:** The system deduplicates by name. If two different people have the same name, only one will show
5. **Rate limiting:** Telethon calls have 0.3s delays between API calls to avoid Telegram rate limits
