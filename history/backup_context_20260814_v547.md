# Backup Context v547 - Dual Architecture: Dedicated Site Down Relay Train + Full 7-Step Protocol

> **Timestamp:** 14/08/2026 06:49 MMT  
> **Version:** v547  
> **Target:** Document dual-train architecture (Train 1: Reports 1-6 & Refuel, Train 2: Dedicated Fast Site Down Relay) and execute strict 7-step LƯU ĐI protocol  

---

## 🎯 Architecture Summary (v547)

1. **Đoàn Tàu 1 (`train_5min.yml`)**:
   - **Nhiệm vụ**: Phụ trách toàn bộ các báo cáo định kỳ: Reports 1,2,3,4, BOD Assign, Report 5 (5A/5B/5C), Report 6 Read Status, Refuel Plan/Request, Cable Permit.
   - **Lịch trình**: Chạy theo nhịp 5 phút.

2. **Đoàn Tàu 2 (`botlookup_relay.yml`)**:
   - **Nhiệm vụ**: Phụ trách DUY NHẤT tác vụ cào và phát báo cáo Site Down v2 (`botlookup_relay.py --force`).
   - **Lịch trình**: Độc lập hoàn toàn lúc `:06` và `:36` hàng giờ. Chạy siêu tốc kết thúc trong 30 giây.
