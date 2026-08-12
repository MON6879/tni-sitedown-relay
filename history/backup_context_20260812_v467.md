# Backup Context Snapshot — Version 467 (2026-08-12)

## Overview & Enforce Strict Letter Template Requirement (v467)

### Requirement Enforced
- Letter report classification now strictly requires the official Letter Template format (`Letter Submit:` / `Submit Letter:` or `Approved Letter:` / `Letter Approved:` accompanied by colon/dash or date format `DD/MM/YYYY`).
- Completely prevents casual chat questions like `Hein Nanda do you submit letter finish?` or `did you submit letter?` from triggering false positive ticket collection across all system layers.

### Files Modified Across System Matrix
1. `Task and WO/api/refuel_collector.py`:
   - Enforced regex `re.search(r'^\s*(letter\s*submit|submit\s*letter)\s*[:\-]', t, re.M)` or `re.search(r'^\s*(letter\s*submit|submit\s*letter)\b.*\d{1,2}[/\-\.]\d{1,2}', t, re.M)` for `LETTER_SUBMIT`.
   - Enforced regex `re.search(r'^\s*(approved\s*letter|letter\s*approved)\s*[:\-]', t, re.M)` or `re.search(r'^\s*(approved\s*letter|letter\s*approved)\b.*\d{1,2}[/\-\.]\d{1,2}', t, re.M)` for `LETTER_APPROVED`.
2. `Task and WO/botlookup_relay.py`:
   - Updated Telethon message scanner in Site Down Relay to use the exact same strict Letter Template regex.
3. `QLTC_GAS/13_TNI_CONSTRUCTION.gs`:
   - Updated Google Apps Script backend `textLower` category matcher to enforce strict regex matching before routing to `Lettel Progress` tab.

### Verification & Deployment Status
- Test suite `scratch/test_classify.py`: 10/10 test cases PASSED (100%).
- Python syntax compilation: PASSED (0 errors).
- Pushed to GitHub `phonghdpxd-cmd/tni-bot` main branch.
- Chuyến Tàu / Toa / Ghế: Chuyến tàu Số #9 (`@TNI_FUEL`), Toa #9 & #10, Dãy Ghế F-P1 & F-P2 (Enforced Strict Letter Template Matching).
