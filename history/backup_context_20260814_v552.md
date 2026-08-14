# Backup Context v552 - Full 7-Step LƯU ĐI Master Snapshot

> **Timestamp:** 14/08/2026 07:37 MMT  
> **Version:** v552  
> **Target:** Final comprehensive snapshot of ICT Auto Fetch credential fix (`TNI View`), Search Bot Auto Self-Healing Insurance, Ghế TNI / INFO / CONS clean separation, and Site Down Relay Cron Explicit Fix (:06 and :36 MMT).  

---

## 🎯 Master System Summary (v552)

1. **ICT Auto Fetch (ZTE NetNumen)**:
   - Updated `.env` in `ICT Fetch`: `INTERNAL_USER=TNI View`, `INTERNAL_PASS=Maitruong3011@`.
   - Direct navigation to `newsitescreen.html` in `auto_fetch_ict.py`.
   - Live verified at 07:17 MMT: Downloaded 189 rows, shifted historical columns (A:W -> Y:AU -> AW:BS), updated W1 cell timestamp to `14/08/2026 07:17`, generated 37 diff rows, and sent summary to Telegram.

2. **Search Bot (@SEARCHTNITASKWOBOT)**:
   - Webhook URL locked & verified: `https://tni-bot.vercel.app/api/search_bot`.
   - Added 24/7 Auto Self-Healing Insurance `autoEnforceSearchBotWebhook()` in `daily_report_collector.gs`.
   - Separated Ghế TNI (`TNI0019` -> Task/WO), Ghế INFO (`info: TNI0019` -> Infrastructure Site/Cable/GPON/DIA), and Ghế CONS (`cons TNI0019` -> Construction).
   - Added blacklist guard in `is_daily_plan()` to prevent search queries from auto-saving into Google Sheets.

3. **Site Down Relay (Botlookup Relay)**:
   - Updated cron schedule in `.github/workflows/botlookup_relay.yml` to explicit `36 * * * *` (:06 MMT) and `6 * * * *` (:36 MMT).
   - Live verified at 07:31 MMT: Sent `/down_tni` to NOCPRO, ingested 29 rows into `Input Site down Telegram`, and dispatched fresh alarm reports to Teams 1-4.
