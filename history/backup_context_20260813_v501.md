# Backup Context v501 - Removal of Force Flags & Enforced Strict Relay Schedule

> **Timestamp:** 13/08/2026 07:48 MMT  
> **Version:** v501  
> **Target:** Remove --force overrides to ensure Site Down Relay ONLY sends at strict :03 and :33 minute windows  

---

## 🎯 System Fixes & Improvements (v501)

1. **Strict Schedule Enforcer**:
   - Removed `--force` and `workflow_dispatch` overrides from `is_target_relay_window()` in `botlookup_relay.py`.
   - The relay script now strictly checks `(3 <= m <= 8) or (33 <= m <= 38)` MMT. Off-schedule triggers at times like `07:29` are 100% blocked and eliminated.
