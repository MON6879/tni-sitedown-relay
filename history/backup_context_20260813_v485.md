# Backup Context v485 - Fix Team Leader Plan Collection Hijacking

> **Timestamp:** 13/08/2026 05:39 MMT  
> **Version:** v485  
> **Target:** Eliminate Site Down Relay HTTP timeout hijacking on Team Leader Daily Plan messages  

---

## 🎯 Root Cause & Fix (v485)

1. **Root Cause**:
   - Team Leader Daily Plan templates contain keywords like `"Site down"`, `"Cell down"`, `"DG abnormal"`, `"DG run>16h"`.
   - The Site Down V2 Relay block in `api/search_bot.py` was intercepting these plan messages and executing a 15-second synchronous HTTP POST to Apps Script.
   - The 15-second HTTP POST timed out, causing Vercel to terminate the execution before reaching `is_daily_plan`.

2. **Fix Implemented**:
   - Added `not is_daily_plan(text)` guard condition before Site Down V2 Relay execution.
   - Reduced Site Down Relay HTTP timeout from `15s` to `3s`.
   - Strengthened `is_daily_plan()` regex detection to catch all Team Plan variations.
