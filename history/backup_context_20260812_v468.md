# Backup Context Snapshot — Version 468 (2026-08-12)

## Overview & Full Classifier Audit — Strict First-Line + Before-Colon Rule (v468)

### Audit Summary
Full review of all message collection classifiers across system layers:
| # | File | Classifier | Status After v468 |
|---|------|-----------|-------------------|
| 1 | `api/refuel_collector.py` | REFUELED (`dg type` / `actual filled qty`) | ✅ Strict |
| 2 | `api/refuel_collector.py` | PLAN (`Team X Plan` / `Plan refuel` — first line) | ✅ Strict |
| 3 | `api/refuel_collector.py` | REQUEST (`Team X Request` / `Request refuel` — first line) | ✅ Strict |
| 4 | `api/refuel_collector.py` | LETTER_SUBMIT (template header + colon/date) | ✅ Strict |
| 5 | `api/refuel_collector.py` | LETTER_APPROVED (template header + colon/date) | ✅ Strict |
| 6 | `api/refuel_collector.py` | FT_MONITOR (`name of ft staff member AND supervise`) | ✅ Strict |
| 7 | `api/collector.py` | ASSET (Order/Revoke/Export/Move/Asset sent/Destroys) | ✅ FIXED v468 |
| 8 | `api/collector.py` (MDG) | INVENTORY (`inventory fuel AND dg id: tni`) | ✅ Already strict |
| 9 | `api/collector.py` (MDG) | MDG RUN (`mdg AND site id: tni`) | ✅ Already strict |
| 10 | `botlookup_relay.py` | LETTER (strict regex header + colon/date) | ✅ Fixed v467 |
| 11 | `QLTC_GAS/13_TNI_CONSTRUCTION.gs` | All categories (strict regex) | ✅ Fixed v467 |

### Fix Applied (v468): `api/collector.py` — `is_collector_msg()`
**Rule Enforced**: Keyword (Order/Revoke/Export/Move/Asset sent/Destroys) must:
1. Appear on the FIRST LINE ONLY of the message.
2. Be followed immediately by `:` or `-` (e.g., `Order:`) OR a number/date (e.g., `Order 12/08/2026`) OR stand alone as the entire first line.
3. Slash commands `/order`, `/revoke` etc. still accepted.

**Test Suite**: `scratch/test_collector_classify.py` — 16/16 test cases PASSED (100%).

### Chuyến Tàu / Toa / Ghế
- Chuyến tàu Số #7 (`@TNIASSETOrderREQUEST_BOT`), Toa #7 & #8, Dãy Ghế F-A1 (Strict Asset Collector Classifier Fix).
