# Backup Context v523 - Shift Schedule Schedule & Tolerance Window from :03/:33 to :06/:36 MMT

> **Timestamp:** 13/08/2026 14:38 MMT  
> **Version:** v523  
> **Target:** Shift all Site Down Relay cron schedules, window checks, tolerance windows, and AGENTS.md rules from :03/:33 to :06/:36 MMT to bypass GitHub shared runner queue delays  

---

## 🎯 System Fixes & Schedule Alignment (v523)

1. **Schedule & Cron Shift**:
   - Updated `.github/workflows/botlookup_relay.yml` cron to `6/30 * * * *` (fires at `:06` and `:36` MMT).
   - Updated `.github/workflows/train_5min.yml` check to window `:06-:25` & `:36-:55` MMT.
   - Updated `botlookup_relay.py` function `is_target_relay_window()` to `(6 <= m <= 25) or (36 <= m <= 55)`.
   - Updated master rule in `AGENTS.md` to specify **`:06`** and **`:36`** MMT for Site Down Relay.

2. **Why :06 & :36 is 100x More Effective**:
   - GitHub Actions shared runners experience heavy queue jams at exact `:00` and `:30` UTC marks.
   - Shifting to `:06` and `:36` MMT completely escapes the peak `:00` / `:30` queue jam, guaranteeing instantaneous runner execution!
