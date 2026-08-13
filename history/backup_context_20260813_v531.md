# Backup Context v531 - Fix Cron Schedule 1/5 & Search Bot TOKEN Fallback

> **Timestamp:** 13/08/2026 17:37 MMT  
> **Version:** v531  
> **Target:** Shift train_5min.yml cron from 3/5 to 1/5 (:06, :11, :16, :21, :26, :31, :36, :41, :46, :51, :56, :01 MMT) and add hardcoded TOKEN fallback for Search Bot @SEARCHTNITASKWOBOT  

---

## 🎯 System Fixes (v531)

1. **Shifted `train_5min.yml` Cron to `1/5 * * * *`**:
   - Changed cron from `3/5 * * * *` to `1/5 * * * *` in `.github/workflows/train_5min.yml`.
   - Now triggers at `:06`, `:11`, `:16`, `:21`, `:26`, `:31`, `:36`, `:41`, `:46`, `:51`, `:56`, `:01` MMT, completely eliminating all minute 3 ticks forever!

2. **Added Hardcoded TOKEN Fallback for `@SEARCHTNITASKWOBOT`**:
   - Updated `TOKEN` in `api/search_bot.py` with fallback to `8606383435:AAEstcN4Om6_9ZAjs4OoFV2uVlRALgae2Ac`.
   - Prevents `TELEGRAM_TOKEN missing` error on Vercel, ensuring search queries (`TNI0051`, `Info: TNI0051`, `TNI0406`) immediately reply in Telegram groups.
