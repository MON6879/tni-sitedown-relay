# 🏛️ MASTER SYSTEM ARCHITECTURE MATRIX & NUCLEAR LOGIC DOCS
> **Document Status:** Official Production Architecture (v4.0 — Top 1% Audit Grade)  
> **Last Updated:** 2026-08-10 06:55 MMT (UTC+6:30)  
> **Author:** Top 1% World-Class Systems Engineering Team  

---

## 📌 1. TỔNG HỢP TOÀN BỘ PHÁT HIỆN & ĐIỀU CHỈNH CỦA CÁC CHUYÊN GIA

| Cấp Chuyên Gia | Lỗi Nghiêm Trọng Phát Hiện | Giải Pháp Hạt Nhân Đã Áp Dụng | File Liên Quan |
|---|---|---|---|
| **Top 20% Expert** | 5 workflow legacy trong repo riêng tư (`phonghdpxd-cmd/tni-bot`) vẫn có `schedule:` active → chạy song song gây gửi báo cáo 2-3x | Xóa toàn bộ `schedule:` cron rải rác trên 5 workflow legacy, chuyển về `workflow_dispatch` | `.github/workflows/telegram_send.yml`, `daily_plan_report.yml`, `refuel_*.yml` |
| **Top 10% Expert** | `deduplicate_plans_by_date()` giữ tin nhắn CŨ NHẤT thay vì MỚI NHẤT do Telegram trả về Newest-First nhưng loop ghi đè dictionary; EOD store không dedup trước khi ghi Sheet | Sửa loop dedup: `if key not in latest_map: latest_map[key] = p` để giữ bản tin mới nhất; Thêm dedup trước `store_daily_plan()` | `daily_plan_report.py` (L988 & L1275) |
| **Top 5% Expert** | Vercel Webhook xử lý `handle()` trước khi trả lời HTTP 200 OK → vi phạm SLA 3s của Telegram → Telegram tự retry gửi trùng; Chưa có bảo mật Payload/Token | Phân tách (Decouple): Trả về `HTTP 200 OK` tức thì (~10ms), đẩy `handle()` vào `threading.Thread`; Bổ sung 2MB Payload limit + `X-Telegram-Bot-Api-Secret-Token` | `api/search_bot.py` |
| **Top 3% Expert** | Matcher phân tán gây lệch regex; Blocklist `is_daily_plan_msg()` chứa `"list name ft"` → false positive từ chối Plan thật của Team Leader có dòng "VII. List name FT" | Đồng bộ SSOT search qua `tni_search_core.py`; Xóa `"list name ft"` khỏi blocklist trong `daily_plan_report.py` | `tni_search_core.py`, `daily_plan_report.py` (L115) |
| **Top 1% Expert** | 16 cron expressions phân tán trên phút tròn (:00, :05, :10...) bị nghẽn hàng đợi toàn cầu của GitHub Actions; Site Down relay cào dữ liệu không khớp nhịp đăng tin của NOC Pro | **Xây dựng Đoàn Tàu 5 Phút (`train_5min.yml`)** cron `3/5` (phút lẻ offset 3); Dàn 12 toa không trùng lặp; Bổ sung `setWebhook` lock; Đổi Botlookup Relay sang `:06 & :36` MMT | `train_5min.yml`, `botlookup_relay.yml`, `TRAIN_MANIFEST.md` |

---

## 🚆 2. MA TRẬN ĐOÀN TÀU 5 PHÚT (TRAIN CODE MATRIX ARCHITECTURE)

Đoàn Tàu 5 Phút là **đầu kéo duy nhất** quản lý toàn bộ hệ thống. Cron: `3/5 * * * *` (UTC offset 3 → MMT ticks `:33, :38, :43, :48, :53, :58, :03, :08, :13, :18, :23, :28`).

```
                                  🚂 ĐẦU KÉO UNIFIED (train_5min.yml - 3/5 * * * *)
                                                         │
   ┌──────────────────────┬──────────────────────────────┼──────────────────────────────┬──────────────────────────────┐
   │                      │                              │                              │                              │
🏥 Toa 0: Keepalive   📊 Toa 1+11: Reports 1-4+BOD    📋 Toa 3,4,5: Plan Reports    📖 Toa 6: Read Report         ⛽ Toa 7-11: Refuel & Cable
(Mọi chuyến 24/7)     (05:48 & 15:48 MMT)            (05:28, 05:58, 15:28...)      (14:03, 16:03, 17:18...)      (13:03, 13:08, 13:13...)
(Bot API Lock & Warm) (Bot API Multi-token)          (Telethon Single-Session)     (Telethon Single-Session)     (Bot API + Telethon)
```

### Bảng Ma Trận 12 Toa Tàu & Sợi Dây Liên Kết (Dependency Wires):

| Toa # | Tên Toa | Giờ MMT | Engine | Script | Sợi Dây Liên Kết (Dependencies) | Cơ Chế Bảo Vệ / Fail-safe |
|---|---|---|---|---|---|---|
| **Toa 0** | 🏥 Keepalive & Webhook Lock | Mọi chuyến (*/5 offset 3) | cURL | `train_5min.yml` step 1 | Search Bot (`/api/search_bot`), Asset Collector (`/api/collector`), Site Down Relay (`/api/site_down_relay`), Main GAS (@302), Construction GAS | Sưởi Vercel Serverless không bị cold-start; Khóa `setWebhook` Telegram không bị mất đăng ký |
| **PRE** | 🔔 Pre-Warm | 05:43, 15:43 | cURL | `train_5min.yml` step 1 | Ping kích hoạt toàn bộ GAS & Vercel Endpoints 5 phút trước giờ báo cáo lớn | Đảm bảo RAM/Cache Vercel và Google Sheets sẵn sàng 100% |
| **Toa 1+11** | 📊 Reports 1,2,3,4 + BOD | 05:48, 15:48 | 🤖 Bot API | `backlog_send.py`, `cron_send.py`, `daily_bod_assign.py` | `SEND_BOT_TOKEN`, `REPORT_TASK_BOT_TOKEN`, `TECHNICAL_DEP_BOT_TOKEN`, Apps Script API | Chạy song song độc lập bằng Bot API tokens, không chạm vào Telethon session |
| **Toa 3** | 📋 Plan 5A (EOD) | 05:58, 15:58 | 📱 Telethon | `daily_plan_report.py --mode eod` | Telegram Client (@Phongha79), `GROUPS`, Google Sheets `daily_plan` | Quét Telegram 200 msgs → Deduplicate Newest-First → Insert Sheet row 2 |
| **Toa 4** | 📋 Plan 5B (Update) | 21:03 | 📱 Telethon | `daily_plan_report.py --mode update` | Telegram Client (@Phongha79), Sheet `daily_plan` | Đọc tin nhắn điều chỉnh kế hoạch ban đêm |
| **Toa 5** | 📋 Plan 5C (Morning) | 05:28, 08:28, 09:53, 15:23, 19:03, 22:03 | 📱 Telethon | `daily_plan_report.py --mode morning` | Telegram Client (@Phongha79), `is_daily_plan_msg()`, `deduplicate_plans_by_date()` | Quét plan hôm nay (đã gỡ `list name ft` blocklist); Fallback lấy từ Sheet nếu scan rỗng |
| **Toa 6** | 📖 Report 6 (Read) | 14:03, 16:03, 17:18, 19:08, 20:33 | 📱 Telethon | `daily_read_report.py` | Telegram Client (@Phongha79), Sheet `read_log` | Quét ai đã đọc tin nhắn chỉ đạo |
| **Toa 7** | 🔌 Cable Daily Report | 05:53, 15:53 | 🤖 Bot API | `cable_report.py` | `COLLECTOR_BOT_TOKEN`, `CABLE_APPS_SCRIPT_URL` | Báo cáo sự cố & tiến độ cáp |
| **Toa 8** | ⛽ Refuel Request | 05:53, 13:03, 15:53 | 🤖 Bot API | `refuel_send.py` | `REFUEL_BOT_TOKEN`, `REFUEL_APPS_SCRIPT_URL` | Báo cáo yêu cầu nhiên liệu máy phát |
| **Toa 9** | ⛽ Refuel Plan 1 | 13:08, 22:08 | 📱 Telethon | `refuel_plan_report.py --report 1` | Telegram Client (@Phongha79), `REFUEL_BOT_TOKEN` | Tổng hợp kế hoạch đổ dầu Team |
| **Toa 10** | ⛽ Refuel Plan 2 + 2.1 | 13:13, 18:03, 22:13 | 📱 Telethon | `refuel_plan_report.py --report 2` + `--report 21` | Telegram Client (@Phongha79), `REFUEL_BOT_TOKEN` | Kiểm tra ngày giám sát FT & Kế hoạch cấp phát |
| **Toa 11** | ⛽ Refuel Plan 4 | 22:18 | 📱 Telethon | `refuel_plan_report.py --report 4` | Telegram Client (@Phongha79), `REFUEL_BOT_TOKEN` | Tổng kết nhiên liệu cuối ngày |
| **Độc Lập** | 🔍 Botlookup Relay | 04:06 - 22:36 (Mỗi 30p lúc :06 & :36) | 📱 Telethon | `botlookup_relay.py` | Telegram Client (@Phongha79), `SD_APPS_SCRIPT_URL`, Nhóm BOT LOOKUP | **Chạy trễ 6 phút sau khi NOC Pro Bot đăng tin (:00 & :30)**; Có Circuit Breaker 3-check |

---

## 🧬 3. SÁU HẠT NHÂN LOGIC BẮT BUỘC (NUCLEAR LOGIC RULES)

1. **Hạt Nhân Webhook Async Decoupling (3s Telegram SLA):**
   * Mọi Webhook endpoint trên Vercel phải trả về `HTTP 200 OK` ngay lập tức (~10ms) trước khi thực thi logic nặng bằng `threading.Thread`.

2. **Hạt Nhân Quét Plan & Exclusion Blocklist:**
   * `is_daily_plan_msg()` tuyệt đối KHÔNG chứa các từ khóa trong nội dung Plan hợp lệ của Team Leader (đã xóa `"list name ft"`).
   * `deduplicate_plans_by_date()` phải giữ bản tin MỚI NHẤT (Newest-First): `if key not in latest_map: latest_map[key] = p`.

3. **Hạt Nhân Chống Xung Đột Telethon Session:**
   * Mọi tác vụ dùng Telethon (`@Phongha79`) phải dàn xếp lệch thời gian tối thiểu 5 phút. Không bao giờ cho 2 script Telethon chạy đồng thời trong cùng 1 tick 5 phút.

4. **Hạt Nhân Phút Lẻ Offset 3 Chống Nghẽn Cron:**
   * Mọi cron schedule chính của hệ thống phải đặt ở phút lẻ `:03, :08, :13, :18, :23, :28, :33, :38, :43, :48, :53, :58` để tránh nghẽn hàng đợi GitHub Actions toàn cầu ở phút tròn.

5. **Hạt Nhân Thu Thập Dữ Liệu Ghi Đầu Bảng Tính (Top Row Insertion):**
   * Mọi bộ thu thập dữ liệu (Daily Plan, Read Log, Refuel, Inventory...) khi ghi vào Google Sheets BẮT BUỘC phải chèn dòng mới lên đầu (Dòng 2, bên dưới Header Row 1) bằng `insertRowsBefore(2, ...)`. Tuyệt đối không dùng `appendRow()`.

6. **Hạt Nhân Khung Thời Gian Botlookup Relay 6 Phút:**
   * Botlookup Relay chạy tại phút `:06 & :36` MMT — đúng 6 phút sau khi Bot công ty đăng tin tổng hợp lúc `:00 & :30`.

---

## 🛡️ 4. QUY TRÌNH "LƯU ĐI" BẮT BUỘC 6 BƯỚC (STRICT SAVE PROCEDURE)

Mỗi khi chỉnh sửa hệ thống, BẮT BUỘC phải thực hiện đủ 6 bước theo thứ tự:

```
[Bước 1: Snapshot Backup] ──► [Bước 2: Đồng Bộ Mã Nguồn] ──► [Bước 3: Commit & Push All Repos]
                                                                            │
[Bước 6: Live Output Verification] ◄── [Bước 5: Full Cross-Sync] ◄── [Bước 4: Dọn Pycache]
```

1. **Bước 1 — Snapshot Backup Context:** Cập nhật snapshot thông tin chỉnh sửa vào file `history/backup_context_YYYYMMDD_...md`.
2. **Bước 2 — Đồng Bộ Mã Nguồn Song Song:** Copy toàn bộ file Python/GS/YAML đã sửa từ thư mục làm việc sang repo chính `tni_site_down_repo` (`MON6879/tni-sitedown-relay`).
3. **Bước 3 — Commit & Push Cả 2 Repositories:**
   - Commit & Push `phonghdpxd-cmd/tni-bot` (Private / Vercel Repo).
   - Commit & Push `MON6879/tni-sitedown-relay` (Public / GitHub Actions Repo).
4. **Bước 4 — Dọn Dẹp Clean Cache:** Xóa sạch 100% tất cả các thư mục `__pycache__` trên toàn hệ thống.
5. **Bước 5 — Đồng Bộ 100% Tất Cả Logic Liên Quan (Full Logical Cross-Sync):**
   - Đảm bảo `train_5min.yml`, `TRAIN_MANIFEST.md`, `daily_plan_report.py` đồng nhất giữa các repos và tài liệu `SYSTEM_DOC.md`, `AGENTS.md`, `system_map.md`.
6. **Bước 6 — Kiểm Thử Thực Tế (Live Output Verification):**
   - Chạy test payload/script thực tế (ví dụ: test `is_daily_plan_msg()`) đảm bảo 0 lỗi phát sinh và phản hồi thực tế chính xác 100%.
