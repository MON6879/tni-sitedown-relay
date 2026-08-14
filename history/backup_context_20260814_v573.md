# Backup Context v573 - Restored 100% Direct Send Pipeline Matching Original Code

> **Timestamp:** 14/08/2026 12:00 MMT  
> **Version:** v573  
> **Target:** Restored the original, fail-proof 100% Direct Send Pipeline in `botlookup_relay.py` (`MON6879/tni-sitedown-relay`). Removed all intermediate pre-check conditionals that previously caused silent exits.  

---

## 🎯 Master Architectural Restoration (v573)

1. **Restored Original Direct Pipeline**:
   - `botlookup_relay.py` now directly executes `await client.send_message(source, COMMAND)` every run at `:06` and `:36` MMT without any pre-check blocks.
   - Collects `@auto_nocpro_bot` response after 35-45s delay and POSTs directly to GAS webhook URL (`store_site_down`).

2. **Repos Pushed**:
   - `MON6879/tni-sitedown-relay` (Commit [`505d8d8`](https://github.com/MON6879/tni-sitedown-relay/commit/505d8d8))
   - `phonghdpxd-cmd/tni-bot` (Commit [`505d8d8`](https://github.com/MON6879/tni-sitedown-relay/commit/505d8d8) reference)
