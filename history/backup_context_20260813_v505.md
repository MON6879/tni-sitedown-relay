# Backup Context v505 - Fix 5-Min Train Repeated Loop Spammers (DIFF <= 2)

> **Timestamp:** 13/08/2026 08:18 MMT  
> **Version:** v505  
> **Target:** Fix check_time window in train_5min.yml from DIFF <= 35 to DIFF <= 2 so each report runs EXACTLY ONCE at its scheduled time  

---

## 🎯 System Fixes & Improvements (v505)

1. **Root Cause Analysis**:
   - `check_time()` in `.github/workflows/train_5min.yml` had `[ $DIFF -le 35 ]`.
   - Because `train_5min.yml` runs every 5 minutes (`3/5 * * * *`), `DIFF <= 35` caused reports (like BOD Assign `📋 BOD assign New task`) to trigger repeatedly every 5 minutes for 35 minutes!

2. **Resolution**:
   - Updated `check_time()` window to `[ $DIFF -le 2 ]`.
   - Reports now trigger **EXACTLY ONCE** at their scheduled target time (e.g. `05:48`, `06:03`, `07:03`, `08:28`, `15:48` MMT) and will never spam continuously every 5 minutes.
