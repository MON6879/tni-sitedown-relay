# 💎 STRICT RULE: LÀM TRIỆT ĐỂ 100% — KHÔNG BỎ CUỘC KHI GIÁN ĐOẠN, NHÌN THẤY HẾT DỮ LIỆU MỚI ĐƯA PHƯƠNG ÁN (100% PERSISTENT & EXHAUSTIVE EXECUTION POLICY)

> ⚠️ **QUY TẮC BẮT BUỘC TỐI THƯỢNG (ZERO-SHORTCUT & PERSISTENCE POLICY)**: 
> 1. **Làm Triệt Để 100% (Exhaustive Full Scope)**: Tuyệt đối KHÔNG làm tiện tay, không sửa nửa vời, không để lại bất kỳ dữ liệu tĩnh cũ, ngày tháng sai lệch hay layout lỗi trên bất kỳ component nào.
> 2. **Không Bỏ Cuộc Khi Gián Đoạn (Persistent Continuation)**: Khi gặp lỗi gián đoạn (timeout, disconnected, network error, browser cache, API error...), BẮT BUỘC phải tự động kiên trì tiếp tục thực hiện từng bước, retry liên tục cho đến khi hoàn tất trọn vẹn 100% mục tiêu, KHÔNG được dừng lại giữa chừng rồi báo cáo hoàn thành ảo!
> 3. **Nhìn Thấy Hết Dữ Liệu Thực Tế Mới Đưa Phương Án (Look at All Real Data First)**: Trước khi đề xuất phương án hoặc viết code, BẮT BUỘC phải dùng script/query quét và đọc trực tiếp 100% dữ liệu nguồn thực tế (Google Sheets, Live Web DOM, Telegram API, GAS), nhìn thấy toàn bộ các dòng, cột, modal, table rồi mới đưa ra giải pháp xử lý triệt để, KHÔNG được giả định hay đoán mò!
> 4. **Kiểm Tra Thực Tế & Đầy Đủ Bằng Chứng (Live Output Verification)**: Sau khi thực hiện, phải kiểm tra live (HTTP 200, grep so khớp, live log), chứng minh đã chạy thông suốt rồi mới bàn giao cho Người Dùng.

---

# ⚡ STRICT PRIORITY RULE: GAS DIRECT SENDING FIRST, GITHUB ACTIONS FALLBACK SECOND

> ⚠️ **QUY TẮC BẮT BUỘC**: MỌI BẢN TIN / THÔNG BÁO / BÁO CÁO CÓ THỂ GỬI ĐƯỢC BẰNG GOOGLE APPS SCRIPT (GAS) QUA `UrlFetchApp.fetch()` BẮT BUỘC PHẢI ƯU TIÊN GỬI TRỰC TIẾP TỪ GAS TRÊN GOOGLE CLOUD; CHỈ KHI GAS KHÔNG THỂ XỬ LÝ ĐƯỢC (TÁC VỤ CẦN TÀI KHOẢN NICK CÁ NHÂN USER ACCOUNT TELETHON SEED HOẶC THAO TÁC CÀO DỮ LIỆU ĐẶC THÙ) MỚI DÙNG GITHUB ACTIONS DỰ PHÒNG!

---

# 🚨 STRICT RULE: TUYỆT ĐỐI KHÔNG ĐƯỢC XÓA / GHI ĐÈ FILE GAS KHI CHƯA CÓ SỰ ĐỒNG Ý CỦA NGƯỜI DÙNG

> ⚠️ **QUY TẮC BẮT BUỘC (GAS FILE PROTECTION POLICY)**: TUYỆT ĐỐI KHÔNG ĐƯỢC THỰC HIỆN BẤT KỲ THAO TÁC NÀO SAU ĐÂY MÀ CHƯA CÓ SỰ ĐỒNG Ý RÕ RÀNG BẰNG VĂN BẢN CỦA NGƯỜI DÙNG:
> 1. **KHÔNG XÓA** bất kỳ file `.gs` nào khỏi thư mục clasp (`QLTC_GAS`, `Task and WO/apps_script`), kể cả file "thừa" hay "không dùng".
> 2. **KHÔNG `clasp push`** khi thư mục local thiếu file so với GAS cloud. PHẢI kiểm tra đủ 18 file trước khi push.
> 3. **KHÔNG REWRITE/VIẾT LẠI TOÀN BỘ** bất kỳ file `.gs` nào. Chỉ được sửa đúng dòng cần thiết (dùng replace, KHÔNG overwrite toàn bộ).
> 4. **PHẢI HỎI NGƯỜI DÙNG** trước khi thêm/xóa/đổi tên bất kỳ file `.gs` nào: _"Tôi muốn [thao tác]. Anh có đồng ý không?"_
> 5. **Bài học v599**: Một phiên AI trước đã tự ý xóa 13/18 file GAS rồi `clasp push` → mất toàn bộ hệ thống. KHÔNG BAO GIỜ ĐƯỢC LẶP LẠI!

---

# 🎯 STRICT RULE: PHẢI XÁC ĐỊNH ĐÚNG DỰ ÁN GAS TRƯỚC KHI SỬA — TUYỆT ĐỐI KHÔNG TIỆN TAY UPDATE TẦM BẬY VÀO CHỖ KHÁC (EXACT DEDICATED GAS TARGETING POLICY)

> ⚠️ **QUY TẮC BẮT BUỘC (EXACT GAS PROJECT TARGETING)**: TRƯỚC KHI SỬA HOẶC THÊM BẤT KỲ TÍNH NĂNG NÀO TRÊN GOOGLE APPS SCRIPT (GAS), BẮT BUỘC PHẢI TRA CỨU ĐỐI CHIẾU ĐÚNG DỰ ÁN GAS CHUYÊN BIỆT THEO BẢN ĐỒ ĐỊNH DANH 4 DỰ ÁN GAS. TUYỆT ĐỐI KHÔNG ĐƯỢC TIỆN TAY SỬA NHẦM, UPDATE TẦM BẬY HOẶC NHỒI NHÉT CODE CỦA DỰ ÁN NÀY SANG DỰ ÁN KHÁC!
>
> ### 🗺️ Bản Đồ 4 Dự Án GAS Chuẩn Của Hệ Thống:
> 1. **Dự Án GAS Điểm Danh (TNI Attendance Bot)**:
>    - **Thư mục local:** `Task and WO/apps_script_attendance`
>    - **File xử lý chính:** `TNI attendance.js` (Script ID: `166XawHNCvkXmo7NGjydYJPTpaQMr1FTk_cqFSjFm8yiSxLEjsyr73XtW`)
>    - **Phạm vi quản lý:** Bot Điểm Danh `@8628370628`, xử lý ảnh điểm danh, thu thập bảng `Sum report morning attendance`, `List Attendance`, tra cứu Telegram ID từ `Staff attendance`, cấp phát template `Template Attendance`. MỌI LOGIC ĐIỂM DANH BẮT BUỘC SỬA TẠI ĐÂY!
> 2. **Dự Án GAS Tổng (Main TNI Operations Backend — QLTC_GAS)**:
>    - **Thư mục local:** `QLTC_GAS` (và bản copy `Task and WO/apps_script`)
>    - **Phạm vi quản lý:** Backend tổng hợp Cable, MDG, Refuel Request & Plan, BI Plan Dep, BOD assign, Daily Report, Cross Check WO, Site Down Alarms.
> 3. **Dự Án GAS Site Down Bot (TNI Site Down Relay Bot)**:
>    - **Thư mục local:** `Task and WO/apps_script_sitedown`
>    - **Phạm vi quản lý:** Bot `@tni_site_down_bot` tiếp nhận cảnh báo trạm down.
> 4. **Dự Án GAS Construction (TNI Construction Bot)**:
>    - **Thư mục local:** `Task and WO/apps_script_tc`
>    - **Phạm vi quản lý:** Bot `@8903841312` (`10 TNI_SITE`) quản lý tiến độ xây dựng hạ tầng.

---

# 🛡️ STRICT RULE: KIẾN TRÚC 7 TRỤ CỘT BẤT KHẢ XÂM PHẠM (ZERO-FAILURE ARCHITECTURE)

> ⚠️ **QUY TẮC BẮT BUỘC (ZERO BUG POLICY)**: TUYỆT ĐỐI KHÔNG ĐƯỢC CÀI ĐẶT CODE CÓ KHẢ NĂNG GÂY NGHẼN, TỰ HỦY RUNNER HAY SẬP CHUỖI LIÊN HOÀN (DÙ CỐ Ý HAY VÔ TÌNH). MỌI COMPONENT BẮT BUỘC PHẢI TUÂN THỦ 7 TRỤ CỘT:
> 1. **Cửa Sổ Kháng Trễ Chặt (Tight Sliding Window Timing)**: Cửa sổ chấp nhận trễ tối đa ±4 phút. Nhịp :06 chấp nhận :00-:10; phút :11-:20 sleep đến :36. Nhịp :36 chấp nhận :21-:40; phút :41-:59 sleep đến :06 giờ kế. TUYỆT ĐỐI KHÔNG chạy ngay tại :20 hay :50!
> 2. **Quét Lịch Sử Duy Nhất 1 Lần (Single-Pass Scanning)**: Mỗi nhóm Telegram chỉ quét đúng 1 lần duy nhất (< 3s) và so khớp tiêu đề trong RAM, triệt tiêu 100% nguy cơ Timeout và Telegram FloodWait.
> 3. **Cô Lập Lỗi Độc Lập (Zero Cascading Failure)**: Mọi script độc lập phải được bọc cô lập lỗi (`python script.py || true`) để không bao giờ làm chết chùm các báo cáo khác.
> 4. **Khóa Độc Quyền Phiên Telethon (Concurrency Locking)**: Cài đặt `concurrency: group: ...` trên GitHub Actions để các tác vụ Telethon không bao giờ tranh chấp hay đè phiên.
> 5. **Kênh Kép Song Hành (GAS Direct First, GitHub Second)**: GAS Cloud đảm nhiệm phát tin chính; GitHub Actions đóng vai trò dự phòng và cào Telethon.
> 6. **Cô Lập Biến Toàn Cục GAS (GAS Global Scope Isolation)**: Tất cả file `.gs` trong cùng 1 dự án dùng chung Global Scope — KHÔNG khai báo trùng tên biến. Chỉ giữ 4 dự án GAS chuẩn (TNI = 18 files, TNI Site Down Bot, TNI Attendance Bot, TC). ⚠️ `clasp push` SẼ XÓA file trên GAS mà không có trong thư mục local — PHẢI đảm bảo đủ 18 file trước khi push!
> 7. **Xử Lý Gia Tăng Chống Timeout (Incremental Processing)**: GAS giới hạn 6 phút — phải đánh dấu dòng đã xử lý (Note), chỉ xử lý dòng MỚI, có cơ chế dừng an toàn 5 phút. KHÔNG dùng `--force` trên workflow_dispatch tự động.

---

# 🇬🇧 STRICT RULE: CHATBOT RESPONSES & TEMPLATE CONTENTS MUST BE IN ENGLISH

> ⚠️ **QUY TẮC BẮT BUỘC**: TOÀN BỘ NỘI DUNG PHẢN HỒI TỰ ĐỘNG, THÔNG BÁO, MENU VÀ TEMPLATE CỦA CHATBOT GỬI TRÊN TELEGRAM BẮT BUỘC PHẢI BẰNG TIẾNG ANH 100% (ENGLISH ONLY FOR ALL BOT MESSAGES & TEMPLATES).

---

# ⏰ STRICT SCHEDULE RULE: REPORT 1, 2, 3, 4 DAILY SENDING TIMES

> ⚠️ **QUY TẮC BẮT BUỘC**: THỜI GIAN GỬI BÁO CÁO TỰ ĐỘNG CHO REPORT 1, 2, 3, 4 (TEAMS 1 TO 4 VIA GITHUB ACTIONS — TOA 1+11) LÀ ĐÚNG **05:48 AM** VÀ **15:48 PM** HÀNG NGÀY; VÀ TOA BOTLOOKUP RELAY LÀ ĐÚNG PHÚT **:06** VÀ **:36** HÀNG GIỜ (MÚI GIỜ MYANMAR `Asia/Yangon` UTC+6:30).

---

# 🛡️ STRICT RULE: ĐỌC VÀ TUÂN THỦ TUYỆT ĐỐI DOCUMENTATION TRƯỚC KHI SỬA KẾT NỐI & ENDPOINT

> ⚠️ **QUY TẮC BẮT BUỘC**: TUYỆT ĐỐI KHÔNG ĐƯỢC TIỆN TAY THAY ĐỔI HOẶC ĐOÁN ĐƯỜNG DẪN WEBHOOK / ENDPOINT CỦA BẤT KỲ BOT NÀO. PHẢI KIỂM TRA DOCS CHUẨN TRƯỚC KHI THỰC HIỆN!

---

# 📥 STRICT DATA COLLECTION RULE: NEWEST DATA ALWAYS INSERTED AT THE VERY TOP

> ⚠️ **QUY TẮC BẮT BUỘC THU THẬP DỮ LIỆU**: MỌI BỘ THU THẬP THÔNG TIN (MDG REPORT, INVENTORY, REFUEL REQUEST, DAILY REPORT, DAILY PLAN, READ GROUP LOGS, V.V.) KHI GHI VÀO GOOGLE SHEETS BẮT BUỘC PHẢI CHÈN DỮ LIỆU MỚI LÊN ĐẦU BẢNG TÍNH (DÒNG 2, NGAY BÊN DƯỚI HÀNG TIÊU ĐỀ HEADER ROW 1 DÙNG `insertRowsBefore(2, ...)` HOẶC RECORD DÒNG 2). TUYỆT ĐỐI KHÔNG ĐƯỢC NỐI DỮ LIỆU VÀO CUỐI BẢNG TÍNH (`appendRow`) LÀM NGƯỜI DÙNG PHẢI KÉO XUỐNG DƯỚI!

---

# 🏛️ STRICT RULE: 8 TRỤ CỘT KIẾN TRÚC BI PORTAL (BI ARCHITECTURE PILLARS)

> ⚠️ **QUY TẮC BẮT BUỘC**: MỌI TAB / COMPONENT MỚI TRÊN BI PORTAL BẮT BUỘC PHẢI TUÂN THỦ 8 TRỤ CỘT SAU. VI PHẠM = PHẢI REFACTOR TRƯỚC KHI DEPLOY!
> 1. **SSOT — Nguồn Dữ Liệu Duy Nhất (Single Source of Truth)**: TUYỆT ĐỐI KHÔNG hardcode data trong HTML. Mọi bảng dữ liệu phải được render ĐỘNG từ GAS API → `fetch()` → render DOM. Khi cần sửa nội dung hiển thị → sửa trên Google Sheet, KHÔNG sửa HTML.
> 2. **Security-First — Bảo Mật Server-Side**: Phân quyền phải được kiểm tra **tại GAS server** (đối chiếu sheet `Permit BI`), client-side chỉ là lớp UI bổ sung. KHÔNG chỉ dựa vào `localStorage` hay ẩn nút. Phân 3 cấp: VIEWER (xem) → EDITOR (sửa E:F) → ADMIN (sửa A:D + xóa).
> 3. **Separation of Concerns — Tách Biệt Trách Nhiệm**: Mỗi tab MỚI phải gói logic trong **1 namespace riêng** `window.TabName = { init, loadData, render, ... }`. KHÔNG dùng biến global rời. Mỗi tab tự quản lý fetch/render/state.
> 4. **Data Contract — Hợp Đồng Dữ Liệu**: Mọi GAS API response phải trả format chuẩn: `{ status, version, timestamp, data, meta, error }`. Column mapping khai báo trong GAS config, KHÔNG giả định thứ tự cột. Date format: `DD/MM/YYYY` (hiển thị) / ISO 8601 (API).
> 5. **Error Isolation — Cô Lập Lỗi**: 1 tab lỗi KHÔNG BAO GIỜ ảnh hưởng tab khác. Mọi `fetch()` phải có `.catch()` với fallback UI (error banner + nút Retry). Timeout fetch: max 15 giây.
> 6. **Scalable Tabs — Kiến Trúc Tab Mở Rộng**: Thêm tab mới phải theo checklist 8 bước: (1) Khai báo config, (2) Thêm nav button, (3) Thêm panel div, (4) Tạo namespace JS, (5) Đăng ký permission, (6) Thêm GAS endpoint, (7) Test isolation, (8) Cập nhật docs.
> 7. **Performance Budget — Ngân Sách Hiệu Năng**: First Contentful Paint ≤ 2s, Tab switch ≤ 100ms, API response ≤ 5s, Max 500 rows/tab (quá → pagination), Polling interval = 30s.
> 8. **Change Management — Quản Lý Thay Đổi**: Version number trong comment dòng 1 HTML. Mỗi thay đổi GAS ghi `// vYYYY-MM-DD — [mô tả]`. Backup trước khi sửa lớn. Cập nhật 3 docs: `SYSTEM_DOC.md`, `system_map.md`, `AGENTS.md`.

---

## 📌 1. Bản đồ Webhook Cố Định (Strict Endpoint Registry)

Mọi thao tác cài đặt hoặc khôi phục Webhook Telegram đều phải đối chiếu chính xác 100% với danh sách sau:

| Bot Name | Telegram Username | Webhook Endpoint URL | File Handler trong Codebase |
|---|---|---|---|
| **Search Bot** | `@SEARCHTNITASKWOBOT` | `https://tni-bot.vercel.app/api/search_bot` | `api/search_bot.py` |
| **Asset Bot (Collector)** | `@TNIASSETorderREQUEST_BOT` | `https://tni-bot.vercel.app/api/collector` | `api/collector.py` |
| **Site Down Bot (Relay)** | `@tni_site_down_bot` | `https://tni-bot.vercel.app/api/site_down_relay` | `botlookup_relay.py` |
| **Construction Bot** | `@8903841312` (`10 TNI_SITE`) | Apps Script Web App Endpoint | `13_TNI_CONSTRUCTION.gs` |

---

## 📋 2. Quy trình 3 bước bắt buộc trước khi chỉnh sửa:

1. 📖 **Đọc lại Docs hiện hành**: Phải đọc `SYSTEM_DOC.md`, `system_map.md` và `history/backup_context_...md` trước khi gọi bất kỳ lệnh `setWebhook` hay sửa URL kết nối nào.
2. 🔍 **Xác minh Bot Token & Webhook URL**: Tuyệt đối không gán nhầm Bot Token của Search Bot (`@SEARCHTNITASKWOBOT`) vào Webhook của Site Down Relay hay Collector.
3. 💾 **Thực hiện đủ 8 bước Quy tắc "LƯU ĐI" bắt buộc**:
   - **Bước 1:** Cập nhật snapshot backup context vào `history/backup_context_...md`.
   - **Bước 2:** Đồng bộ mã nguồn Python/GS qua tất cả các repo cục bộ (`tni-bot` & `tni_site_down_repo`).
   - **Bước 3:** Commit & Push lên GitHub (`phonghdpxd-cmd/tni-bot` & `MON6879/tni-sitedown-relay`).
   - **Bước 4:** Dọn dẹp sạch sẽ tất cả cache `__pycache__`.
   - **Bước 5:** **Đồng bộ 100% tất cả logic liên quan (Full Logical Cross-Sync)** — Khi sửa Endpoint/URL/Cron Schedule/Tra cứu, phải đồng bộ tức thì tất cả các file code, workflow step condition, fallback variables và tài liệu docs liên quan.
   - **Bước 6:** **Cập nhật tài liệu hệ thống (Mandatory Docs Sync)** — Khi thêm/xóa/sửa Toa, Ghế, Endpoint, Cron Schedule hoặc cấu trúc hệ thống, BẮT BUỘC phải cập nhật đồng bộ `system_map.md`, `SYSTEM_DOC.md` và `AGENTS.md` (Bản đồ Webhook) cho khớp 100% với code thực tế. TUYỆT ĐỐI KHÔNG ĐƯỢC để tài liệu lệch so với code!
   - **Bước 7:** **Kiểm thử thực tế (Live Output Verification)** — Chạy test payload/script để xác nhận 0 lỗi phát sinh và phản hồi thực tế chính xác 100%.
   - **Bước 8:** **Báo cáo rõ Số Chuyến Tàu, Số Toa Tàu & Số Ghế (Chuyến Tàu Số # — Toa # — Ghế #) đã sửa đổi trong câu trả lời cho Người Dùng (KHÔNG chèn tên/số ghế vào nội dung tin nhắn Telegram Chatbot gửi cho nhân viên)!**
