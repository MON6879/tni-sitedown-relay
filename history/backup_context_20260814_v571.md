# Backup Context v571 - Site Down Relay Deadlock Fix & :06/:36 Schedule Verification

> **Timestamp:** 14/08/2026 11:01 MMT  
> **Version:** v571  
> **Target:** Audited and resolved the Site Down Relay pipeline failure (`botlookup_relay.py` and `.github/workflows/botlookup_relay.yml` in repo `MON6879/tni-sitedown-relay`).  

---

## 🎯 Master Architectural Fix (v571)

1. **Root Cause Analysis & Deadlock Elimination**:
   - **Circuit Breaker Deadlock**: `newest_cmd_age_min < 35` was previously blocking subsequent runs if 3 commands failed. Because 30-minute schedule runs occur before 35 minutes elapse, it resulted in a permanent deadlock loop where no new `/down_tni` command was ever sent to test recovery.
   - **Fix**: Adjusted deadlock timeout threshold to `< 20` minutes. If 20 minutes elapse without a response, the system automatically sends a probe command to self-heal and resume relaying.

2. **Cron Schedule Verification**:
   - Schedule in `.github/workflows/botlookup_relay.yml` updated to `- cron: '6,36 * * * *'` (executing at `:06` and `:36` MMT every hour).

3. **HTTP Webhook Redirection**:
   - Added `allow_redirects=True` to GAS POST webhook request.

4. **Repos Pushed**:
   - `MON6879/tni-sitedown-relay` (Commit [`b8c0f53`](https://github.com/MON6879/tni-sitedown-relay/commit/b8c0f53))
   - `phonghdpxd-cmd/tni-bot` (Commit [`3da71a2`](https://github.com/phonghdpxd-cmd/tni-bot/commit/3da71a2))
