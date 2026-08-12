# Backup Context v471 - Upgrade Apps Script Timeout & Retries for Report 4 and Asset 3.1

> **Timestamp:** 12/08/2026 20:20 MMT  
> **Version:** v471  
> **Target:** Resolve Google Apps Script read timeout on get_report_data and restore Report 4 + Asset 3.1 delivery  

---

## 🎯 Root Cause & Fix (v471)

1. **Root Cause**:
   - `get_report_data()` in `cron_send.py` had a short timeout of 35s (`timeout=35`).
   - When Google Apps Script compiled large sheet ranges during peak hours, response time hit ~40s, triggering an HTTP Timeout.
   - This caused `get_report_data()` to fail silently and return `{}` (empty), preventing `cron_send.py` from generating Report 4, Report 4b, and Asset 3.1 messages.

2. **Fixes Applied**:
   - Upgraded `call_apps_script()` in `cron_send.py` to `timeout=120` and `retries=3` with exponential retry backoff.
   - Upgraded `get_report_data()` and `get_asset_stats()` to use `timeout=120, retries=3`.
   - Verified live execution: Output status `ok`, successfully delivered Report 4, 4b, and Asset 3.1 to Control Site and all 4 team groups.

3. **Live Output Log**:
   - Saved `CRON_ASSET_CONTROL`: `10342`
   - Saved `CRON_ASSET_MYT_TNI_TEAM01_Dawei`: `2729`
   - Saved `CRON_ASSET_MYT_TNI_TEAM02_Myeik`: `2436`
   - Saved `CRON_ASSET_MYT_TNI_TEAM03_Bokpyin`: `2295`
   - Saved `CRON_ASSET_MYT_TNI_TEAM04_Kawthoung`: `2177`
