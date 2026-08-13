# Backup Context v541 - Fix Pre-Check Circuit Breaker Deadlock in Site Down Relay

> **Timestamp:** 13/08/2026 20:48 MMT  
> **Version:** v541  
> **Target:** Eliminate deadlock condition in botlookup_relay.py where missing NOCPro replies to third-party commands blocked automated runs indefinitely  

---

## 🎯 System Fixes (v541)

1. **Strict Ownership Check for Command Pre-check**:
   - In `botlookup_relay.py`, updated circuit breaker to ONLY count `/down_tni` commands issued directly by account `@Phongha79` (`is_mine`). Third-party user messages or malformed commands in group `BOT LOOKUP` can no longer trigger a false negative block.

2. **35-Minute Automatic Deadlock Escape**:
   - Added `newest_cmd_age_min` check: If more than 35 minutes have elapsed since the last attempt by `@Phongha79`, the system automatically breaks the pre-check lock and sends a fresh `/down_tni` request to restore data flow automatically.
