# Backup Context Snapshot — Version 466 (2026-08-12)

## Overview & Fix for Refuel Collector Classifier False Positives (v466)

### Issue Identified
- Casual Telegram chat messages like `Hein Nanda do you submit letter finish?` or `Raja HO many site Request delay...` were being falsely captured as official `LETTER_SUBMIT` / `REQUEST` reports.
- Root Cause: `api/refuel_collector.py` used loose substring checks `if "letter" in t and "submit" in t:` and `if "request" in t:`, causing casual chat containing words "letter", "submit", "request" to trigger ticket recording.

### Fix Applied
- Upgraded `classify(text)` in `api/refuel_collector.py` to use strict regex matching for headers and prefixes:
  1. `LETTER_SUBMIT`: Requires strict header `Letter Submit:` / `Submit Letter:` or line starting with `Letter Submit` / `Submit Letter` (`re.search(r'^\s*(letter\s*submit|submit\s*letter)\b', t, re.M)`).
  2. `LETTER_APPROVED`: Requires strict header `Approved Letter:` / `Letter Approved:` or line starting with `Approved Letter`.
  3. `REQUEST`: Requires line starting with `Team X Request` or `Request refuel` (`re.search(r'^\s*team[\s_\-]*\w*\s*request\b', t, re.M)`).
  4. `PLAN`: Requires line starting with `Team X Plan` or `Plan refuel`.
  5. `REFUELED`: Requires explicit `dg type` or `actual filled qty`.
  6. `FT_MONITOR`: Requires `name of ft staff member` or `follow monitor`.
- Casual conversation messages are now correctly returned as `None` (ignored and NOT collected).

### Verification & Deployment Status
- Scratch test suite `scratch/test_classify.py`: PASSED (9/9 test cases passed 100%).
- Python syntax compilation check: PASSED (0 errors).
- Pushed to GitHub `phonghdpxd-cmd/tni-bot` main branch.
- Chuyến Tàu / Toa / Ghế: Chuyến tàu Số #9 (`@TNI_FUEL`), Toa #9 & #10, Dãy Ghế F-P1 & F-P2 (Strict Refuel Report Classifier Fix).
