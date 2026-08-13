# Backup Context v534 - Complete Removal of Monitor Question & Strict Keyword Classification

> **Timestamp:** 13/08/2026 17:56 MMT  
> **Version:** v534  
> **Target:** Completely remove 'Who is assigned to follow and monitor ?' question from all Bot replies in Group 9, enforce strict keyword starting with 'Name of FT staff member accompanying to supervise', and ignore messages sent by Bots  

---

## 🎯 System Fixes (v534)

1. **Complete Removal of Monitor Question**:
   - Updated `api/refuel_collector.py` to 100% remove `📢 {mention_tag} Who is assigned to follow and monitor ?` from ALL Bot confirmation replies on Group 9 (`9 TNI REQUEST REFUEL`).
   - Bot replies are now 100% clean and concise (showing only category label, recorded DEF ID, and timestamp).

2. **Strict Keyword Classification (`FT_MONITOR`)**:
   - Requires exact starting phrase `Name of FT staff member accompanying to supervise` (with initial `N`).
   - Any message missing the initial `N` (e.g. `ame of FT staff...`) is strictly ignored and NOT collected.

3. **Ignore Messages from Bots**:
   - Added check `if user.get("is_bot"): return` to ignore all automated bot messages in Group 9.
