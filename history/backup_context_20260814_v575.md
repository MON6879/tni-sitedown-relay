# Backup Context v575 - Site Down Relay GAS Dispatch Repo URL Fix

> **Timestamp:** 14/08/2026 12:24 MMT  
> **Version:** v575  
> **Target:** Audited and resolved the root cause of Site Down relay failure following the old system migration/split. Updated `site_down_v2.gs` dispatch URL to point to `MON6879/tni-sitedown-relay`.  

---

## 🎯 Master Architectural Fix (v575)

1. **Root Cause Analysis**:
   - When the Site Down relay repository was migrated to `MON6879/tni-sitedown-relay`, the Google Apps Script dispatch trigger `triggerBotlookupRelay()` in `site_down_v2.gs` was still making HTTP POST requests to `phonghdpxd-cmd/tni-bot/actions/workflows/botlookup_relay.yml/dispatches`.
   - This resulted in 404 Not Found errors on every dispatch attempt, preventing GAS from auto-triggering the relay scraper.

2. **GAS Code Update (`site_down_v2.gs`)**:
   - Updated GitHub API dispatch URL to:
     `https://api.github.com/repos/MON6879/tni-sitedown-relay/actions/workflows/botlookup_relay.yml/dispatches`
   - Added dual dispatch fallback to `train_5min.yml`.

3. **Files Updated**:
   - `QLTC_GAS/site_down_v2.gs`
   - `history/backup_context_20260814_v575.md`
