# Backup Context v559 - Forensic Root Cause Fix: FORCE_RUN Bypass in botlookup_relay.py

> **Timestamp:** 14/08/2026 09:41 MMT  
> **Version:** v559  
> **Target:** Root cause resolution for automated scheduled runs failing to send `/down_tni` command. Made `FORCE_RUN` / `--force` completely bypass all pre-check blocking conditions.  

---

## 🎯 Master Architectural Resolution (v559)

1. **Root Cause Analysis**:
   - The user correctly observed: *"Every time you activate it manually, it runs immediately, proving GitHub is not congested! The issue is that automated runs fail to send the fetch command!"*
   - Forensic analysis of `botlookup_relay.py` revealed that lines 160-164 contained a strict pre-check (`if not has_nocpro_reply_after and newest_cmd_age_min < 35: return`).
   - EVEN WHEN `botlookup_relay.yml` passed `--force` and `FORCE_RUN=1`, line 162 did NOT check the force flag! When `has_nocpro_reply_after` evaluated to False, `botlookup_relay.py` silently returned early without sending `/down_tni`!

2. **The 1% Permanent Fix**:
   - In `botlookup_relay.py`: Made `force_mode` (`FORCE_RUN=1` or `--force`) completely bypass all pre-check blocks.
   - Now automated scheduled runs on GitHub Actions will ALWAYS force-send `/down_tni` unconditionally, behaving 100% identically to manual expert activation!
