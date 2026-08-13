# Backup Context v518 - Fix Double Header in Search Bot NotClose & WaitCD Commands

> **Timestamp:** 13/08/2026 13:15 MMT  
> **Version:** v518  
> **Target:** Fix double header bug in /t1notclose and /t1waitcd commands in search_bot.py  

---

## 🎯 System Fixes (v518)

1. **Double Header Bug Fix**:
   - In `api/search_bot.py`, `lookup_notclose()` and `lookup_waitcd()` ALREADY generate their own clean header (`CD NOT YET CLOSE WOs: T1 (7)`).
   - In the route handler, a second header (`📑 T1 NOT CLOSE (1 WOs)`) was being prepended over `lookup_notclose` output, resulting in duplicate headers.
   - Removed the outer header wrapper so that messages render cleanly with a single, clear header.
