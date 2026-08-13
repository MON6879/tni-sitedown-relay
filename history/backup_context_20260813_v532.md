# Backup Context v532 - Fix Ghế TNI vs Ghế INFO Routing Distinction & Fallback

> **Timestamp:** 13/08/2026 17:44 MMT  
> **Version:** v532  
> **Target:** Fix Ghế INFO (Info: TNIxxxx) fallback routing when construction search returns missing error, and distinguish Ghế TNI (TNIxxxx) quick summary vs Ghế INFO full infrastructure details  

---

## 🎯 System Fixes (v532)

1. **Ghế INFO Fallback Fix (`action == "INFO"`)**:
   - In `api/search_bot.py`, fixed condition check so that if `lookup_construction_site(tni)` returns missing error starting with `❌`, it seamlessly falls back to `perform_unified_tni_search(tni, full_info=True)`.
   - Now `Info: TNI0051`, `info: tni0051`, `INFO: TNI0051`, and `/info TNI0051` all return full detailed Site Info, Cable, GPON, and DIA infrastructure details.

2. **Ghế TNI Quick Summary Distinction (`action == "TNI"`)**:
   - Updated `perform_unified_tni_search(tni, full_info=False)` so that typing `TNI0051` outputs quick Task & WO summary.
