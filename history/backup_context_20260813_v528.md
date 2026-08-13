# Backup Context v528 - Clarification of Search Bot API vs Personal Account @Phongha79 Cell O1 Note Reply Architecture

> **Timestamp:** 13/08/2026 16:48 MMT  
> **Version:** v528  
> **Target:** Document clear separation between Search Bot API (@SEARCHTNITASKWOBOT) and Personal User Account (@Phongha79) Cell O1 Note Replies  

---

## 🎯 Architecture Clarification & Master Rules (v528)

1. **Search Task Routing (@SEARCHTNITASKWOBOT)**:
   - Operates on Vercel Serverless (`api/search_bot.py`) reading O(1) indexes from GAS Cache (`apps_script_collector.gs`).
   - Responds to search commands (`TNIxxxx`, `INFO: TNIxxxx`, `/find`) in 0.3-0.8s without GitHub Actions runner queue dependency.

2. **Personal User Account @Phongha79 Cell O1 Note Replies**:
   - Telethon Engine logs in as user account `@Phongha79`.
   - Reads cell **O1** from Refuel Sheet `1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM` (tab `gid=201295323`).
   - Posts a direct Note Reply under the Refuel Report in Group 9 (`9 TNI REQUEST REFUEL`), allowing Telegram API read tracking for Report 6.
