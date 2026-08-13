# Backup Context v540 - Force Execution Fix for Site Down Relay in 5-Min Train Scheduler

> **Timestamp:** 13/08/2026 19:30 MMT  
> **Version:** v540  
> **Target:** Add FORCE_RUN: '1' and --force flag to Toa Site Down Relay step in train_5min.yml to guarantee 100% automated execution  

---

## 🎯 System Fixes (v540)

1. **Enforced Site Down Relay in Unified Scheduler**:
   - In `.github/workflows/train_5min.yml`, updated line 227-228 to explicitly pass `FORCE_RUN: '1'` and execute `python botlookup_relay.py --force`.
   - Prevents `botlookup_relay.py` from evaluating window checks as empty or skipping runs when executed by the 5-min Train scheduler at `:06` and `:36` MMT.
