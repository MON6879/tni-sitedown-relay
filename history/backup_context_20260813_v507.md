# Backup Context v507 - Expand Site Down Relay Tolerance Window to :03-:12 and :33-:42 MMT

> **Timestamp:** 13/08/2026 09:41 MMT  
> **Version:** v507  
> **Target:** Expand Site Down Relay window from :03-:08 / :33-:38 to :03-:12 / :33-:42 MMT to tolerate GitHub Actions runner delays up to 9 minutes  

---

## 🎯 System Fixes & Improvements (v507)

1. **Root Cause Analysis for Delayed/Skipped Site Down Runs**:
   - Shared GitHub Actions runners sometimes delay scheduled executions by 5 to 7 minutes.
   - When runner started at minute 39 MMT instead of 38 MMT, the strict `:33 - :38` window rejected the run.

2. **Resolution**:
   - Expanded tolerance window in `botlookup_relay.py` and `train_5min.yml` to `:03 - :12` and `:33 - :42` MMT (9-minute safety window).
   - Even if GitHub Actions runner delays by 5-7 minutes, Site Down Relay WILL ALWAYS RUN AND NEVER MISS A SINGLE 30-MINUTE WINDOW!
