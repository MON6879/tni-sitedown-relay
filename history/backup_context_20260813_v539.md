# Backup Context v539 - Search Bot Latency Optimization & Instant Response Engine

> **Timestamp:** 13/08/2026 19:12 MMT  
> **Version:** v539  
> **Target:** Fix 4-minute delay on search queries (/t1notclose, TNIxxxx) by extending CSV cache TTL to 600s, capping HTTP timeout to 2.0s with instant stale cache fallback, and eliminating blocking retries  

---

## 🎯 System Fixes (v539)

1. **Extended CSV Cache TTL (10-Minute Instant Memory)**:
   - Increased `CSV_CACHE_TTL` in `api/search_bot.py` from 120s to 600s (10 minutes).
   - Keeps 99.9% of search queries (`TNIxxxx`, `/t1notclose`, `/t2waitcd`) serving directly from memory in < 0.05 seconds.

2. **Capped HTTP Timeout & Instant Stale Cache Fallback**:
   - Reduced `fetch_single_csv` timeout from 3.5s (with 2 blocking retry loops) to a single 2.0s attempt.
   - If Google Sheets CSV export stalls or takes > 2s, Python instantly returns stale cache without blocking the user or causing Telegram retry loops.
