# Backup Context v535 - Dedicated Seat Isolation for Refuel Plan Mentions & Confirmation Replies

> **Timestamp:** 13/08/2026 18:05 MMT  
> **Version:** v535  
> **Target:** Restructure confirmation reply logic in api/refuel_collector.py into 7 100% isolated dedicated seats (Ghế riêng) so that Plan Refuel mentions and monitor questions never get mixed up with other categories  

---

## 🎯 Architectural Refactoring (v535)

1. **Dedicated Seat Isolation (Ghế riêng độc lập 100%)**:
   - Refactored `api/refuel_collector.py` confirmation reply handler into 7 dedicated, isolated seats:
     - **Ghế 1 (PLAN)**: Dành riêng cho `Plan refuel`. DUY NHẤT có câu hỏi `📢 {mention_tag} Who is assigned to follow and monitor ?` và tag Đội trưởng theo mã trạm/số Team.
     - **Ghế 2 (FT_MONITOR)**: Dành riêng cho `FT follow monitor`. Trả về 2 dòng sạch gọn.
     - **Ghế 3 (REFUELED)**: Dành riêng cho `Refueled`. Trả về 2 dòng sạch gọn.
     - **Ghế 4 (REQUEST)**: Dành riêng cho `Team request`. Trả về 2 dòng sạch gọn.
     - **Ghế 5 (LETTER_SUBMIT)**: Dành riêng cho `Letter Submit`.
     - **Ghế 6 (LETTER_APPROVED)**: Dành riêng cho `Letter Approved`.
     - **Ghế 7 (FALLBACK)**: Dành riêng cho mẫu mới.
