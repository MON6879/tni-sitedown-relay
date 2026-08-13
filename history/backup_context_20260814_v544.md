# Backup Context v544 - Enforce Exact 2-Key Matching for Site Down Relay

> **Timestamp:** 14/08/2026 06:16 MMT  
> **Version:** v544  
> **Target:** Standardize Pre-Check in `botlookup_relay.py` to match EXACTLY the 2 required keys: `"auto report nocpro"` AND `"site down (not include long time site down)"` / `"site down"`  

---

## 🎯 System Fixes (v544)

1. **Exact 2-Key Matching**:
   - Updated `botlookup_relay.py` Pre-Check line 138:
     ```python
     if "auto report nocpro" in txt and ("site down (not include long time site down)" in txt or "site down" in txt):
         auto_reports.append(msg)
     ```
   - Live tested at 06:16 MMT: Matched 1981-character report from `@auto_nocpro_bot`, wrote 38 lines to Column A (`Input Site down Telegram`), and successfully sent `sent_tin1: true`.
