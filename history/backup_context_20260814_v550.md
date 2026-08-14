# Backup Context v550 - Ghế TNI & Ghế Info Clean Separation & Daily Plan False-Positive Prevention

> **Timestamp:** 14/08/2026 07:28 MMT  
> **Version:** v550  
> **Target:** Fix seat routing separation between Ghế TNI (`TNIxxxx`) and Ghế Info (`info: TNIxxxx`). Eliminate false-positive Daily Plan auto-saving for search queries.  

---

## 🎯 Architecture Fixes (v550)

1. **Clean Seat Separation (Ghế TNI vs Ghế INFO)**:
   - **Ghế `INFO` (`info: TNIxxxx` / `/info TNIxxxx`)**: Dedicated strictly to querying complete infrastructure data (Site, Cable, GPON, DIA) from tab `Name Site`. Removed legacy fallback `lookup_construction_site(tni)` call from Ghế INFO.
   - **Ghế `TNI` (`TNIxxxx` / `/tni TNIxxxx`)**: Dedicated strictly to querying Task & WO details.
   - **Ghế `CONS` (`cons TNIxxxx` / `pro TNIxxxx`)**: Dedicated strictly to Construction projects.

2. **Daily Plan Auto-Save False Positive Prevention**:
   - Added explicit search command blacklist in `is_daily_plan()` in `api/search_bot.py`.
   - Any query starting with `tni`, `info`, `clear`, `cons`, `notclose`, `waitcd` will NEVER trigger `is_daily_plan()` or auto-save into Google Sheets.

3. **Verification**:
   - Executed `python tests/test_routing.py`: All 6 test suites passed 100%.
