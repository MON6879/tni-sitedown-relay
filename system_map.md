# TNI Bot System Map

> [!IMPORTANT]
> **ĐỌC BẢN ĐỒ MA TRẬN PHỤ THUỘ LOGIC NÀY TRƯỚC KHI SỬA BẤT KỲ THÀNH PHẦN NÀO HỆ THỐNG!**

---

# 🗺️ BẢN ĐỒ MA TRẬN LIÊN KẾT PHỤ THUỘ LOGIC HỆ THỐNG (SYSTEM LOGIC DEPENDENCY MATRIX)

> ⚠️ **NGUYÊN TẮC VÀNG:** KHI CẬP NHẬT BẤT KỲ MỘT THÀNH PHẦN NÀO, BẮT BUỘC PHẢI ĐỒNG BỘ NGUYÊN TỬ (ATOMIC SYNC) 100% CÁC THÀNH PHẦN LIÊN QUAN TRONG BẢN ĐỒ DƯỚI ĐÂY. TUYỆT ĐỐI KHÔNG SỬA RỜI RẠC ĐỂ TRÁNH "SỬA CÁI NÀY PHÁ CÁI KIA"!

---

### 🌐 1. Ma trận phụ thuộc Endpoints & Apps Script URLs:

| Tên chức năng / Bot | Endpoint Webhook / Deployment | Apps Script Web App URL | Các file Python liên quan (Phải đồng bộ `MAIN_GAS_FALLBACK`) | Workflow / Docs liên quan (Phải đồng bộ) |
|---|---|---|---|---|
| **Main & Asset Collector Bot** (`@TNIASSETorderREQUEST_BOT`) | `https://tni-bot.vercel.app/api/collector` | `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` (Version `@302`) | `api/collector.py`, `daily_read_report.py`, `daily_plan_report.py`, `daily_bod_assign.py`, `cron_send.py`, `backlog_send.py` | `system_map.md`, `SYSTEM_DOC.md`, `AGENTS.md` |
| **Search Bot** (`@SEARCHTNITASKWOBOT`) | `https://tni-bot.vercel.app/api/search_bot` | `AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA` (Version `@302`) | `api/search_bot.py` | `system_map.md`, `SYSTEM_DOC.md`, `AGENTS.md` |
| **Refuel Collector & Plan Bot** | Apps Script Web App | `AKfycbyCibIj4QN7oG5BZc_ju1iS-DUmd9nNdrMn9UN-WD8qf6jVoU_OKOf2yfbi10qGMFF-` (Version `@71`) | `api/refuel_collector.py`, `refuel_send.py`, `refuel_plan_report.py` | `system_map.md`, `SYSTEM_DOC.md` |
| **Site Down Bot (Relay)** (`@tni_site_down_bot`) | `https://tni-bot.vercel.app/api/site_down_relay` | `AKfycbxVi0BGDW7B_KBxcSEdw3yuHB9Rs2BemQEYeKDwsybJQdmQv-_0HqyGHjpZI6jupxll/exec` | `api/site_down_relay.py`, `botlookup_relay.py` | `system_map.md`, `SYSTEM_DOC.md` |
| **Construction Bot** (`@8903841312`) | Apps Script Web App | `AKfycbHraNPzUGVRNGvy-7_q4NyTiJSRUvlodCIjiJZJ00PaNMen-MpVjb4YTmyVex00mn6xQ/exec` | `.github/workflows/keepalive_construction.yml` | `system_map.md`, `SYSTEM_DOC.md` |

---

### ⏰ 2. Ma trận phụ thuộc Lịch gửi Báo cáo tự động (Cron Schedule Matrix):

| Tên báo cáo | Giờ gửi MMT (Asia/Yangon UTC+6:30) | Biểu thức Cron GitHub (`.github/workflows/daily_reports.yml`) | Biểu thức `if:` từng Step (BẮT BUỘC KHỚP 100%) | Script Python thực thi | Nhóm Telegram nhận tin |
|---|---|---|---|---|---|
| **Báo cáo Sáng (Reports 1, 2, 3, 4)** | **05:45 AM MMT** | `15 23 * * *` (23:15 UTC) | `if: github.event.schedule == '15 23 * * *'` | `cron_send.py` | Teams 1..4, CONTROL, TECHDEP |
| **Báo cáo Chiều (Reports 1, 2, 3, 4)** | **15:45 PM MMT** | `15 9 * * *` (09:15 UTC) | `if: github.event.schedule == '15 9 * * *'` | `cron_send.py` | Teams 1..4, CONTROL, TECHDEP |
| **Báo cáo Kế hoạch (Report 5A / Daily Plan)** | **05:45 AM & 15:45 PM MMT** | `15 23 * * *` & `15 9 * * *` | `if: github.event.schedule == '15 23 * * *' \|\| github.event.schedule == '15 9 * * *'` | `daily_plan_report.py` | Teams 1..4, CONTROL |
| **Báo cáo Lượt đọc (Report 6 / Read Status)** | **05:45 AM & 15:45 PM MMT** | `15 23 * * *` & `15 9 * * *` | `if: github.event.schedule == '15 23 * * *' \|\| github.event.schedule == '15 9 * * *'` | `daily_read_report.py` | Teams 1..4, CONTROL |

---

### 🔍 3. Ma trận Quy tắc Tra cứu Search Bot (`api/search_bot.py`):

| Cú pháp gõ | Quy tắc nhận diện (Regex & Length) | Chức năng gọi | Chống lặp / Trùng lời thoại |
|---|---|---|---|
| `Info: TNIXXXX` hoặc `info: TNIXXXX` | `^\s*(?:/info\|info)[:\s]+\s*(TNI\d{4}(?:_\d+)?)\s*$` | Tra cứu **Site Info** (`full_info=True`) | Khóa `is_duplicate_search` (10s cooldown) |
| `TNIXXXX` hoặc `TNIXXXX_01` | `^\s*(?:/tni\|/find\|tni)?[:\s]*\b(TNI\d{4}(?:_\d+)?)\s*$` | Tra cứu **Task & WO** (`full_info=False`) | Khóa `is_duplicate_search` (10s cooldown) |
| Tin nhắn dài hơn (VD: `TNI0394 440L`, `TNI0394 door open`) | Có chứa từ ngữ thừa / Lời thoại công việc | **BỎ QUA KHÔNG SEARCH** (Skip 100%) | Tránh nhiễu chat nhóm công việc |

---

### 📋 4. Checklist BẮT BUỘC khi Cập nhật (Atomic Update Protocol):

1. **Khi thay đổi Webhook / Apps Script Web App URL:**
   * [x] Cập nhật URL mới vào `MAIN_GAS_FALLBACK` trong `api/collector.py`, `api/search_bot.py`, `daily_read_report.py`, `daily_plan_report.py`, `daily_bod_assign.py`, `cron_send.py`, `backlog_send.py`.
   * [x] Cập nhật Vercel Environment Variables (`APPS_SCRIPT_URL`).
   * [x] Cập nhật tài liệu [`system_map.md`](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/system_map.md) và [`SYSTEM_DOC.md`](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/SYSTEM_DOC.md).

2. **Khi thay đổi Lịch Cron gửi báo cáo:**
   * [x] Cập nhật biểu thức cron ở phần `on.schedule` của `.github/workflows/daily_reports.yml`.
   * [x] Cập nhật CÙNG LÚC tất cả các biểu thức `if: github.event.schedule == ...` trong từng step của workflow.
   * [x] Đồng bộ file workflow sang `tni_site_down_repo/.github/workflows/daily_reports.yml`.

3. **Khi thay đổi Mã nguồn / Logic xử lý:**
   * [x] Thực hiện đầy đủ **6 Bước Quy tắc "LƯU ĐI"** trong `AGENTS.md`.

---

## QUY TẮC LÀM VIỆC BẮT BUỘC & KHI NÓI "LƯU ĐI"

> [!CAUTION]
> **Khi người dùng nói "LƯU ĐI" hoặc sau mỗi lần sửa code — AI BẮT BUỘC thực hiện đủ 6 bước dứt điểm:**
> 1. **Bước 1:** Cập nhật snapshot backup context vào `history/backup_context_...md`.
> 2. **Bước 2:** Đồng bộ mã nguồn Python/GS qua tất cả các repo cục bộ (`tni-bot` & `tni_site_down_repo`).
> 3. **Bước 3:** Commit & Push lên GitHub (`phonghdpxd-cmd/tni-bot` & `phonghdpxd-cmd/TNI-SITE-DOWN`).
> 4. **Bước 4:** Dọn dẹp sạch sẽ tất cả cache `__pycache__`.
> 5. **Bước 5:** **Đồng bộ 100% tất cả logic liên quan (Full Logical Cross-Sync)** — Khi sửa Endpoint/URL/Cron Schedule/Tra cứu, phải đồng bộ tức thì tất cả các file code, workflow step condition, fallback variables và tài liệu docs liên quan.
> 6. **Bước 6:** **Kiểm thử thực tế (Live Output Verification)** — Chạy test payload/script để xác nhận 0 lỗi phát sinh và phản hồi thực tế chính xác 100%.
>
> Không được dừng lại ở bất kỳ bước nào để tránh trôi code hay lặp lại lỗi!

---

## QUY TAC AI - BAT BUOC DOC TRUOC KHI LAM BAT CU VIEC GI

AI phai tuan thu TUYET DOI - khong co ngoai le:

### 1. CHI SUA DUNG CAI DUOC YEU CAU
- KHONG tu y sua file khac ngoai file duoc yeu cau
- KHONG them comment/code ngoai yeu cau du nghi la tot hon
- Hoi lai neu khong chac pham vi thay doi

### 2. DOC FILE TRUOC KHI SUA
- Luon view_file xem noi dung hien tai truoc khi edit
- Grep xac dinh dung dong can sua
- Chi thay doan can thay, khong overwrite ca file

### 3. KIEM TRA TRUOC KHI PUSH
- Chay git diff xem lai tat ca thay doi truoc khi commit
- YAML: KHONG co # comment ben trong if-expression
- Moi commit = 1 viec cu the, message ro rang

### 4. KHONG LAM NHIEU VIEC CUNG LUC
- KHONG sua nhieu file khong lien quan trong 1 lan tra loi
- Hoan thanh 1 viec - bao ket qua - doi lenh tiep theo

### 5. BAO CAO LOI THANH THAT
- Loi do AI gay ra: thua nhan ngay, khong giai thich vong vo
- Giai thich ro: loi o dau, tai sao, fix the nao

---

## 📅 CHANGELOG

### 07/08/2026 — v358: Fix critical crash search bot im lặng
| File | Thay đổi | Lý do |
|---|---|---|
| `api/search_bot.py` | **Thêm lại 261 dòng code bị thiếu**: `tg_send()`, `split_messages()`, `tg_get_file()`, `load_all_sheets()`, `get_staff_df()`, `get_staff_data()`, `log_search_bg()`, `lookup_team()`, `lookup_notclose()`, `lookup_waitcd()`, `get_site_access_template()`, `setup_bot_menu_commands()`, `DAILY_FIELDS_DEFAULT`, `TG_API`, `_cache_ts` | Khi v355 refactor sang O(1) Hash Map, các hàm helper cốt lõi bị xóa mất khỏi file nhưng vẫn còn được gọi → **NameError crash im lặng** ngay khi nhận tin nhắn → bot không phản hồi gì |

> [!CAUTION]
> **Bài học v358**: Khi refactor lớn (thêm O(1) indexing), PHẢI kiểm tra `python -c "import ast; ast.parse(...)"` VÀ grep tất cả hàm đang được gọi để đảm bảo không mất hàm nào. NameError trên Vercel bị nuốt im lặng, không có stack trace nào hiển thị ra ngoài.

### 03/08/2026 — ĐÓNG BĂNG: Gộp hết Reports + Thu thập vào MON6879
| File | Thay đổi | Lý do |
|---|---|---|
| `phonghdpxd-cmd/tni-bot` `.github/workflows/` | **XÓA 7 workflows trùng lặp**: `keepalive_search_bot.yml` (4,320 phút/tháng), `botlookup_relay.yml` (2,160 phút/tháng), `refuel_report.yml` (trùng), `refuel_plan_report_1.yml`, `refuel_plan_report_2.yml`, `daily_plan_report.yml`, `daily_read_report.yml`. Giữ `telegram_send.yml` (manual) + `tni_search_bot.yml` (disabled) | Tất cả reports đã chạy trên MON6879 `daily_reports.yml`. Workflows trên phonghdpxd-cmd là **trùng lặp**, ngốn ~7,200 phút/tháng vượt quota 360% |
| `MON6879/tni-sitedown-relay` `.github/workflows/` | **XÓA 2 workflows trùng**: `sitedown_keepalive.yml` (4,320 phút/tháng), `botlookup_relay.yml` (2,160 phút/tháng trùng với `daily_reports.yml`) | Tiết kiệm ~6,480 phút/tháng. Botlookup đã chạy trong `botlookup_relay.yml` riêng (mỗi 30 phút) |
| `MON6879/tni-sitedown-relay` | Chuyển repo sang **PUBLIC** → GitHub Actions **MIỄN PHÍ KHÔNG GIỚI HẠN** | Quota 2,000 phút/tháng cho PRIVATE repos không đủ (tổng ~12,270 phút/tháng). PUBLIC = 0 chi phí |
| Kiến trúc | **phonghdpxd-cmd**: chỉ Vercel (Collector + Search Bot). **MON6879**: tất cả GitHub Actions (Reports 1-6, Refuel, Cable, Botlookup, Search Logger) | Quy tắc: 1 nơi chạy reports duy nhất, không trùng lặp |

### 22/07/2026
| File | Thay đổi | Lý do |
|---|---|---|
| `tni_site_down_repo/site_down_v2.gs` | Cập nhật bóc tách Cột C theo vị trí hàng cố định: C1:C3 (Tiêu đề/Tổng), C4 (T1), C5 (T2), C6 (T3), C7 (T4), C10:C (Chi tiết site) | Khắc phục lỗi missing lines/No data cho T3 và CONTROL |
| `tni_site_down_repo/site_down_v2.gs` | CONTROL nhận C1..C3 (Header/Duty) và C10:C (Chi tiết site), bỏ qua từng Team Total. Bỏ hoàn toàn `editMessageText`, luôn xóa tin nhắn cũ (`deleteOldMessages_`) và gửi tin nhắn mới với mốc giờ hiện tại | Giao diện CONTROL đẹp gọn, bong bóng tin nhắn Telegram hiển thị đúng mốc thời gian cập nhật hiện tại |
| `tni_site_down_repo/site_down_v2.gs` | Bổ sung icon 🔥 `Dont Forget` và 🕒 `Duty:` vào `addKeywordIcons()`, đưa tất cả icon tiêu đề về đầu dòng (`\n`). `checkAwAz()` dùng mốc Ngày/Giờ (`tsKey`) làm key so sánh tránh nhảy tin liên tục do công thức lẻ phút | Giao diện rõ ràng thoáng mắt, chống gửi trùng lặp 100% |
| `telegram_bot.py` | Cập nhật xử lý lỗi HTTP 401 Unauthorized thân thiện khi Google Sheet ở chế độ Restricted. Hướng dẫn đổi quyền Chia sẻ sang Viewer | Giúp người dùng biết cách mở lại quyền cho Bot tra cứu dữ liệu |
| `.github/workflows/daily_reports.yml` | Chuyển lịch chạy báo cáo định kỳ cuối ca chiều từ 17:20/17:30 về đúng **16:00 giờ Myanmar (`30 9 * * *` UTC)** | Gửi báo cáo định kỳ đúng khung giờ 16:00 theo yêu cầu |
| `.github/workflows/` | Dọn dẹp triệt để `daily_reports.yml` và `botlookup_relay.yml` khỏi repo `phonghdpxd-cmd`, chỉ duy nhất repo `MON6879/tni-sitedown-relay` chạy tự động | Chặn hoàn toàn việc gửi 2 tin trùng lặp do 2 bot GitHub chạy song song |
| `.github/workflows/` & Repository Settings | Chuyển cả 2 repository `phonghdpxd-cmd/tni-bot` và `MON6879/tni-sitedown-relay` về **PRIVATE** | Bảo mật mã nguồn 100%, tận dụng 2.000 phút Private của tài khoản mới |

### 21/07/2026
| File | Thay đổi | Lý do |
|---|---|---|
| `apps_script_attendance/TNI attendance.js` | Thêm CacheService dedup theo `update_id` | Chặn Telegram gửi tin trùng lặp (retry loop) do timeout |
| `apps_script_attendance/TNI attendance.js` | Sửa check trùng theo Telegram ID thay vì Tên bị lệch cột | Tránh lưu trùng lặp điểm danh nhiều lần trong ngày |

### 18/07/2026
| File | Thay đổi | Lý do |
|---|---|---|
| `refuel_plan_report.py` | **Report 1 redesign**: format Sender → Team → Sites; thêm field `team` từ col C; infer team từ lịch sử | Hiển thị đúng tên người gửi và team (Team 2/3) |
| `refuel_plan_report.py` | **Report 2 redesign**: Letter Progress (ngày nộp + ngày duyệt) + Plan freq 3D/7D/1M per person | Thay thế Plan vs Refueled cũ |
| `refuel_plan_report.py` | Thêm `load_dotenv()` + `from dotenv import load_dotenv` | Env vars không được load khi chạy local |
| `tg_utils.py` | Fix Telethon `from_user=bot_id` → filter `msg.sender_id` thủ công | `PeerUser entity not found` khi Telethon chưa cache bot |
| `tg_utils.py` | Fix bold markdown stripping: strip `**` khỏi `first_line` trước `startswith()` | Telethon render `<b>text</b>` thành `**text**` → title prefix không match |
| `delete_old_helper.py` | Cùng fix bold markdown stripping | Đồng bộ với tg_utils.py |
| `.env` | Thêm `REFUEL_BOT_TOKEN=8811503647` | `load_dotenv()` load `SEND_BOT_TOKEN` (bot sai) thay vì bot refuel |
| `apps_script/apps_script_refuel_plan.gs` | Fix `parseSitesAndQty`: thêm `=` vào separator regex `[\s:,+=]+` | `TNI0385=220L` bị parse thành 440L (default) |
| `apps_script/apps_script_refuel_plan.gs` | Fix team regex: `Team\s*` → `Team[\s\-]*` | `Team-3`, `Team -2` không match → col C = None |

**Refuel Plan System — File Map:**
| File | Vai trò |
|---|---|
| `refuel_plan_report.py` | Python reports (1-5) gửi Telegram group `-5469544739` |
| `tg_utils.py` | Bot API send + Telethon delete-by-title cho refuel group |
| `apps_script/apps_script_refuel_plan.gs` | GAS collector: nhận tin Telegram → ghi vào sheet Plan/Request/Refueled |
| `.github/workflows/` | GitHub Actions tự động chạy reports |

**Refuel Spreadsheet:** `1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM`
Tabs: `Plan refuel` | `Team request` | `Refueled` | `Lettel Progress` | `Template`

---

### 14/07/2026

| File | Thay đổi | Lý do |
|---|---|---|
| `cross_check_wo.gs` | **Tự động gửi báo cáo Cross Check lúc 17:00** | Lấy dữ liệu 5 cột của sheet `Cross Check WO` gửi cho 5 nhóm Telegram tương ứng (xóa tin cũ). |
| `daily_report_scheduler.gs` | **Cập nhật lịch gửi EOD 16:00 Myanmar** | Được khai báo vào `.claspignore` để đẩy clasp thành công lên Apps Script trực tiếp. |
| `auto_fetch_ict.py` | **Tích hợp tịnh tiến cột, ghi giờ W1 & tổng hợp chênh lệch > 4** | Dịch chuyển cột lịch sử, ghi giờ Myanmar vào W1 và lọc các dòng chênh lệch > 4 sang tab Summary. |

### 03/07/2026
| File | Thay đổi | Lý do |
|---|---|---|
| `cron_send.py` | Điều kiện lọc row 4-59: bắt buộc **cột A có tên team VÀ cột D có nội dung** | Team Leader không có cột A vẫn lọt qua filter |
| `cron_send.py` | **Viết lại `parse_emp`**: trích `Site: /N <> Day:...3Day Close: X/X/X` — bỏ danh sách TNI dài và dep stats cuối | Control hiện `Site: *0* <=> rank: *0*` |
| `cron_send.py` | **Style emoji**: TL=🟧 (cố định), NV=trơn (không emoji), Tech Dept=vuông màu mỗi dept | Dễ đọc hơn, bỏ xanh/xanh lá luân phiên |
| `.github/workflows/daily_reports.yml` | Thêm cron tự động `30 10 * * *` UTC = **17:00 Myanmar** cho `daily_task`; tách riêng cable_report giữ `0 11` UTC | daily_task trước chỉ chạy tay |
| `SYSTEM_DOC.md` | Cập nhật giờ `cron_send.py`: 17:30 → 17:00 Myanmar, UTC 11:00 → 10:30 | Đồng bộ với workflow |

### 04/07/2026
| File | Thay đổi | Lý do |
|---|---|---|
| `daily_read_report.py` | **Staff sheet** (GID 1684930643): đọc col A=EmpID, C=TelegramID, F=Tên, M=Team, N=rỗng→active. Phân loại in_group vs not_in_group | Master list chính xác thay vì chỉ dùng participants |
| `daily_read_report.py` | Báo cáo hiện `⚠️ Not in Group yet (N members):` cuối mỗi team section | Thấy ngay ai chưa tham gia nhóm |
| `daily_plan_report.py` | **`colorize_bullets()`**: thay `• [Category]` bằng vuông màu theo category. Trùng tên = trùng màu | Dễ nhìn hơn trong CONTROL report |

**Quy tắc routing rows 4-59 (đã xác nhận):**
- Row 4-32 (NV): team = **Cột A**
- Row 33-59 (TL): team = số trong **Cột C** (`Team leader 1` → Team1, ...)
- Cả hai: bắt buộc Cột A ≠ trống VÀ Cột D ≠ trống

---

## 📊 Google Sheets — BA SPREADSHEET RIÊNG BIỆT

> [!CAUTION]
> Hệ thống có **3 Google Spreadsheet khác nhau**. Nhầm lẫn giữa các sheet này sẽ làm mất dữ liệu hoặc bot ghi sai chỗ!

| Tên | Sheet ID | Dùng cho | Ai xem |
|---|---|---|---|
| **Team All Find** (sheet chính) | `1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8` | Search Log, Dashboard Report, Asset Stats, Chat IDs | **USER xem hàng ngày** |
| **Site Down sheet** | `1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow` | Site Down data (store_site_down), Task Remain riêng | Bot ghi, dùng bởi botlookup_relay |
| **Attendance sheet** | `18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54` | List Attendance (ghi nhận điểm danh), Staff attendance | Bot điểm danh ghi |

Trong `apps_script_collector.js`:
- `SHEET_ID` = `1Etd2P...` → **Team All Find** (sheet chính, user xem) ← **DÙNG cho handleLogSearch**
- `SD_SHEET_ID` = `1FvDhIwq8...` → **Site Down sheet** (riêng biệt, dùng cho store_site_down)

### Team All Find — Sheet ID: `1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8`

### Sheet tabs

| Sheet | GID | Mục đích |
|---|---|---|
| **Task remain** | `133591305` | Dữ liệu WO + chat_id nhân viên/quản lý |
| **Config** | `1236389870` | Keywords (col A), Chat ID authorized (col D), Asset recipients (col C) |
| **Data** | DATA_TAB | Collector bot lưu tin nhắn Order/Revoke/Export... |
| **Input task** | `1755404595` | Nội dung task cho E75:E87. Col B=Dep, Col D=content, Col J=Done date |
| **Team leader Plan** | `835972075` | ⚠️ ĐÃ CHUYỂN → xem sheet `1C8hU8SXpOdq` tab "Team leader assign Plan" |

### Task remain — Cấu trúc row (ĐÃ XÁC NHẬN từ screenshot 07/06/2026)

| Row | Nhóm | Col C | Col D | Col E | Bot gửi |
|---|---|---|---|---|---|
| 1-2 | Header | — | — | — | — |
| 3 | — | `export sms` | — | — | — |
| **4-32** | **Nhân viên** | Tên hệ thống | Nội dung WO chi tiết | **Telegram ID** | `SEND_BOT` ⚠️ (nhân viên đã start SEND_BOT, không phải @TNIREPORTTASK) |
| **33-55** | **Team Leaders** | `Team leader 1-4` | Báo cáo team | **Telegram ID** | `SEND_BOT` |
| 56-61 | *(Hàng trống)* | — | — | — | — |
| 62 | Header | `Control all` | — | — | — |
| **63** | **BOD** | `BOD` | — | `6859790680` | `SEND_BOT` |
| 64 | Manager | `Manager` | — | *(trống)* | — |
| **65** | **Duty Manager** | `Duty Manger` | — | `1728528589` | `SEND_BOT` |
| 66-69 | *(Trống hoặc dept)* | — | — | — | — |
| 70+ | Departments... | Finance/M&E/PM... | — | — | — |
| **75-87** | **Technical Dept** | Department names | Nội dung từ Input task | **Telegram ID** | `@TNITECHINICALDEPREPORT_BOT` |

### Cá nhân nhận báo cáo DM trực tiếp (site_down_notify.gs)

| Người | Telegram | Chat ID cá nhân | Nhận gì |
|---|---|---|---|
| **TNI** (Ha Duc Phong) | @Phongha79 | `6859790680` | Tin1 + Tin2 FULL (giống CONTROL) — qua DM cá nhân |

> **Ghi chú**: `SD_PERSONAL_IDS` trong `site_down_notify.gs` — danh sách Chat ID nhận DM cá nhân, độc lập với group. Thêm/xóa người ở đây để điều chỉnh.

### Row 60-74 (Management) nhận:
1. 📦 Asset stats (Order/Revoke/Export... per team) + 3Day/7Day/Month
2. 🔍 Search stats per team + 3Day/7Day/Month  
3. 👑 Team Leader reports (col D truncated)

> **Ghi chú quan trọng**: Code đọc row 60-74 và gửi `mgmt_report` cho bất kỳ cid hợp lệ nào trong vùng này (kể cả cột D trống). BOD ở row 63 sẽ nhận báo cáo tổng hợp.

### Row 75-87 (Technical Dept) nhận:
1. 📋 Header cố định + Input task summary theo Dep (Done/Total/Remain từ gid=1755404595)
2. 📝 Col D content **đã chèn dòng tổng** (Total/3day/7day/Month) ngay sau mỗi section header (vd: "CM 06/06/2026")
3. 📦 Asset stats + 3Day/7Day/Month
4. 🔍 Search stats + 3Day/7Day/Month

> **Format dòng tổng tự động chèn:**
> ```
> CM 06/06/2026
> 📊 Tổng: Total:61 | 3day:0/0/0 | 7day:0 | Month:0  ← tự động
> Team 01
> Request Export material : total : 28  Progress 3 day: 0/0/0, 7 day: 0, Month: 0
> ...
> ```

---

## 🤖 Bots

| Bot | Token env var | Token | Chức năng | Deploy |
|---|---|---|---|---|
| `@TNIASSETorderREQUEST_BOT` | `COLLECTOR_BOT_TOKEN` | `8928677923:AAE_...` | Thu thập Order/Revoke/Export/Move/Asset Sent/Destroys | Vercel webhook |
| `@SEARCHTNITASKWOBOT` | `TELEGRAM_TOKEN` | `8606383435:AAEs...` | Tra cứu TNI Site/Task/WO + Daily Report | **Vercel webhook 24/7 (ĐÓNG BĂNG v2.0 - `f71aa5a`)** |
| `@TNIREPORTTASK_BOT` | `REPORT_TASK_BOT_TOKEN` | `8646913750:AAG3...` | ⚠️ Không dùng nữa cho nhân viên (nhân viên chưa start bot này) | — |
| `@TNITECHINICALDEPREPORT_BOT` | `TECHNICAL_DEP_BOT_TOKEN` | `8928677923:AAE_...` | Gửi cho Technical Dept (E75:E87) | GitHub Actions |
| `SEND_BOT` | `SEND_BOT_TOKEN` | `8897800070:AAHc...` | Gửi cho **TẤT CẢ**: Nhân viên + Team Leaders + Management + BOD | GitHub Actions |
| `ATTENDANCE_BOT` | `SEND_BOT_TOKEN` *(trong dự án Attendance)* | `8628370628:AAE4...` | Nhận ảnh điểm danh, đối chiếu Gemini và ghi nhận vào sheet | Webhook (Apps Script) |

---

## 📁 Files chính

| File | Deploy | Chức năng |
|---|---|---|
| [search_bot.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/api/search_bot.py) | **Vercel webhook** | Bot tra cứu TNI + Daily Report — 24/7 miễn phí |
| [collector.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/api/collector.py) | **Vercel webhook** | Bot thu thập — lưu Order/Revoke... vào Sheet |
| [cron_send.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/cron_send.py) | **GitHub Actions** | Gửi task remain hàng ngày **17:00** — dùng SEND_BOT cho tất cả. ĐK: cột A có team VÀ cột D có nội dung |
| [daily_plan_report.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/daily_plan_report.py) | **GitHub Actions** | Thu thập Daily Plan từ TL → Sheet + gửi report 3Day/7Day/Month |
| [telegram_bot.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/telegram_bot.py) | ~~GitHub Actions~~ | ⚠️ ĐÃ THAY THẾ bởi `api/search_bot.py` (Vercel webhook) |
| [apps_script_collector.js](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/apps_script_collector.js) | **Apps Script** | Backend xử lý dữ liệu Sheet |
| [auto_copy_processor.js](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/auto_copy_processor.js) | **Apps Script** | Tự động xử lý Copy-Paste & Xóa dòng theo file Config lúc 22:00 |
| [cross_check_wo.gs](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/apps_script/cross_check_wo.gs) | **Apps Script** | Tự động gửi báo cáo Cross Check WO hàng ngày lúc 17:00 |
| [auto_fetch_ict.py](file:///d:/6.%20AI/1.%20QLTC/ICT%20Fetch/auto_fetch_ict.py) | **Local PC** | Script Python cào dữ liệu ICT, tự động tịnh tiến lịch sử cột và ghi giờ Myanmar vào W1 |
| [TNI attendance.js](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/apps_script_attendance/TNI%20attendance.js) | **Apps Script** *(Dự án riêng)* | Nhận diện điểm danh khuôn mặt bằng Gemini AI, lưu Sheet & Drive |

---

## 🚀 Deploy targets

### Vercel (Collector Bot + Search Bot)
- **URL:** `https://tni-bot.vercel.app`
- **Deploy:** `npx -y vercel --prod --yes`
- **Endpoints:**
  - `/api/collector` → `api/collector.py` (Order/Revoke thu thập)
  - `/api/search_bot` → `api/search_bot.py` (TNI Search + Daily Report — **24/7**)
- **Webhook URLs:**
  - Collector: `https://tni-bot.vercel.app/api/collector`
  - Search Bot: `https://tni-bot.vercel.app/api/search_bot`
- **Set webhook:** `python setup_search_webhook.py` (chạy 1 lần)
- **Env vars trên Vercel:**
  - `TELEGRAM_TOKEN` (Search Bot)
  - `COLLECTOR_BOT_TOKEN` (Collector Bot)
  - `APPS_SCRIPT_URL`
  - `DAILY_APPS_SCRIPT_URL`
  - `CABLE_APPS_SCRIPT_URL`
  - `MDG_APPS_SCRIPT_URL`
  - `CABLE_CHAT_ID`
  - `MDG_CHAT_ID`

### GitHub Actions (Scheduled sending)
- **Repo:** `phonghdpxd-cmd/tni-bot`
- **Branch:** `main` (⚠️ KHÔNG PHẢI master!)

| Workflow | File | Schedule | Script |
|---|---|---|---|
| **Daily Task Reminder (17:00 Myanmar)** | `daily_reports.yml` (`daily_task`) | `30 10 * * *` UTC = **17:00 Myanmar** | `backlog_send.py` + `cron_send.py` |
| **Cable Daily Report (17:30 Myanmar)** | `daily_reports.yml` (`cable_report`) | `0 11 * * *` UTC = 17:30 Myanmar | `cable_report.py` |
| **Daily Plan Report** | `daily_reports.yml` (`plan_report`) | workflow_dispatch | `daily_plan_report.py` |
| **Botlookup TNI Relay** | `botlookup_relay.yml` | `0,30 22,23 * * *` + `0,30 0-14 * * *` + `0 15 * * *` UTC = 04:30–21:30 Myanmar mỗi 30p | `botlookup_relay.py` |
| ~~TNI Search Bot 24/7~~ | `tni_search_bot.yml` | **⚠️ ĐÃ TẮT** — chuyển sang Vercel webhook (`api/search_bot.py`) | ~~`telegram_bot.py`~~ |
| ~~Telegram Daily Send~~ | `telegram_send.yml` | **⚠️ ĐÃ TẮT** — cron cũ `30 17` UTC = 00:00 Myanmar (SAI) | ~~`cron_send.py`~~ |

- **Secrets trên GitHub:**
  - `SEND_BOT_TOKEN`
  - `REPORT_TASK_BOT_TOKEN`
  - `TECHNICAL_DEP_BOT_TOKEN`
  - `APPS_SCRIPT_URL`
  - `TELEGRAM_API_ID` *(dùng cho botlookup_relay)*
  - `TELEGRAM_API_HASH` *(dùng cho botlookup_relay)*
  - `TELEGRAM_SESSION` *(dùng cho botlookup_relay)*

### Apps Script
- **URL:** `https://script.google.com/macros/s/AKfycbwHyzulEMVGjslfjN_m38HzpFZHRfk2qwbQmdwb6MMqBM8xNm20JJxxzW_4zTNzp3n24Q/exec`
- **Actions:** `collect`, `done`, `get_asset_stats`, `get_report_data`, `refresh_general`

---

## 📋 Config Sheet (GID: 1236389870)

| Cột | Nội dung | Ví dụ |
|---|---|---|
| **A** | Keywords (trước dấu `:`) | `Order:`, `Revoke:`, `Export:`, `Move:`, `Asset Sent:`, `Destroys:` |
| **C** | Telegram ID nhận Asset stats | `6859790680`, `1728528589`... |
| **D** | Telegram ID được phép reply Done | `6859790680`, `1728528589`... |

---

## ⚠️ Quy tắc quan trọng

1. **Push vào branch `main`** — GitHub Actions chỉ đọc `main`
2. **Collector keywords** load động từ Config col A — thêm keyword mới chỉ cần sửa sheet
3. **Chỉ ID trong Config col D** mới được reply Done
4. **Asset stats recipients** lấy từ Config col C
5. **Row mapping**: đọc sheet PHẢI dùng `/export?format=csv` (KHÔNG dùng gviz/tq vì gviz/tq bỏ hàng trống khiến rows 56-61 trống cắt mất rows 63+ của Management)
6. **HEADER_ROWS = 3** — rows 1, 2, 3 là header (row 3 có `export sms`)
7. **Nhân viên (rows 4-32)** dùng `SEND_BOT` vì họ đã `/start` SEND_BOT — KHÔNG dùng `@TNIREPORTTASK_BOT`
8. **Tin nhắn >4096 ký tự**: tự chia nhỏ gửi nhiều message (chunk by line + by char count)
9. **Vercel** = collector bot, **GitHub Actions** = scheduled sending, **Apps Script** = data processing

---

## 🐛 Lịch sử bugs đã fix (07/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| Nhân viên không nhận tin | Dùng `@TNIREPORTTASK_BOT` nhưng họ start `SEND_BOT` | Đổi rows 4-32 sang `SEND_BOT` |
| BOD không nhận tin | `gviz/tq` cắt ở row 48 vì hàng trống rows 56-61 | Đổi sang `/export?format=csv` |
| `Message is too long` rows 31,32 | Split chỉ theo `\n` nhưng nội dung là 1 dòng siêu dài | Thêm split theo số ký tự (4000 chars/phần) |
| `APPS_SCRIPT_URL` không đọc được | Biến chưa được thêm vào GitHub Secrets | Thêm secret trên GitHub |

## 🐛 Lịch sử bugs đã fix (08/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **Technical Dept (rows 75-87) không nhận nội dung đúng** | `send_now.py` → `get_custom_messages()` dùng `gviz/tq` với `offset=74` — gviz/tq bỏ 6 hàng trống (rows 56-61) nên offset bị lệch, thực ra đang đọc rows 80-87 thay vì 75-87 | Đổi sang `/export?format=csv` + đọc theo `sheet_row` chính xác (giống `cron_send.py`) |

---

## 🐛 Lịch sử bugs đã fix (09/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **Gửi 3 lần (17:32 / 02:08 / 05:24 Myanmar)** | `telegram_send.yml` có cron `30 17 * * *` UTC = 00:00 Myanmar (comment sai: viết 10:30 UTC) → chạy lúc nửa đêm, delay thành 02-05h sáng | Tắt cron của `telegram_send.yml`, chỉ giữ `workflow_dispatch` |
| **Bot không nhận tin từ CONTROL group** | Telegram Privacy Mode BẬT → bot chỉ nhận tin bắt đầu `/` | Tắt Privacy Mode qua @BotFather hoặc cấp Admin cho bot trong group |
| **Webhook 302** | Web App deployment "Who has access" = Anyone with Google account thay vì Anyone | Đổi sang polling `getUpdates` — không cần webhook |

---

## 🤖 Site Down Auto-Notify (09/06/2026)

**File:** [`site_down_notify.gs`](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/site_down_notify.gs) — trong cùng repo `phonghdpxd-cmd/tni-bot`

### Flow hoạt động
```
Báo cáo site down → Gửi vào nhóm CONTROL (-5251698940)
         ↓
Apps Script trigger 5 phút → fetchTelegramUpdates() (polling getUpdates)
         ↓
Ghi vào Col A của Sheet: 1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow (tab GID=0)
         ↓ Col C công thức tự tính
checkColC() → readColCRaw() → bọc <pre>...monospace...</pre>
  ├── CONTROL  → Toàn bộ Col C (full)
  ├── Team 1   → Header + summary T1 + site | T1 |
  ├── Team 2   → Header + summary T2/T5 + site | T2 | | T5 |
  ├── Team 3   → Header + summary T3 + site | T3 |
  └── Team 4   → Header + summary T4 + site | T4 |
         ↓
checkAwAz() → AW4:AZ8 summary → Gửi Tin 2 cho T1/T2/T3/T4
```

### Format Tin 1 (monospace `<pre>`)
```
TNI Site down | DG+Solar+BB    Time down *<7day*
Total Site down: 21, IGT: 4...
Team 1: Total Site down: 11...
...
1: TNI0185 | T1 | 0.36 | MyTel | DG+Solar+BB | Yebyu | Thu Rain Niang | 1 | EAT: ...
```
→ Hiển thị dạng bảng monospace xanh trong Telegram (`<pre>` + `parse_mode: HTML`)

### Bot & Groups
| Bot Token | Nhóm nhận |
|---|---|
| `8647102342:AAGwI95-...` | T1(-5180992881), T2(-5188855349), T3(-5183480727), T4(-5238696719), CONTROL(-5251698940) |

### Apps Script trigger
- **Script ID:** `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR`
- **Trigger:** `checkAndSend()` mỗi 5 phút (cài bằng `setupSdTrigger()`)
- **Polling key:** `SD_LAST_UPDATE_ID` trong PropertiesService
- **Không dùng webhook** (đã thử nhưng lỗi 302 do Privacy Mode)
- **Parse mode:** `HTML` (`<pre>` cho monospace xanh)

---

## 🐛 Lịch sử bugs đã fix (09/06/2026 — phần 2)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **Tin 1 quá dài, khó đọc** | Format cũ: 4 dòng/site (số thứ tự, địa chỉ, EAT...) | Đổi sang `<pre>` monospace, mỗi site 1 dòng |
| **Teams nhận tin của tất cả teams** | Gửi full Col C cho mọi group | Lọc theo `\| T1 \|`, `\| T2 \|`... gửi đúng team |
| **CONTROL không nhận full** | Chỉ gửi per-team | CONTROL riêng → nhận toàn bộ Col C |
| **getUpdates rỗng sau testGetUpdatesRaw** | `offset=0` consume updates sớm hơn | Thêm log offset + raw, fix `lastId=0 → offset=0` |
| **Polling không nhận tin dù bot active** | Privacy Mode BẬT trên Telegram | Tắt qua @BotFather → bot nhận tất cả tin group |

---

## 🐛 Lịch sử thay đổi (09/06/2026 — phần 3)

| Thay đổi | Chi tiết |
|---|---|
| **botlookup_relay.py delay: 3–21p → 1–5p** | `MIN_DELAY_SEC = 1*60`, `MAX_DELAY_SEC = 5*60` — delay ngắn hơn vì công ty đã update TRƯỚC trigger, không cần đợi lâu. Timeout workflow: 50p → 15p |

---

## 🤖 Daily Attendance System (21/07/2026)

**File:** [`TNI attendance.js`](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/apps_script_attendance/TNI%20attendance.js) — trong repo `phonghdpxd-cmd/tni-bot`

### Flow hoạt động
```
Nhân viên gửi ảnh điểm danh (kèm/không kèm caption) vào chatbot Attendance
         ↓
Telegram Webhook chuyển tiếp đến Web App URL của dự án Apps Script riêng biệt
         ↓
Kiểm tra và chặn trùng lặp tin bằng CacheService (update_id trong 10 phút)
         ↓
Tải ảnh từ Telegram → Lưu vào thư mục Google Drive (1qT8RxGKgVyUo-EG7...)
         ↓
Đọc database nhân viên (tab "Staff attendance")
         ↓
Gọi Gemini 2.5 Flash đối chiếu khuôn mặt & trích xuất mã TNI từ watermark/caption
         ↓
Kiểm tra trùng lặp trong ngày hôm nay theo Telegram ID (Cột D)
         ↓
Ghi nhận dòng mới vào tab "List Attendance"
         ↓
Bot gửi tin nhắn xác nhận hoàn thành điểm danh về cho người dùng/nhóm
```

### Cấu hình và Dự án Apps Script riêng biệt
- **Script ID:** `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW` (folder `apps_script_attendance`)
- **Spreadsheet ID:** `18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54` (Attendance sheet)
- **Drive Folder ID:** `1qT8RxGKgVyUo-EG7PwVvH2MSE5bxPUJb`
- **Script Properties cần thiết (Trong Apps Script Editor):**
  - `SEND_BOT_TOKEN` = `8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw` (Token bot điểm danh)
  - `ATTENDANCE_SS_ID` = `18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54` (ID bảng tính điểm danh)
  - `DRIVE_FOLDER_ID` = `1qT8RxGKgVyUo-EG7PwVvH2MSE5bxPUJb` (ID thư mục lưu ảnh)
  - `GEMINI_API_KEY` = *(API Key kết nối Gemini AI)*
- **Cách chạy khởi tạo cấu hình:** Chọn chạy hàm `initAttendanceScriptProperties()` và `setupAttendanceWebhook()` từ Editor.

---

## ⚡ Lỗi thường gặp & Xử lý nhanh

### Gửi tin trùng nhiều lần
- **Nguyên nhân:** Có ≥2 workflow cùng cron chạy cùng script
- **Fix:** Tắt cron của workflow thừa → chỉ giữ `workflow_dispatch`
- **Kiểm tra:** UTC↔Myanmar: Myanmar = UTC+6:30 (cẩn thận `30 17 UTC` = 00:00 Myanmar sáng hôm sau)

### BOD/Manager không nhận tin
- **Nguyên nhân:** Dùng `gviz/tq` đọc sheet → cắt hàng trống 56-61 → lệch row
- **Fix:** Dùng `/export?format=csv` + `HEADER_ROWS=3`

### Bot không nhận tin trong group
- **Nguyên nhân:** Privacy Mode BẬT → bot chỉ nhận tin `/command`
- **Fix:** @BotFather → `/mybots` → Bot Settings → Group Privacy → **Turn off**

### Webhook 302
- **Nguyên nhân:** Web App Google Apps Script deploy "Anyone with Google account"
- **Fix:** Redeploy → "Anyone" (không cần tài khoản)

### botlookup_relay job timeout
- **Nguyên nhân:** `timeout-minutes` nhỏ hơn delay + xử lý
- **Fix:** `timeout-minutes: 55` trong `botlookup_relay.yml`

### botlookup_relay không lấy được phản hồi
- **Nguyên nhân:** `WAIT_REPLY_SEC` quá ngắn (bot chậm)
- **Fix:** Tăng `WAIT_REPLY_SEC` lên 20-30s trong `botlookup_relay.py`

### Message is too long
- **Nguyên nhân:** Content 1 dòng siêu dài, split theo `\n` không cắt được
- **Fix:** Split thêm theo số ký tự, mỗi chunk ≤ 4000 chars

### Nhân viên không nhận tin
- **Nguyên nhân:** Dùng `@TNIREPORTTASK_BOT` cho rows 4-32 nhưng họ chưa `/start`
- **Fix:** Rows 4-32 phải dùng `SEND_BOT`

---

## 🐛 Lịch sử thay đổi (10/06/2026)

| Thay đổi | Chi tiết |
|---|---|
| **Relay gửi trực tiếp T1/T2/T3/T4** | ❌ SAI — relay chỉ trigger bot + gửi CONTROL, site_down_notify.gs lo phân phối |
| **Relay store_site_down → GAS** | ❌ Bỏ — raw data từ BOT LOOKUP thiếu `\| T1 \|` markers |
| **Relay trigger-only** | ❌ Bỏ — CONTROL không nhận gì → Col A trống |
| **Relay gửi raw → CONTROL (sạch)** | ✅ HIỆN TẠI — raw data → CONTROL → site_down_notify.gs ghi Col A |
| **Active window mở rộng** | 04:30–21:30 → 04:30–23:00 Myanmar (để test tối) |
| **Cron schedule** | Đổi từ `*/30` (48/ngày, GitHub throttle) → explicit crons (active window) |

---

## 🔄 Flow Botlookup Relay (HIỆN TẠI — 10/06/2026)

```
GitHub Actions (mỗi 30p, 04:30–23:00 Myanmar)
    ↓
botlookup_relay.py
    ├─ Đăng nhập @Phongha79 (Telethon session)
    ├─ Gửi /down_tni@auto_nocpro_bot vào BOT LOOKUP
    ├─ Chờ 35s → đọc phản hồi từ @auto_nocpro_bot
    └─ Gửi raw text (sạch, không prefix) vào CONTROL (-5251698940)
              ↓
site_down_notify.gs trigger mỗi 5 phút
    ├─ fetchTelegramUpdates() → đọc tin từ CONTROL qua SD_BOT getUpdates
    ├─ isSiteDownMessage() → check "tanintharyi" + date dd/mm/yyyy
    ├─ writeToColumnA() → ghi vào Col A của SD Sheet
    └─ checkColC() → đọc Col C formula → gửi T1/T2/T3/T4 + CONTROL
```

> **⚠️ Giới hạn:** Raw data từ BOT LOOKUP (`STATION | DURATION | OWNER | POWER`) thiếu
> `| T1 |` markers → Col C formula có thể không lọc đúng team nếu không có lookup table.
> Nếu Col C không phân tích được từ raw → dùng phương pháp thủ công bên dưới.

---

## 📋 Hướng dẫn thao tác thủ công

### Khi cần gửi ngay (không chờ tự động)

**Bước 1 — Lấy dữ liệu đầy đủ** (format có `| T1 |`):
- Vào nhóm **CONTROL** → copy tin site down đầy đủ (có emoji team 🟡T2, 🟠T5...)
- Hoặc: Ai đó forward tin gốc màu xanh vào CONTROL → site_down_notify.gs tự đọc

**Bước 2 — Paste vào Sheet** (nếu chưa auto):
- Mở [Sheet "Input Site down Telegram"](https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/edit?gid=0#gid=0)
- Click **A1** → Paste toàn bộ nội dung (mỗi dòng = 1 ô Col A)
- Col C formula tự tính ngay

**Bước 3 — Gửi ngay** (không chờ trigger 5p):
- Vào GAS Editor → Script `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR`
- Chọn function **`checkAndSend`** → ▶ Run

### Kiểm tra trigger có chạy không
- GAS Editor → **Triggers** (icon đồng hồ) → phải có `checkAndSend` mỗi 5 phút
- Nếu không có → chạy `setupSdTrigger()` một lần để tạo lại

---

## 📁 File quan trọng (10/06/2026)

| File | Mô tả |
|---|---|
| [botlookup_relay.py](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/botlookup_relay.py) | Relay: trigger bot → gửi raw data → CONTROL. Active 04:30–23:00 Myanmar |
| [.github/workflows/botlookup_relay.yml](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/.github/workflows/botlookup_relay.yml) | Workflow: 3 crons explicit trong active window, pip install telethon requests |
| [apps_script_collector.js](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/apps_script_collector.js) | GAS collector: thêm action `store_site_down` (chưa deploy, để dành) |
| [site_down_notify.gs](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/site_down_notify.gs) | GAS site down: polling CONTROL 5p → ghi Col A → gửi T1/T2/T3/T4 |

---

## 🐛 Lịch sử bugs đã fix (16/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **botlookup_relay fail toàn bộ từ ~03:30 AM** | `AuthKeyDuplicatedError` — Telethon session `TELEGRAM_SESSION` bị Telegram vô hiệu hóa do tài khoản `@Phongha79` đăng nhập từ 2 IP khác nhau cùng lúc (GitHub Actions runner IP ≠ IP cũ) | Chạy `get_session.py` trên máy local → tạo session string mới → update GitHub Secret `TELEGRAM_SESSION` |
| **Teams không nhận tin ~7 tiếng (03:43–13:31)** | Hệ quả của lỗi trên — CONTROL không nhận dữ liệu → GAS không có gì để gửi | Fix session là đủ — GAS hoạt động bình thường suốt thời gian đó |

### ⚡ Khi nào cần tạo session mới (`TELEGRAM_SESSION`)
- GitHub Actions fail với lỗi `AuthKeyDuplicatedError` hoặc `SessionExpired`
- Sau khi đổi mật khẩu Telegram `@Phongha79`
- Sau khi đăng nhập tài khoản trên thiết bị mới

### 🔧 Cách tạo session mới (< 2 phút)
```powershell
# 1. Mở PowerShell tại thư mục Task and WO
cd "D:\6. AI\1. QLTC\Task and WO"
python get_session.py

# 2. Nhập SĐT @Phongha79 → nhập OTP từ Telegram
# 3. Copy SESSION STRING xuất hiện
# 4. Vào GitHub → Settings → Secrets → TELEGRAM_SESSION → Update
# 5. Chạy thủ công workflow "Botlookup TNI Relay" để test
```

> **Script:** [`get_session.py`](file:///d:/6.%20AI/1.%20QLTC/Task%20and%20WO/get_session.py) — API_ID: `38060453` | API_HASH: `49dbb07f2d226a968571b11eab076d73`

---

## 🐛 Lịch sử bugs đã fix (18/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **CONTROL không nhận Tin 1 (Col C site list)** | `sendTelegram("<pre>...8000 chars...</pre>")` → `splitMessage` cắt giữa `<pre>...</pre>` → mỗi chunk thiếu tag đóng/mở → Telegram reject 400 "Unclosed tag". Teams ngắn hơn nên không cần split → không lỗi | Thêm hàm `sendTelegramPre()`: split nội dung TRƯỚC, rồi bọc từng chunk bằng `<pre></pre>` riêng |
| **checkColC lưu toàn bộ A1 vào PropertiesService** | A1 dài > 9KB → property bị cắt → key không khớp → gửi trùng lặp hoặc bỏ qua sai | Thay bằng `storeKey = timestamp + 60 ký tự đầu A1` (luôn < 200 bytes) |
| **TNI Search Bot chết sau ~6h, không tự restart** | `tni_search_bot.yml` chỉ có `push` + `workflow_dispatch`, không có `schedule` cron → bot chết sau timeout 350p, không bao giờ restart | Thêm cron `0 0,5,10,15,20 * * *` (mỗi 5h UTC) + `concurrency: cancel-in-progress: true` |
| **CONTROL nhận mgmt_report (cron_send.py)** | `mgmt_report` chỉ gửi cho rows 60-74 cá nhân, không gửi vào group CONTROL SITE | Thêm step 8b gửi `mgmt_report` vào CONTROL SITE dùng `TECHNICAL_DEP_BOT_TOKEN` |

---

## 🐛 Lịch sử bugs đã fix (22/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **Nhân viên (rows 4-32) nhận tin thiếu Detail** | Khi Apps Script match employee (`emp_match`), code dùng `format_employee_report()` chỉ tạo 4 dòng tóm tắt (name, rank, close%, WO remain, dep stats). Toàn bộ phần **Detail** bị mất: Cell Down, DG Abnormal, Smoke, Open Door, Battery Door, Site need refuel, danh sách site, danh sách WO | Bỏ `format_employee_report()` cho employee rows. Luôn dùng Col D content đầy đủ. Nếu nội dung > 4000 ký tự, `send_msg()` tự split thành nhiều tin |

---

## 🐛 Lịch sử bugs đã fix (23/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **Dashboard Report bảng tổng hợp hiển thị toàn 0** | `10_DASHBOARD_REPORT.gs` join Search Log với Task Remain **theo tên** (`name.toLowerCase()`). Search Log col C = Telegram `first_name` (vd: "Bhone"), Task Remain col B = tên đầy đủ (vd: "Bhone Htet Aung") → **không bao giờ khớp** → tất cả search stats = 0 | Đổi key `srch` dict từ `name` (col C, index 2) sang `user_id` (col D, index 3). Lookup đổi từ `srch[name.toLowerCase()]` sang `srch[info.chat_id]`. Vì Telegram `user_id` (Search Log col D) === `chat_id` (Task Remain col E) cho private chats |
| **Info: TNIxxxx không ghi Search Log** | `search_bot.py` chỉ gọi `log_search` khi tra cứu TNI thường (line 463-476), nhưng bỏ qua khi dùng `Info: TNIxxxx` (line 431-450) | Thêm block `log_search` fire-and-forget vào sau xử lý Info lookup (trước `return`) |
| **Dashboard đếm cả tra cứu Info (không phải TNIxxxx)** | `10_DASHBOARD_REPORT.gs` đếm tất cả rows trong Search Log, không filter theo TNI Code (col E). Khi `Info:` cũng ghi log → số liệu bị phồng | Thêm filter `tni.toUpperCase().startsWith("TNI")` trước khi đếm. Chỉ đếm tra cứu TNIxxxx thực sự |

### Dashboard Report — Match logic mới (23/06/2026)
```
Search Log (col D = user_id)  ←→  Task Remain (col E = chat_id)
       "7123456789"           ===         "7123456789"
```
> **Ưu điểm**: user_id không bao giờ thay đổi (khác first_name có thể đổi bất kỳ lúc nào trên Telegram).

### Dashboard Report — Filter logic (23/06/2026)
```
Search Log col E (TNI Code) → chỉ đếm khi bắt đầu bằng "TNI"
Bỏ qua: Info lookup (tni_code = "TNIXXXX" nhưng từ Info: flow — vẫn bắt đầu TNI → cũng được đếm)
```
> **Lưu ý**: Cả TNI lookup và Info: TNIxxxx đều ghi tni_code = "TNIxxxx" → đều được đếm (đúng logic).

---

## 🐛 Lịch sử bugs đã fix (24/06/2026)

| Bug | Nguyên nhân | Fix |
|---|---|---|
| **Search Log không ghi dữ liệu gì cả** | `APPS_SCRIPT_URL` trong Vercel bị lưu là `""` (chuỗi rỗng) → `if APPS_SCRIPT_URL:` luôn `False` → không bao giờ gọi GAS | Xóa biến cũ, thêm lại đúng URL vào Vercel, redeploy |
| **Cột Date/Time trong Search Log trống** | Dùng `setNumberFormat("@STRING@")` trên cells → lock format → gviz CSV không đọc được; `appendRow` tiếp theo kế thừa format đó từ row trên | Thêm `logSheet.getRange("A:B").setNumberFormat("General")` TRƯỚC mỗi `appendRow` để reset format |
| **Date format `dd/mm/yyyy` → trống** | Google Sheets (locale Myanmar) không parse được `"24/06/2026"` → lưu trống | Đổi sang ISO `YYYY-MM-DD` (`now_mm.strftime("%Y-%m-%d")`) — Google Sheets nhận dạng chuẩn |
| **Raw HTML gửi vào nhóm Telegram** | `botlookup_relay.py` lấy Note từ GAS, guard chỉ check `startswith("{")`. Khi GAS URL 404, response là HTML `<!DOCTYPE...>` → guard bỏ qua → gửi HTML vào tất cả groups | Thêm `is_html = raw_note.lower().startswith("<!doctype")` + check `status_code != 200` vào guard |
| **Apps Script URL bị 404 sau clasp deploy** | `clasp deploy --deploymentId` reset authorization settings của Web App → mất quyền "Execute as Me / Anyone" | **KHÔNG dùng** `clasp deploy --deploymentId` nữa. Chỉ dùng `clasp push` rồi vào UI update |

### ⚡ Search Log — Cấu trúc ghi (cập nhật 24/06/2026)

```
Sheet: Team All Find (SHEET_ID = 1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8)
Tab:   "Search Log" (GID: 1426553697)
Cột:   Date (A) | Time (B) | User Name (C) | User ID (D) | TNI Code (E)
Date:  GAS tự lấy = new Date() — KHÔNG phụ thuộc Python gửi lên
Time:  HH:MM (Myanmar UTC+6:30)
format cột A: dd/MM/yyyy (chỉ set trên dòng mới, không sựa toàn cột)
GAS:   handleLogSearch(ss, body) — dùng ss (= SHEET_ID = Team All Find)
```

> [!CAUTION]
> **handleLogSearch PHẢI dùng `ss`** (từ doPost = SHEET_ID = Team All Find). **KHÔNG dùng SD_SHEET_ID** (Site Down sheet riêng). SD_SHEET_ID chỉ dùng cho `store_site_down`.

> **botlookup_relay.py**: Guard `raw_note` phải check `is_html` (`<!doctype` / `<html`) VÀ `status_code != 200`. Nếu không, HTML 404 từ GAS sṩ bị gửi vào tất cả Telegram groups.

### ⚠️ Quy tắc QUAN TRỌNG khi sửa Apps Script (từ 24/06/2026)

```
ĐÚNG:  clasp push --force          ← chỉ đẩy code lên
       → Vào UI: Deploy → Manage Deployments → Edit → New version → Update

SAI:   clasp deploy --deploymentId  ← PHẢI TRÁNH — làm mất quyền Web App → 404
SAI:   clasp deploy                 ← tạo deployment mới chưa có quyền → 404
```


| Biến | URL |
|---|---|
| `APPS_SCRIPT_URL` | `https://script.google.com/macros/s/AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA/exec` |
| Script ID | `1rvgWwrAMDbqtmqwOfqzguXB7m9snA5UZeOs9iGu64VJbejlNAkH2m6uR` |
| Search Log GID | `1426553697` |

### ⚠️ KHI `APPS_SCRIPT_URL` THAY ĐỔI — Checklist BẮT BUỘC

> URL này được dùng ở **2 chỗ độc lập**. Đổi URL mà chỉ cập nhật 1 chỗ → các workflow còn lại bị 404 ngay!

| # | Cập nhật ở đâu | Dùng cho | Cách cập nhật |
|---|---|---|---|
| 1 | **Vercel Environment Variables** | `search_bot.py` (TNI search bot) | `vercel env rm APPS_SCRIPT_URL production --yes` → `Write-Output "URL" \| vercel env add APPS_SCRIPT_URL production` → `vercel --prod --yes` |
| 2 | **GitHub Secrets** | `botlookup_relay.py`, `telegram_send.py`, `daily_task.py` | [github.com/.../settings/secrets/actions](https://github.com/phonghdpxd-cmd/tni-bot/settings/secrets/actions) → `APPS_SCRIPT_URL` → Update |
| 3 | **`.env` local** | Test local | Sửa trực tiếp file `.env` |

**Các workflow GitHub dùng `APPS_SCRIPT_URL`:**
- `botlookup_relay.yml` — lấy site down, ghi store_site_down, đọc Note B2:B5
- `telegram_send.yml` — gửi task nhân viên
- `daily_task.yml` — daily task



> [!CAUTION]
> **ĐOẠN NÀY ĐÃ BỊ XÓA (28/06/2026)** — trước đây có 1 đoạn SAI nói `handleLogSearch` dùng `SD_SHEET_ID`.
> Thực tế `handleLogSearch` dùng `ss` (= SHEET_ID = Team All Find). Xem đoạn ĐÚNG ở dòng 465-475 phía trên.
> Đoạn sai đã gây nhầm lẫn nhiều lần. **ĐÃ XÓA VĨNH VIỄN.**

> **Lưu ý `botlookup_relay.py`**: Guard `raw_note` phải check `is_html` (`<!doctype` / `<html`) VÀ `status_code != 200`. Nếu không, HTML 404 từ GAS sẽ bị gửi vào tất cả Telegram groups.

---

## 🚫 NHỮNG THỨ KHÔNG ĐƯỢC ĐỤNG VÀO (tránh cascading failures)

> [!CAUTION]
> Đây là danh sách những thay đổi tưởng vô hại nhưng hay gây sự cố dây chuyền.

### 1. `clasp deploy` — TUYỆT ĐỐI KHÔNG DÙNG
```
SAI: clasp deploy --deploymentId <id>   ← reset quyền Web App → URL 404 ngay lập tức
SAI: clasp deploy                       ← tạo URL mới chưa có quyền → 404
ĐÚNG: clasp push --force               ← chỉ đẩy code
      → UI: Deploy → Manage Deployments → Edit → New version → Update
```

### 2. `APPS_SCRIPT_URL` — Phải cập nhật ĐỦ 3 CHỖ khi đổi URL
```
[ ] 1. Vercel: vercel env rm/add + vercel --prod --yes
[ ] 2. GitHub Secrets: Settings → Secrets → APPS_SCRIPT_URL → Update
[ ] 3. .env local (cho test)
Thiếu bất kỳ chỗ nào → workflow đó bị 404 âm thầm, không báo lỗi!
```

### 3. `setNumberFormat("@STRING@")` trong GAS — KHÔNG dùng trên cột A:B Search Log
```
Vấn đề: Lock format → appendRow tiếp theo kế thừa → gviz CSV hiển thị trống
Fix nếu lỡ dùng: thêm logSheet.getRange("A:B").setNumberFormat("General") trước appendRow
```

### 4. `handleLogSearch` — DÙNG `ss` (đúng), KHÔNG dùng SD_SHEET_ID (sai)
```javascript
// ĐÚNG: ss từ doPost = SHEET_ID = "1Etd2P..." = Team All Find — đúng sheet!
let logSheet = ss.getSheetByName(SEARCH_LOG_TAB);

// SAI: SD_SHEET_ID = "1FvDhIwq8..." = Site Down sheet riêng, user không thấy Search Log ở đó:
const logSS = SpreadsheetApp.openById("1FvDhIwq8...");
let logSheet = logSS.getSheetByName(SEARCH_LOG_TAB);
```

### 5. Guard HTML trong `botlookup_relay.py` — Phải check ĐỦ điều kiện
```python
# ĐÚNG:
is_json    = raw_note.startswith("{") or raw_note.startswith("[")
is_html    = raw_note.lower().startswith("<!doctype") or raw_note.lower().startswith("<html")
is_invalid = not raw_note or is_json or is_html or note_resp.status_code != 200

# SAI (thiếu check HTML → khi GAS 404, HTML bị gửi vào tất cả Telegram groups):
if raw_note and not raw_note.startswith("{") and not raw_note.startswith("["):
```

### 6. `setNumberFormat` trên toàn bộ cột — GÂY RA LỖI NGHIEM TRỌNG
```javascript
// SAI — format cả cột làm getLastRow() trả về 1000+ → appendRow() ghi vào row 1017+!
logSheet.getRange("A:B").setNumberFormat("General");   // ← NEVER DO THIS
logSheet.getRange("A:B").setNumberFormat("dd/MM/yyyy"); // ← NEVER DO THIS

// ĐÚNG — chỉ format đúng dòng mới:
const newRow = ...; // tìm bằng scan cột C
logSheet.getRange(newRow, 1).setNumberFormat("dd/MM/yyyy");
logSheet.getRange(newRow, 2).setNumberFormat("HH:mm");
```

### 7. `getLastRow()` — KHÔNG đáng tin khi có format trên ô trống
```javascript
// getLastRow() tính cả các ô chỉ có FORMAT (không có giá trị) → trả về số sai!
// appendRow() cũng dùng getLastRow() → ghi vào row sai!

// Fix — scan cột C (User Name) tìm ô trống đầu tiên:
const SCAN_LIMIT = 600;
const colC = logSheet.getRange(2, 3, SCAN_LIMIT, 1).getValues();
let nextRow = SCAN_LIMIT + 2;
for (let i = 0; i < colC.length; i++) {
  if (!colC[i][0] || colC[i][0].toString().trim() === "") {
    nextRow = i + 2; break;
  }
}
logSheet.getRange(nextRow, 1, 1, 5).setValues([[dateObj, gasTime, userName, userId, tniCode]]);
```

### 8. 🔒 `APPS_SCRIPT_URL` trên Vercel — ĐÃ MẤT 2 LẦN (24/06 + 28/06) — ĐÓNG BĂNG!
```
⚠️ APPS_SCRIPT_URL bị mất trên Vercel = Search Log CHẾT ÂM THẦM (không báo lỗi gì cả!)

URL hiện tại (ĐÚNG — KHÔNG ĐỔI):
https://script.google.com/macros/s/AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA/exec

Phải có ở CẢ 3 CHỖ:
  [x] Vercel Production env var → search_bot.py → log_search (Search Log)
  [x] GitHub Secret             → botlookup_relay.py → store_site_down
  [x] .env local                → test local

Khi nào cần kiểm tra:
  - Sau BẤT KỲ lần `vercel --prod` nào
  - Sau khi thêm/xóa env var khác trên Vercel  
  - Khi Search Log ngừng ghi dữ liệu mới

Cách kiểm tra nhanh:
  npx -y vercel env ls production
  → phải thấy APPS_SCRIPT_URL trong danh sách!
```

---

## 📝 Lịch sử sựa lỗi

### 24/06/2026 — Search Log + Site Down pipeline
| Vấn đề | Nguyên nhân | Fix |
|---|---|---|
| Search Log không ghi sau 17/06 | `APPS_SCRIPT_URL` trống trong Vercel | Cập nhật Vercel env var |
| Data ghi vào row 1017 thay vì 133 | `setNumberFormat("A:B")` làm format cả 1000 ô trống | Dùng scan cột C tìm nextRow |
| Date hiển thị là số (46190) thay vì 17/06/2026 | `setNumberFormat("General")` xóa format date cũ | Chỉ format dòng mới, dùng Date object |
| Site Down không ghi vào cột A | `APPS_SCRIPT_URL` trống trong GitHub Secret | Cập nhật GitHub Secret |

### 28/06/2026 — Search Log lần 2 + Date parsing
| Vấn đề | Nguyên nhân | Fix |
|---|---|---|
| Search Log ngừng ghi từ 27/06 | `APPS_SCRIPT_URL` lại bị mất trên Vercel (lần 2!) | Thêm lại env var + redeploy Vercel |
| Search Stats luôn = 0 | `getValues()` trả Date object, `toString()` cho `"Fri Jun 26..."` → `split("/")` fail → skip tất cả rows | Thêm helper `dateToStr()` — `instanceof Date` → `Utilities.formatDate()` |
| system_map.md mâu thuẫn | Đoạn 518-532 nói SAI rằng `handleLogSearch` dùng `SD_SHEET_ID` (ngược với đoạn 465-475 ĐÚNG) | Xóa đoạn sai, ghi chú cảnh báo |

### 29/06/2026 — Botlookup relay workflow & GAS active window check
| Vấn đề | Nguyên nhân | Fix |
|---|---|---|
| GitHub Actions chạy 24/7 lãng phí | GAS gọi API dispatch workflow 30 phút một lần vô điều kiện, kể cả ban đêm | Thêm check khung giờ hoạt động (04:00 - 21:30 Myanmar) vào `relayBotlookupToTNI()` trước khi gọi dispatch |
| GitHub Actions mất thời gian cài pip | Chưa có cơ chế cache dependencies cho workflow | Thêm cache 'pip' vào `botlookup_relay.yml` và thêm `telethon>=1.30.0` vào `requirements.txt` |

---

## 🔒 ĐÓNG BĂNG — Các thành phần ĐÃ HOẠT ĐỘNG (29/06/2026)


> [!CAUTION]
> Các thành phần dưới đây đã được xác nhận hoạt động đúng. **KHÔNG SỬA** trừ khi có lý do rõ ràng.

### 1. Search Log — GHI (handleLogSearch)
```
✅ ĐÃ XÁC NHẬN HOẠT ĐỘNG 28/06/2026
File:  apps_script_collector.js → handleLogSearch(ss, body)
Sheet: SHEET_ID = "1Etd2P..." (Team All Find) — dùng ss từ doPost
Tab:   "Search Log" (GID: 1426553697)
Ghi:   dateObj (Date object) + gasTime + userName + userId + tniCode
Scan:  Cột C tìm ô trống đầu tiên (KHÔNG dùng getLastRow)
Format: dd/MM/yyyy chỉ trên dòng mới

KHÔNG ĐỤNG: dòng 576-614 trong apps_script_collector.js
```

### 2. Search Log — ĐỌC (dateToStr helper)
```
✅ ĐÃ XÁC NHẬN HOẠT ĐỘNG 28/06/2026
Helper: dateToStr(val) — dòng 566-571 trong apps_script_collector.js
  - Date object → Utilities.formatDate(val, "Asia/Rangoon", "dd/MM/yyyy")
  - String      → giữ nguyên

Dùng ở 3 chỗ:
  1. refreshStats()         — dòng 676
  2. buildSearchStatsMap()  — dòng 836
  3. drGatherData()         — 10_DASHBOARD_REPORT.gs dòng 133

KHÔNG ĐỤNG: hàm dateToStr() và 3 chỗ gọi nó
```

### 3. APPS_SCRIPT_URL trên Vercel
```
✅ ĐÃ XÁC NHẬN HOẠT ĐỘNG 28/06/2026
URL: https://script.google.com/macros/s/AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA/exec

Kiểm tra sau MỖI lần deploy Vercel:
  npx -y vercel env ls production
  → PHẢI thấy APPS_SCRIPT_URL!

KHÔNG ĐỤNG: Không xóa, không đổi URL trừ khi GAS deployment thay đổi
```

### 4. Vercel search_bot.py — log_search flow
```
✅ ĐÃ XÁC NHẬN HOẠT ĐỘNG 28/06/2026
Flow: User gõ TNIxxxx → bot trả kết quả → gọi GAS log_search → ghi Search Log
File: api/search_bot.py dòng 472-489
Guard: if APPS_SCRIPT_URL: (dòng 474)
Timeout: 25s (đủ cho GAS cold start)

KHÔNG ĐỤNG: dòng 460-489 trong api/search_bot.py
```

### 5. Vercel collector.py — Collector Keyword Matching
```
✅ ĐÃ XÁC NHẬN HOẠT ĐỘNG 28/06/2026
Flow: Nhân viên gửi tin nhắn có từ khóa (Order, Revoke...) -> Bot lưu vào Sheet "Asset order and request"
File: api/collector.py dòng 245-256 (hàm is_collector_msg)
Logic: Match từ khóa ở đầu tin nhắn hoặc đầu dòng mới, không phân biệt hoa thường, cho phép có hoặc không có dấu ":"
Mẫu thử nghiệm: "Order SC/path cord", "Order: SC/path", "ORDER...", "hello\nOrder..."

KHÔNG ĐỤNG: dòng 245-256 trong api/collector.py
```

### 6. Asset Collection Logic (GAS & Python)
```
✅ ĐÃ XÁC NHẬN HOẠT ĐỘNG 28/06/2026
Flow:
  - Tin nhắn chứa keyword (Order, Revoke...) -> api/collector.py gửi POST đến GAS action "add"
  - GAS apps_script_collector.js:handleAdd(sheet, body) ghi:
      - Cột A: REF (Số thứ tự tự tăng = row - 1)
      - Cột B: Date Sent (Thời gian gửi)
      - Cột C: Telegram ID (ID người gửi)
      - Cột D: Content (Nội dung tin nhắn gốc)
      - Cột E: Asset action done (Mặc định trống)
  - Ảnh gửi kèm -> upload qua action "add_photo" bằng Base64 -> lưu Drive -> ghi link vào cột F–Q (tối đa 12 ảnh)
  - Xác nhận hoàn thành -> action "done" -> ghi "Done + ngày giờ + tên Admin" vào cột E

KHÔNG ĐỤNG:
  - Hàm handleAdd() dòng 166-212 trong apps_script_collector.js
  - Hàm handleAddPhoto() dòng 219-315 trong apps_script_collector.js
  - Hàm handleDone() dòng 318-380 trong apps_script_collector.js
```

### 7. Auto Copy & Delete Processor (auto_copy_processor.js)
```
✅ ĐÃ XÁC NHẬN HOẠT ĐỘNG 28/06/2026
Flow:
  - Lịch trình: Trigger tự động chạy 22:00 hàng ngày (Myanmar Time)
  - Spreadsheet cấu hình: 19RBlwehMC6BLoueaTEzsJHMx4puB0CTE5i5x79-uI6c (tab Auto_Copy_Config)
  - Dữ liệu cấu hình gồm 10 cột (A:J):
      - Cột A đến I: Link/Tab/Cột điều kiện cho Copy, Paste và Delete Row
      - Cột J (Sort): Tên sheet + cột cần sort A:Z sau khi paste xong (Ví dụ: "2.1 Your Data solution!D")
  - Tối ưu hóa: Sử dụng cache ssCache_ để tránh gọi mở file nhiều lần, tăng tốc độ xử lý gấp 5-10 lần khi có 50+ hàng cấu hình.
  - Sắp xếp thông minh: Sử dụng thuật toán sort mảng JavaScript, tự động ép các dòng trống và các dòng có dấu gạch ngang "-" ở cột sort xuống dưới cùng bảng tính, đồng thời di chuyển cả định dạng dòng (màu nền, độ đậm chữ).
  - Tự sửa lỗi cấu hình: Tự động loại bỏ tên sheet trước dấu chấm than "!" nếu người dùng điền thừa ở cột điều kiện (VD: "1. BOD+MANAGER Assign!A:A" -> tự tách lấy cột A).

KHÔNG ĐỤNG:
  - Toàn bộ file auto_copy_processor.js
```

### 8. Task Reminder Consolidation & Asset Double Send Fix (02/07/2026)
```
✅ ĐÃ XÁC NHẬN HOẠT ĐỘNG 02/07/2026
Flow:
  - Sửa lỗi Asset gửi 2 lần ở CONTROL: loại bỏ "CRON_ASSET_CONTROL" khỏi ASSET_RECIPIENTS trong cron_send.py.
  - Cho phép Technical Dept (rows 75-87) bypass Chat ID check trong cron_send.py để luôn gộp báo cáo gửi CONTROL.
  - Chuyển đổi combined_bot.py (Render worker) từ gửi cá nhân sang gửi báo cáo gộp cho 3 nhóm chính lên CONTROL:
      - Employees (dòng 4-32) -> 📋 3. Report — Employees Task Progress
      - Management (dòng 33-74) -> 📋 7. Report — Management Task Progress
      - Technical Dept (dòng 75-87) -> 📋 1. Report — Technical Dept Task Progress
  - Sử dụng SHEET_URL dạng /export?format=csv và HEADER_ROWS = 3 để đảm bảo chính xác dòng cho combined_bot.py.
  - Sử dụng hàm bổ trợ send_msg tự động split tin nhắn dài vượt 4000 ký tự với retry/timeout.

KHÔNG ĐỤNG:
  - Logic gửi gộp và xóa tin cũ trong combined_bot.py và cron_send.py
```


