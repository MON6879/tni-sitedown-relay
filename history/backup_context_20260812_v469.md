# Backup Context v469 - Dynamic Target Need Complete % & Wait CD Live Sync

> **Timestamp:** 12/08/2026 09:14 MMT  
> **Version:** v469  
> **Target:** Dynamic Target Need Complete % (Cell F1) & Wait CD Total (Col F) on BI Operations Portal  

---

## 🎯 Summary of Changes (v469)

1. **Dynamic Target Need Complete Extraction (`api/bi_data.py`)**:
   - Extracted `Target Need Complete` percentage directly from Row 1 Cell F1 (`rows[0][5]`, e.g. `75%`).
   - Parsed `Wait CD Total` dynamically from Col F (`rows[52+idx][5]`) for all 4 teams instead of static defaults.
   - Extracted `% Complete` from Col I (`rows[52+idx][8]`) or fallback to `round((fot/tot)*100)`.
   - Updated `metTarget` check to compare against dynamic `targetPct` (e.g. `pct >= 75`).

2. **Frontend UI Sync (`index.html` & `executive_dashboard.html`)**:
   - Updated `applyTeam()` to render dynamic `targetPct`: e.g. `Rank #4 (18.0%/75% ❌ Not Meet Target)`.
   - Updated client CSV direct parser to extract `targetPct` and `waitCD` directly when fetching raw Google Sheets CSV.

3. **Multi-Repo Synchronization**:
   - Cross-synced `api/bi_data.py`, `index.html`, and `executive_dashboard.html` to `tni_site_down_repo`.
   - Updated `UNIFIED_TRAIN_MATRIX.md` for **Toa 12 — Ghế 9.2 (Live Sync Auditor)**.

---

## 🧪 Verification & Results

- Executed `python -c "from api.bi_data import get_bi_stats; ..."`:
  - `targetPct`: `75` (dynamic from Cell F1)
  - Team 1: `367 WOs`, `fotClose: 72`, `waitCD: 23`, `pct: 18%`, `metTarget: false`
  - Team 2: `207 WOs`, `fotClose: 120`, `waitCD: 8`, `pct: 56%`, `metTarget: false`
  - Team 3: `92 WOs`, `fotClose: 33`, `waitCD: 0`, `pct: 36%`, `metTarget: false`
  - Team 4: `104 WOs`, `fotClose: 85`, `waitCD: 0`, `pct: 82%`, `metTarget: true`
