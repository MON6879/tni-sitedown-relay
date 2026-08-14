# Backup Context v558 - 09:34 MMT Live Execution & Timing Verification

> **Timestamp:** 14/08/2026 09:35 MMT  
> **Version:** v558  
> **Target:** Diagnosed why previous report was stamped `09:04` (triggered 2 min early by legacy `train_5min.yml` tick). Executed live Site Down Relay at 09:34 MMT (23 rows ingested, alarm sent to Teams 1-4).  

---

## 🎯 Master System Verification (v558)

1. **Root Cause of `09:04` Timestamp in Screenshot**:
   - The screenshot showed a report at `09:04` MMT because `train_5min.yml` ran `botlookup_relay.py` at `09:04` (2 mins before `:06`).
   - The dedup check then skipped the `:06` run because the previous run was only 2 minutes ago.
   - In commit `v555`, `botlookup_relay.py` was completely isolated into `botlookup_relay.yml`, preventing off-schedule early triggers.

2. **Live Execution Output (09:34 MMT)**:
   - Executed `python botlookup_relay.py --force` live.
   - Ingested 23 rows into Google Sheet `Input Site down Telegram`.
   - Sent fresh `09:34` MMT Site Down Alarm reports into `TNI TEAM 1 PLAN - ALARM`, `TNI TEAM 2 PLAN - ALARM`, `TNI TEAM 3 PLAN - ALARM`, `TNI TEAM 4 PLAN - ALARM`, and `5 TNI TECHNICAL`.
