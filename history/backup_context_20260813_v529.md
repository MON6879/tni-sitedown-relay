# Backup Context v529 - Elimination of Refuel Sheet O1 Leak into Team Groups (cron_send.py)

> **Timestamp:** 13/08/2026 17:06 MMT  
> **Version:** v529  
> **Target:** Fix get_control_note_from_sheet() in cron_send.py so that cell O1 from Refuel Sheet is ONLY sent in Group 9, never leaking into Teams 1-4  

---

## 🎯 System Fixes (v529)

1. **Eliminated Note Leak into Team Groups**:
   - Fixed `get_control_note_from_sheet()` in `cron_send.py`. Previously, it fetched cell O1 from Refuel Sheet (`1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM`), causing `@Raja HO @Sunil...` to be posted as Note reply under Report 4d in Team groups 1-4.
   - Updated `cron_send.py` to read Note strictly from Master Sheet Config tab (Column G / Column H of `1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8`).

2. **Group 9 Refuel Note Verified Correct**:
   - Confirmed that Cell O1 Note reply (`@Raja HO @Sunil...`) belongs EXCLUSIVELY to Group 9 `9 TNI REQUEST REFUEL`, where it posts correctly under the Refuel Report.
