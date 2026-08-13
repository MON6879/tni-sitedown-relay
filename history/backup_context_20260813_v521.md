# Backup Context v521 - Separation of Ghế TNI (Quick Summary) vs Ghế INFO (Full Detailed Construction Info)

> **Timestamp:** 13/08/2026 14:15 MMT  
> **Version:** v521  
> **Target:** Separate routing between Ghế TNI (Quick Summary) and Ghế INFO (Full Construction Infrastructure Details) in search_bot.py  

---

## 🎯 System Fixes & Architecture Separation (v521)

1. **Routing & Seat Separation**:
   - Fixed the issue where typing `INFO: TNIxxxx` or `info: tni0406` was returning the exact same quick summary response as `TNI0406`.
   - **Ghế TNI (`TNIxxxx`)**: Routes to `perform_unified_tni_search()` -> Returns quick summary of Alarm status, Task/WO count, FT name, Solar/DG, and MW Link.
   - **Ghế INFO (`INFO: TNIxxxx` / `info: tni0406`)**: Routes to `lookup_construction_site()` -> Returns full detailed construction & technical infrastructure specifications (cables, power, cabinets, maintenance history, coordinates).
