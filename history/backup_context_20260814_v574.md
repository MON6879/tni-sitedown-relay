# Backup Context v574 - Construction Bot 10 Mandatory Key Validation Fix

> **Timestamp:** 14/08/2026 12:08 MMT  
> **Version:** v574  
> **Target:** Audited and updated `13_TNI_CONSTRUCTION.gs` (Bot 10 TNI_SITE). Implemented strict header key & date validation (`isValidConstructionReport`) to ignore casual chat messages.  

---

## 🎯 Master Architectural Validation (v574)

1. **Mandatory Header Key + Date Validation (`isValidConstructionReport`)**:
   - To be collected into the `Collect Data` sheet, incoming messages MUST start at Line 1 with a valid mandatory header key (from Column D of `Template Cons`):
     - `Delivery: DD/MM/YYYY`
     - `Team received material: DD/MM/YYYY`
     - `Plan: DD/MM/YYYY`
     - `Upgraded: DD/MM/YYYY`
     - `Revoked material: DD/MM/YYYY`
     - `Degraded: DD/MM/YYYY`
     - `Solared: DD/MM/YYYY`
     - `Cable Route Over head Progress: DD/MM/YYYY`
     - `Cable Route Over head complete: DD/MM/YYYY`
     - `Cable Route Under ground Progress: DD/MM/YYYY`
     - `Cable Route Under ground Completed: DD/MM/YYYY`
   - AND must contain a `Team` line (e.g. `Team 1:`, `Team 2:`, `Team...`).
   - Any message lacking this structure (such as casual user conversation or discussion e.g. *"Myint Ko Ko Aung Pyae Phyo Zaw need sent plan tomorrow..."*) is strictly IGNORED and NOT saved into Google Sheets (`không thu thập`).

2. **Files Updated**:
   - `QLTC_GAS/13_TNI_CONSTRUCTION.gs`
   - `history/backup_context_20260814_v574.md`
