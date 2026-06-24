# TNI Bot — Agent Rules

## Project Context
This is the **TNI Telegram Bot System** for TNI Technica Department.
Full documentation: see `SYSTEM_DOC.md` in root.

## Key Rules
1. **All user-facing messages (Telegram) must be in English.** Code comments can be Vietnamese.
2. **Team member lists** come from Google Sheet column E, rows 4-59. Do NOT use Telegram group participants for team groups.
3. **Deduplication by name** is required when listing team members.
4. **Team 5 is merged into Team 2** (same Telegram group).
5. **Read Window** for Note messages: 18:00–20:00 Myanmar only.
6. **3Day format:** `d2/d1/d0` (day-before-yesterday / yesterday / today).
7. **Per-person stats** are required for both Search and Note Read reports.
8. **CONTROL group** receives consolidated reports (all teams).
9. **Team groups** receive only their own team's data.
10. `apps_script_collector.js` is a LOCAL copy. Must be manually deployed via Google Apps Script Editor.

## File Mapping
| File | Purpose | Trigger |
|---|---|---|
| `cron_send.py` | Daily Task + Asset + Search reports | 17:30 Myanmar via GitHub Actions |
| `daily_read_report.py` | Note read tracking per-person | 20:30 Myanmar via GitHub Actions |
| `apps_script_collector.js` | Data source (local copy of GAS) | Manual deploy |
| `SYSTEM_DOC.md` | Full system documentation | Reference |

## Telegram Groups
- T1: `-5180992881` (Dawei)
- T2: `-5188855349` (Myeik + Team5)
- T3: `-5183480727` (Bokpyin)
- T4: `-5238696719` (Kawthoung)
- CONTROL: `-5251698940`

## Do NOT
- Remove existing code comments
- Change group chat IDs without user confirmation
- Send duplicate messages (check before adding new sends)
- Use `get_participants()` for team member lists (use sheet data instead)
