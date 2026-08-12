# Backup Context v491 - Eliminate Duplicate Relay Triggers

> **Timestamp:** 13/08/2026 06:29 MMT  
> **Version:** v491  
> **Target:** Disable duplicate cron in botlookup_relay.yml and remove FORCE_RUN flag to guarantee exactly 1 execution per 30m window  

---

## 🎯 Fix Breakdown (v491)

1. **Eliminated Duplicate Workflows**:
   - Disabled standalone cron in `.github/workflows/botlookup_relay.yml`.
   - `train_5min.yml` is now the SOLE master scheduler executing `botlookup_relay.py` at `:03` and `:33` MMT.

2. **Cleaned Execution Triggers**:
   - Removed `FORCE_RUN=1` environment trigger in `botlookup_relay.py`.
   - Strictly enforces window check `(3 <= m <= 8) or (33 <= m <= 38)`.
