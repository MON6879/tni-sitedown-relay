# Backup Context v533 - Refuel Collector Confirmation Reply & Team Leader Mention Optimization

> **Timestamp:** 13/08/2026 17:48 MMT  
> **Version:** v533  
> **Target:** Restrict "Who is assigned to follow and monitor ?" question strictly to Plan Refuel submissions, and dynamically tag correct Team Leader based on Team number / Site ID  

---

## 🎯 System Fixes (v533)

1. **Restricted Monitor Question to Plan Refuel Only**:
   - Updated `api/refuel_collector.py` so that `📢 {mention_tag} Who is assigned to follow and monitor ?` is ONLY appended for `category == "PLAN"` (Plan refuel).
   - Other categories (`FT_MONITOR`, `REFUELED`, `REQUEST`, `LETTER_SUBMIT`, `LETTER_APPROVED`) now send clean confirmation messages without asking the monitor question.

2. **Dynamic Team Leader Tagging by Team / Site ID**:
   - Enhanced `api/refuel_collector.py` to inspect explicit Team numbers (`Team 1`..`Team 4`) OR bóc tách mã trạm (`TNIxxxx`) to map dynamically to the exact Team Leader (`@PaingAung`, `@NayMyoThu`, `@PyaePhyoZaw`, `@NaingMyoHtun`), eliminating fallback to `@Phongha79`.
