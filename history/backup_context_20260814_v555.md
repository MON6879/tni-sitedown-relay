# Backup Context v555 - Elimination of Parallel Telethon Session Conflict & Simplified Architecture Audit

> **Timestamp:** 14/08/2026 08:21 MMT  
> **Version:** v555  
> **Target:** Solved Telethon Session conflict caused by parallel execution of `botlookup_relay.py` in both `train_5min.yml` and `botlookup_relay.yml`. Standardized `botlookup_relay.yml` as the 100% exclusive owner.  

---

## 🎯 Architecture Audit & Fixes (v555)

1. **Role Clarification (Who does what?)**:
   - **GitHub Actions (`botlookup_relay.py`)**: Acts purely as the "Mail Carrier". Uses Telethon user `@Phongha79` to send `/down_tni` to NOCPRO, waits 35s for reply text, and forwards POST payload to GAS Webhook.
   - **Google Apps Script (`site_down_v2.gs`)**: Acts as the "Brain & Transmitter". Ingests POST payload, pastes data to Row 2 Column A of Google Sheet `Input Site down Telegram`, filters sites, and dispatches red-text alarm reports to Telegram groups.

2. **Elimination of Parallel Telethon Session Contention**:
   - Discovered that both `train_5min.yml` (Train 1) and `botlookup_relay.yml` (Train 2) were executing `python botlookup_relay.py --force` simultaneously when cron triggers overlapped, causing Telegram API to return session locks.
   - Removed `botlookup_relay.py` execution block from `train_5min.yml`. Now `botlookup_relay.yml` is the 100% single, dedicated exclusive executor without any parallel session competition!

3. **Spam & Flooding Prevention (Circuit Breakers)**:
   - **Python Circuit Breaker (`botlookup_relay.py`)**: Pauses new requests if 3 consecutive `/down_tni` commands return no response from NOCPRO.
   - **GAS Circuit Breaker (`site_down_v2.gs`)**: Computes MD5 hash of response text. If data is identical to previous cycle, GAS skips Telegram dispatch to avoid spamming staff.
