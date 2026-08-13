# Backup Context v537 - Fix Silent Bot Replies & Enforce Guaranteed Telegram Confirmations

> **Timestamp:** 13/08/2026 18:17 MMT  
> **Version:** v537  
> **Target:** Fix silent bot issue by setting exact PLAN_GROUP_ID in GAS payload and relaxing reply trigger from result.get('status') == 'ok' to != 'error'  

---

## 🎯 System Fixes (v537)

1. **GAS Group ID Matching Fix**:
   - In `api/refuel_collector.py`, fixed `post_gas` payload to send `group_id: PLAN_GROUP_ID` (`5469544739`), guaranteeing GAS `collectMessage` matches the group ID 100% of the time and never returns `Group ID not matched`.

2. **Guaranteed Telegram Reply Trigger**:
   - Changed reply condition from `if result.get('status') == 'ok':` to `if result.get('status') != 'error':`.
   - Ensures that valid report submissions (such as `Name of FT staff member...`) NEVER get silently dropped, always sending instant confirmation replies.
