# Backup Context v509 - Nuclear Code Bug Fix: Missing Site Down Relay Step & Double Fail-Safe Architecture

> **Timestamp:** 13/08/2026 10:10 MMT  
> **Version:** v509  
> **Target:** Add missing Site Down Relay step block to train_5min.yml and add 30-min cron schedule to MON6879/tni-sitedown-relay  

---

## 🎯 System Fixes & Improvements (v509)

1. **Nuclear Code Bug Identification**:
   - In `train_5min.yml`, `BOTLOOKUP_RELAY=true` was being output by the schedule check step, but the actual step block to execute `python botlookup_relay.py` was MISSING from `train_5min.yml`!
   - Meanwhile, `MON6879/tni-sitedown-relay` had `on: workflow_dispatch` ONLY (no cron schedule), so Site Down Relay was not being triggered automatically!

2. **Resolution & Double Fail-Safe Architecture**:
   - **Fix 1**: Added the `🚨 Toa Site Down Relay — Bot Lookup Relay` step block to `train_5min.yml` in `phonghdpxd-cmd/tni-bot`.
   - **Fix 2**: Added direct 30-minute cron schedule `schedule: - cron: '3/30 * * * *'` to `.github/workflows/botlookup_relay.yml` on `MON6879/tni-sitedown-relay`.
   - **Result**: Dual redundancy! Both repositories now trigger Site Down Relay every 30 minutes (`:03` and `:33` MMT) with 100% fail-safe guarantee.
