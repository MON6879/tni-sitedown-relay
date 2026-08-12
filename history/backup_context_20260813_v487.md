# Backup Context v487 - Prevent User Account Rate Limits & Anti-Spam Locks

> **Timestamp:** 13/08/2026 05:51 MMT  
> **Version:** v487  
> **Target:** Prioritize Bot API for deleting bot messages and add 0.4s delay for Telethon user account deletes to prevent FloodWait locks  

---

## 🎯 Account Protection Rules (v487)

1. **Bot Messages Deletion**:
   - Primary: Uses Bot API `deleteMessage`.
   - Reason: Bot API deletion does NOT use or affect user account `@Phongha79` rate limits.

2. **User Note Messages Deletion**:
   - Secondary: Uses Telethon `@Phongha79` with `revoke=True` and `await asyncio.sleep(0.4)`.
   - Reason: Prevents Telegram anti-spam algorithms from flagging rapid message deletions on `@Phongha79`.
