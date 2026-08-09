# 🚂 TRAIN MANIFEST — Lịch Trình Đoàn Tàu 5 Phút
# ═══════════════════════════════════════════════════
# Last Updated: 2026-08-10
# Workflow: train_5min.yml
# Cron: 3/5 * * * * (offset 3 — tránh nghẽn phút tròn toàn cầu)
# Train ticks (UTC): :03, :08, :13, :18, :23, :28, :33, :38, :43, :48, :53, :58
# Train ticks (MMT): :33, :38, :43, :48, :53, :58, :03, :08, :13, :18, :23, :28
#
# 🤖 = Bot API (chạy song song OK, token độc lập)
# 📱 = Telethon (chạy lần lượt, 1 session @Phongha79)
#
# ═══════════════════════════════════════════════════
# ☀️ MORNING BLOCK (05:00 — 10:00 Myanmar)
# ═══════════════════════════════════════════════════
# 05:28 | Toa 5  | 📱 Plan 5C Morning        | daily_plan_report.py --mode morning
# 05:43 | PRE    | 🔔 PRE-WARM (keepalive)   | curl ping all endpoints
# 05:48 | Toa 1  | 🤖 Reports 1,2,3,4 + BOD  | backlog_send.py + cron_send.py + daily_bod_assign.py
# 05:53 | Toa 7+8| 🤖 Cable + Refuel Req     | cable_report.py + refuel_send.py
# 05:58 | Toa 3  | 📱 Plan 5A EOD            | daily_plan_report.py --mode eod
# 08:28 | Toa 5  | 📱 Plan 5C Morning        | daily_plan_report.py --mode morning
# 09:53 | Toa 5  | 📱 Plan 5C Morning        | daily_plan_report.py --mode morning
#
# ═══════════════════════════════════════════════════
# 🌤️ AFTERNOON BLOCK (13:00 — 16:30 Myanmar)
# ═══════════════════════════════════════════════════
# 13:03 | Toa 8  | 🤖 Refuel Request         | refuel_send.py
# 13:08 | Toa 9  | 📱 Refuel Plan 1          | refuel_plan_report.py --report 1
# 13:13 | Toa 10 | 📱 Refuel Plan 2 + 2.1    | refuel_plan_report.py --report 2 + --report 21
# 14:03 | Toa 6  | 📱 Report 6 Read          | daily_read_report.py
# 15:23 | Toa 5  | 📱 Plan 5C Evening        | daily_plan_report.py --mode morning
# 15:43 | PRE    | 🔔 PRE-WARM (keepalive)   | curl ping all endpoints
# 15:48 | Toa 1  | 🤖 Reports 1,2,3,4 + BOD  | backlog_send.py + cron_send.py + daily_bod_assign.py
# 15:53 | Toa 7+8| 🤖 Cable + Refuel Req     | cable_report.py + refuel_send.py
# 15:58 | Toa 3  | 📱 Plan 5A EOD            | daily_plan_report.py --mode eod
# 16:03 | Toa 6  | 📱 Report 6 Read          | daily_read_report.py
#
# ═══════════════════════════════════════════════════
# 🌙 EVENING BLOCK (17:00 — 22:30 Myanmar)
# ═══════════════════════════════════════════════════
# 17:18 | Toa 6  | 📱 Report 6 Read          | daily_read_report.py
# 18:03 | Toa 10 | 📱 Refuel Plan 2          | refuel_plan_report.py --report 2
# 19:03 | Toa 5  | 📱 Plan 5C Evening        | daily_plan_report.py --mode morning
# 19:08 | Toa 6  | 📱 Report 6 Read          | daily_read_report.py
# 20:33 | Toa 6  | 📱 Report 6 Read          | daily_read_report.py
# 21:03 | Toa 4  | 📱 Plan 5B Update         | daily_plan_report.py --mode update
# 22:03 | Toa 5  | 📱 Plan 5C Evening        | daily_plan_report.py --mode morning
# 22:08 | Toa 9  | 📱 Refuel Plan 1          | refuel_plan_report.py --report 1
# 22:13 | Toa 10 | 📱 Refuel Plan 2 + 2.1    | refuel_plan_report.py --report 2 + --report 21
# 22:18 | Toa 11 | 📱 Refuel Plan 4          | refuel_plan_report.py --report 4
#
# ═══════════════════════════════════════════════════
# 🏥 TOA 0: KEEPALIVE ENDPOINTS (MỌI CHUYẾN, 24/7)
# ═══════════════════════════════════════════════════
# 1. Search Bot    | Vercel /api/search_bot     | Tránh cold start 3-5s
# 2. Asset Bot     | Vercel /api/collector       | Tránh cold start
# 3. Site Down Bot | Vercel /api/site_down_relay | Phản hồi nhanh khi site sập
# 4. Main GAS      | Apps Script @302            | Giữ quota active
# 5. Copy Paste GAS| Apps Script                 | Giữ active
# -------------------------------------------------------
# Capacity: ~150 endpoints max (hiện dùng 5/150 = 3%)
# Khi thêm hệ thống mới: thêm 1 dòng curl trong Toa 0
#
# ═══════════════════════════════════════════════════
# 📌 CÁCH THÊM TOA MỚI
# ═══════════════════════════════════════════════════
# 1. Chọn khung giờ trống (xem bảng trên — chọn :XX không trùng)
# 2. Thêm check_time vào Schedule Check trong train_5min.yml
# 3. Thêm step mới với if: condition
# 4. Cập nhật TRAIN_MANIFEST.md
# 5. Commit + Push
