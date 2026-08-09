# 📄 BACKUP CONTEXT — 10/08/2026 (FINAL AUDIT & ULTRA-STABILITY UPGRADE)

## 📌 Tóm tắt Nâng cấp Kiến trúc Hạt nhân & Siêu Ổn định (System SSOT & CI/CD Automation)

---

### 1. 🧠 Single Source of Truth (SSOT) Core Engine (`tni_search_core.py`)
- **Tạo mới `tni_search_core.py`**:
  - Chuẩn hóa toàn bộ Regex tra cứu: `INFO_RE`, `CLEAR_RE`, `TNI_RE` (exact anchor length `^\s*...$`), và `ADMIN_LOOKUP_RE`.
  - Chuẩn hóa hàm phân loại `classify_query(text)` trả về action: `INFO`, `CLEAR`, `TNI`, `ADMIN_LOOKUP`, hoặc `IGNORE`.
  - Chuẩn hóa bộ nhớ đệm chống trùng lặp `is_duplicate_search(chat_id, user_id, query)` với TTL 10 giây.
- **Đồng bộ**: Đã copy và đồng bộ sang cả 2 repo `phonghdpxd-cmd/tni-bot` và `phonghdpxd-cmd/TNI-SITE-DOWN` (`tni_site_down_repo/tni_search_core.py`).

---

### 2. 🧪 CI/CD Automated Unit Test Suite (`tests/test_routing.py`)
- **Tạo bộ test tự động 6 kịch bản**:
  - `test_info_routing`: Test `INFO: TNI0061` & `info: TNI0061_01` ➔ Match `INFO`.
  - `test_clear_routing`: Test `clear TNI0061` ➔ Match `CLEAR`.
  - `test_tni_routing`: Test `TNI0061` & `/tni TNI0061_02` ➔ Match `TNI`.
  - `test_noise_rejection`: Test `TNI0061 440L` & `TNI0061 door open` ➔ Bỏ qua 100% (`IGNORE`).
  - `test_admin_lookup`: Test `mydata 123456` & `/mysite 987654321` ➔ Match `ADMIN_LOOKUP`.
  - `test_dedup_cache`: Test cơ chế chống trùng lặp trong phạm vi TTL.
- **Kết quả**: Run `python tests/test_routing.py` ➔ **PASS 100%**.

---

### 3. 🤖 GitHub Actions Automated Regression Workflow (`.github/workflows/regression_test.yml`)
- **Tự động hóa CI/CD**: Mỗi lần push hoặc pull request lên branch `main`, GitHub Actions sẽ tự động kích hoạt `test_routing.py` để đảm bảo code mới không bao giờ làm hỏng quy tắc phân luồng tìm kiếm.

---

### 4. 🏥 Endpoints & Apps Script Health Check Auditor (`health_check.py`)
- **Kiểm tra tự động tất cả WebApp URLs & Vercel Webhooks**:
  - Main Apps Script (`@302`): ✅ OK (HTTP 200)
  - Refuel Apps Script (`@71`): ✅ OK (HTTP 200)
  - Site Down Apps Script: ✅ OK (HTTP 200)
  - Vercel Webhooks (`/api/search_bot`, `/api/collector`, `/api/refuel_collector`): ✅ OK (HTTP 200)
- **Khắc phục lỗi 404 URL Construction**: Phát hiện URL cũ `AKfycbHraNPz...` bị Google 404 ➔ Đã cập nhật `keepalive_construction.yml` và `health_check.py` sang đúng URL Main GAS WebApp (`AKfycbz-NZlBk8q2...` @302).

---

## 📋 Registry Endpoint Cố định (Updated 10/08/2026)

| Service / Bot | Endpoint / WebApp URL | Status |
|---|---|---|
| **Search Bot** | `https://tni-bot.vercel.app/api/search_bot` | ✅ 200 OK |
| **Asset Collector** | `https://tni-bot.vercel.app/api/collector` | ✅ 200 OK |
| **Refuel Collector** | `https://tni-bot.vercel.app/api/refuel_collector` | ✅ 200 OK |
| **Main Apps Script** | `https://script.google.com/macros/s/AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA/exec` (@302) | ✅ 200 OK |
| **Refuel Apps Script** | `https://script.google.com/macros/s/AKfycbyCibIj4QN7oG5BZc_ju1iS-DUmd9nNdrMn9UN-WD8qf6jVoU_OKOf2yfbi10qGMFF-/exec` (@71) | ✅ 200 OK |
| **Attendance Bot** | `Apps Script Cloud` (Version @41) | ✅ 200 OK |
