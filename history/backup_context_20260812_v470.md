# Backup Context v470 - Restore Team 3 Bokpyin in Site Down Summary Message

> **Timestamp:** 12/08/2026 19:17 MMT  
> **Version:** v470  
> **Target:** Fix missing Team 3 Bokpyin in Control Site summary report (Tin 2 SUMMARY)  

---

## 🎯 Root Cause & Fix (v470)

1. **Root Cause**:
   - In `apps_script_refuel_proj/site_down_v2.gs.js`, Team 3 Bokpyin line in `buildAwAzControlMessage()` was commented out with `//`:
     ```javascript
     // { key: "T3", label: "Team 3 Bokpyin", emoji: "🟢", col: 2 },
     ```
   - This caused the automated Site Down summary report (Tin 2 SUMMARY) sent to `5 TNI TECHNICA DEP CONTROL SITE` to skip Team 3 completely and jump directly from Team 2 to Team 4.

2. **Fixes Applied**:
   - Uncommented Team 3 Bokpyin (`{ key: "T3", label: "Team 3 Bokpyin", emoji: "🟢", col: 2 }`) in `buildAwAzControlMessage()`.
   - Unified standard team emojis:
     - 🟠 Team 1 Dawei
     - 🔵 Team 2 Myeik
     - 🟢 Team 3 Bokpyin
     - 🟡 Team 4 Kawthoung
   - Synced code across `apps_script/site_down_v2.gs`, `apps_script_refuel_proj/site_down_v2.gs.js`, and `tni_site_down_repo/site_down_v2.gs`.
