# Backup Context Snapshot — Version 465 (2026-08-12)

## Overview & Unification of Delete-Old Mechanism (v465)

### Unified Delete-Old-Send-New Protocol Across All Teams & Control Group:
- **Files Modified**:
  1. `Task and WO/backlog_send.py`:
     - Added Telethon `delete_by_title_telethon()` scanning before sending reports for all team groups (Teams 1, 2, 3, 4).
     - Scans and deletes all 5 report titles (`📋 1. Report — Daily Backlog`, `📋 2. Report — Daily Backlog`, `📋 3. Report — Main DG Material Need`, `📋 4. Report — Daily EOD Task & Stats`, `📓 4b. Full Report`).
     - Enhanced GAS fallback to delete across multi-keys (`BACKLOG_TEAM_Tx`, `CRON_TEAM_Tx`, `CRON_ASSET_Tx`).
     - Dual-saves new message IDs to both `BACKLOG_TEAM_Tx` and `CRON_TEAM_Tx` to ensure cross-script deletion compatibility.
  2. `Task and WO/cron_send.py`:
     - Updated `delete_tasks` list in Telethon scan to include all Backlog and Plan report titles for all Team groups (`T1`, `T2`, `T3`, `T4`) AND Control Group (`CONTROL_CHAT_ID`).
     - Enhanced GAS fallback delete to wipe both `CRON_TEAM_Tx` and `BACKLOG_TEAM_Tx`.

### Verification & Deployment Status
- Python syntax compilation: PASSED (0 errors).
- All changes pushed to GitHub `phonghdpxd-cmd/tni-bot` main branch.
- Chuyến Tàu / Toa / Ghế: Chuyến tàu Số #1, #2, #3, #4 (Teams 1-4) & Chuyến tàu Control — Toa #1 đến #4 — Ghế F-D1 (Unified Delete-Old Protocol).
