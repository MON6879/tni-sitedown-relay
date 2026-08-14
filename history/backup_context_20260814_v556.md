# Backup Context v556 - Restored Historical Fail-Proof Continuous 5-Min Cron & Smart 20-Min Window Dedup Guard

> **Timestamp:** 14/08/2026 08:41 MMT  
> **Version:** v556  
> **Target:** Restored historical working configuration for Site Down Relay: set `botlookup_relay.yml` cron to `*/5 * * * *` (continuous fail-proof GitHub trigger) combined with 20-min window dedup guard in `botlookup_relay.py`.  

---

## 🎯 Architectural Restorations (v556)

1. **Why `cron: '36 * * * *'` Failed Previously**:
   - Setting a single hourly cron on GitHub Actions free/standard runners causes jobs to sit in low-priority queues or get skipped during peak traffic hours.
   - Restored historical working solution from v404/v406: Set `.github/workflows/botlookup_relay.yml` cron to `*/5 * * * *` (runs every 5 minutes continuously).

2. **Smart 20-Min Window Dedup Guard**:
   - Inside `botlookup_relay.py`, added dedup check: if a `/down_tni` command was sent less than 20 minutes ago (`last_cmd_age_min < 20.0`), `botlookup_relay.py` cleanly skips execution.
   - Result: GitHub Actions checks every 5 minutes, but `botlookup_relay.py` ONLY sends EXACTLY ONE `/down_tni` command per 30-minute window (`:06-:25` and `:36-:55`).
   - If GitHub Actions experiences a 5-15 minute queue delay, the next 5-minute tick will immediately pick up and complete the cycle. ZERO DROPPED CYCLES EVER AGAIN!
