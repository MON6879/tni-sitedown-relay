# Backup Context v512 - Live Verification & Execution of Site Down Relay

> **Timestamp:** 13/08/2026 11:25 MMT  
> **Version:** v512  
> **Target:** Verify live Site Down Relay execution and forward response from @auto_nocpro_bot to Control group  

---

## 🎯 Master Relay Execution Summary (v512)

1. **Live Trigger Verification**:
   - Telethon authenticated cleanly as `@Phongha79`.
   - Sent `/down_tni@auto_nocpro_bot` to `BOT LOOKUP` group.
   - Waited 35s smart retry delay.
   - Captured 1,327-character response from `@auto_nocpro_bot`.
   - Forwarded payload to Apps Script webhook (`store_site_down`): **HTTP 200 OK** `{"status":"ok","lines":26,"sheet":"Input Site down Telegram","sent_tin1":true}`.
   - Successfully relayed report to `5 TNI TECHNICA DEP CONTROL SITE`.

2. **Code Updates**:
   - Added `FORCE_RUN` environment variable and `--force` CLI argument support to `is_target_relay_window()` in `botlookup_relay.py`.
