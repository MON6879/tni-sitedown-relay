# Backup Context v546 - Dedicated Fast Workflow Dispatch Trigger for Botlookup Relay

> **Timestamp:** 14/08/2026 06:47 MMT  
> **Version:** v546  
> **Target:** Enable dedicated isolated workflow execution (`botlookup_relay.yml`) with `repository_dispatch` trigger so Site Down Relay executes instantly without waiting for other report steps  

---

## 🎯 System Fixes (v546)

1. **Isolated Fast Workflow Trigger**:
   - Updated `.github/workflows/botlookup_relay.yml`: Enabled `repository_dispatch: types: [botlookup_relay, site_down_relay]`.
   - Bypasses multi-step queue delays in `train_5min.yml`. Runs `python botlookup_relay.py --force` as a dedicated standalone job finishing in under 30 seconds.
