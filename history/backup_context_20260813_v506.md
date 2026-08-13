# Backup Context v506 - Seat Identification & Elimination of BOD Assign "- : -" Message Spam

> **Timestamp:** 13/08/2026 08:50 MMT  
> **Version:** v506  
> **Target:** Identify exact Seat for Image 3 (Chuyến Tàu #1 — Toa #1 — Ghế #4b), and eliminate dummy "- : -" message spam in daily_bod_assign_notify.gs  

---

## 🎯 System Fixes & Improvements (v506)

1. **Exact Seat Identification (Image 3)**:
   - **Chuyến Tàu**: **Chuyến Tàu Số #1** (`phonghdpxd-cmd/tni-bot`).
   - **Toa Tàu**: **Toa Số #1** (`cron_send.py` — Báo cáo Daily Task & Backlog).
   - **Ghế Số**: **Ghế Số #4b** (`📓 Report 4b. Full Detail WO & Task`).

2. **Root Cause & Fix for Images 1 & 2 Flashing / Spamming at 08:18, 08:20, 08:48**:
   - Google Apps Script Cloud Trigger `checkBodAssign()` in `daily_bod_assign_notify.gs` ran every 2 minutes.
   - When task content was blank, `${colA} - ${colB}: ${colC}` produced `"- : -"`, triggering continuous delete & resend loops every 2 minutes (`08:18`, `08:20`, `08:48`).
   - Added strict validation `if (!colC && (!colR || colR === "- : -")) continue;` to skip dummy tasks completely.
