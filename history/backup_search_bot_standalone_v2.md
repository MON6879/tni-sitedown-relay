# 🛡️ LOCAL BACKUP CONTEXT: TNI Search Bot v2.1 (Standalone & Frozen)
Date: 29/07/2026

## 1. Overview & Isolation
- **Bot Name:** `@SEARCHTNITASKWOBOT` (`8606383435`)
- **Server:** Vercel Cloud Serverless (`https://tni-bot.vercel.app/api/search_bot`)
- **Git Repo:** `phonghdpxd-cmd/tni-bot.git` (Branch: `main`)
- **Isolation:** 100% Isolated standalone bot. Does not share endpoints or tokens with Site Down V2 (`MON6879/tni-sitedown-relay`) or Asset Collector.

## 2. Solved Issues & Key Enhancements
1. **Local Polling Conflict Fix (`telegram_bot.py`)**:
   - Disabled local polling in `telegram_bot.py` (`sys.exit(0)` when executed locally).
   - Prevents local PC script from calling `deleteWebhook` and breaking Vercel Cloud connection when PC is turned off.
2. **Self-Healing Webhook System (`ensure_webhook_active`)**:
   - Auto-checks Webhook health every 60s. Automatically restores `https://tni-bot.vercel.app/api/search_bot` within milliseconds if wiped out by external scripts.
3. **Group Protection Rules (`all_group_chats`)**:
   - Menu in Team Groups (`TNI TEAM 1`..`4`) shows ONLY `/plan`.
   - Full team dump (`T1`..`T4`) disabled in groups to keep group chats 100% clean.
   - `Txnotclose` and `Txwaitcd` remain active for quick group lookups.
4. **Unified Command Normalizer**:
   - Automatically strips leading `/` and `@bot_username` suffix for all commands.
   - `t4notclose`, `/t4notclose`, `/t4notclose@SEARCHTNITASKWOBOT` work 100% identically.
5. **Non-Blocking GAS Logging (`log_search_bg`)**:
   - Search logging to Google Apps Script executed in detached background thread.
   - Latency reduced from ~15s to < 3s (measured at 2.86s).

## 3. Git Tags
- `v2.0-search-frozen`
- `v2.1-search-standalone-frozen`
