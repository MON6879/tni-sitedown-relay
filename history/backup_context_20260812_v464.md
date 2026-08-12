# Backup Context Snapshot — Version 464 (2026-08-12)

## Overview & Consolidated System State (v464)

### 1. Refuel Collector Bot (@TNI_FUEL / `api/refuel_collector.py`)
- **Team Leader Mentions**: Tagging mapped for all 4 team leaders using regex `r'\bteam[\s_\-]*0*([1-4])\b'`:
  - Team 1 (Dawei): Paing Aung Soe -> `@PaingAung`
  - Team 2 (Myeik): Nay Myo Thu -> `@NayMyoThu`
  - Team 3 (Bokpyin): Pyae Phyo Zaw -> `@PyaePhyoZaw`
  - Team 4 (Kawthoung): Naing Myo Htun -> `@NaingMyoHtun`
- **PLAN Classifier**: Strict prefix match `re.match(r'^team[\s_\-]*\w*\s*plan\b', text, re.I)`. Messages must start with `Team <X> Plan`.
- **Chuyến Tàu / Toa / Ghế**: Chuyến tàu Số #9 (`@TNI_FUEL`), Toa #9 & #10, Dãy Ghế F-P1 & F-P2.

### 2. Refuel Reports (`refuel_plan_report.py` & `.github/workflows/train_5min.yml`)
- **Report 3 (Need Refuel AB1:AB2)**: DELETED completely from codebase and GitHub Actions schedule.
- **Active Reports**: Report 1 (Plan vs Request), Report 2 (Plan vs Refueled), Report 4 (Alias R2), Report 5 (Members).
- **Chuyến Tàu / Toa / Ghế**: Chuyến tàu Số #9 (`@TNI_FUEL`), Toa #9.3, Dãy Ghế F-P3 (Removed).

### 3. Verification & Deployment Status
- Python compilation syntax: PASSED (0 errors).
- All changes pushed to GitHub `phonghdpxd-cmd/tni-bot` main branch.
