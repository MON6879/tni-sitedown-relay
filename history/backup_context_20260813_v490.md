# Backup Context v490 - Master Sync & Dual Discrimination Rules

> **Timestamp:** 13/08/2026 06:26 MMT  
> **Version:** v490  
> **Target:** Full system backup after implementing Dual Discrimination for Daily Plan vs Daily Result, Auto-Sync to Column E & F of Plan tab, and master schedule updates.

---

## 🎯 Master Architecture Summary (v490)

1. **Daily Plan (Team Leaders)**:
   - Pattern: Starts with/Contains `Daily Plan: DD/MM/YYYY`, `Team 1..4`, `I. Hot task`.
   - Handler: `store_daily_plan_to_sheet()`.
   - Target Tab: `Team leader assign Plan` (Column D).

2. **Daily Result (Field Engineers FTs)**:
   - Pattern: Contains `Daily result: DD/MM/YYYY`, `2. Transportation Used 🚙`, `3. Detail WO:`, `4. Detail task:`.
   - Exclusive: Blocked 100% if `is_daily_plan(text)` is True.
   - Target Tab: `Daily report and Bussiness` (Row 2, newest first).
   - Auto-Sync: `syncResultToPlanTab_()` transfers results to Column E (`Daily Report`) & Column F (`Comparison`) of `Team leader assign Plan` tab.

3. **Master Sending Schedule**:
   - Report 1-4c + Note: `05:48 AM` & `15:48 PM`.
   - Report 5 Morning: `06:03 AM`.
   - Report 5 EOD Comparison: `18:38 PM`.
   - Report 5 Update: `19:08 PM`.
   - Report 6 Read Status: `08:48 AM`, `14:58 PM`, `19:38 PM`.
   - Refuel Plan: `13:08 PM` & `20:43 PM`.
   - Site Down Relay: `:03` & `:33` every hour.
