# BACKUP CONTEXT — 23/07/2026

## Vấn đề hôm nay & cách fix

### Nguyên nhân gốc
Khi migrate GitHub repo từ `phonghdpxd-cmd/TNI-SITE-DOWN` → `MON6879/tni-sitedown-relay`,
secret `SD_APPS_SCRIPT_URL` KHÔNG được copy sang repo mới.

### Hậu quả
- Relay chạy đúng giờ nhưng không POST được vào GAS
- GAS vẫn đọc data cũ từ 18:00
- Không có tin mới gửi vào nhóm T1/T2/T3/T4/CONTROL

### Cách fix (23/07/2026 ~21:00 Myanmar)
1. Lấy GAS URL từ user: `https://script.google.com/macros/s/AKfycbxVi0BGDW7B_KBxcSEdw3yuHB9Rs2BemQEYeKDwsybJQdmQv-_0HqyGHjpZI6jupxll/exec`
2. Set GitHub secret `SD_APPS_SCRIPT_URL` qua GitHub API (Python + PyNaCl)
3. Trigger relay thủ công → GAS nhận data → gửi tin thành công lúc 21:12 Myanmar

---

## URLs & Secrets quan trọng

### GAS URLs
- **Site Down (site_down_v2.gs):** `https://script.google.com/macros/s/AKfycbxVi0BGDW7B_KBxcSEdw3yuHB9Rs2BemQEYeKDwsybJQdmQv-_0HqyGHjpZI6jupxll/exec`
- **Main GAS:** `https://script.google.com/macros/s/AKfycbwHyzulEMVGjslfjN_m38HzpFZHRfk2qwbQmdwb6MMqBM8xNm20JJxxzW_4zTNzp3n24Q/exec`
- **REFUEL:** `https://script.google.com/macros/s/AKfycbwHyzulEMVGjslfjN_m38HzpFZHRfk2qwbQmdwb6MMqBM8xNm20JJxxzW_4zTNzp3n24Q/exec`
- **CABLE:** `https://script.google.com/macros/s/AKfycbwQ0nSRKOCPl7geNnANibaNd8wYKKojh2_zRo-xLpaOwepHl8W8OLVhcyrJgDo1A9UG/exec`

### GitHub Repos
- **Main (active):** `MON6879/tni-sitedown-relay` — 0.46 MB / 1000 MB (0.04%)
- **Backup:** `phonghdpxd-cmd/TNI-SITE-DOWN` — 0.33 MB

### GitHub Secrets (13 required — tất cả đã set ✅)
| Secret | Dùng cho |
|--------|---------|
| `TELEGRAM_API_ID` | Telethon login |
| `TELEGRAM_API_HASH` | Telethon login |
| `TELEGRAM_SESSION` | Telethon session |
| `SD_APPS_SCRIPT_URL` | Site Down GAS webhook ← fix hôm nay |
| `APPS_SCRIPT_URL` | Main GAS |
| `REFUEL_APPS_SCRIPT_URL` | Refuel GAS |
| `REFUEL_BOT_TOKEN` | Refuel bot |
| `COLLECTOR_BOT_TOKEN` | Collector bot |
| `SEND_BOT_TOKEN` | Send bot |
| `REPORT_TASK_BOT_TOKEN` | Report task bot |
| `TECHNICAL_DEP_BOT_TOKEN` | Technical dep bot |
| `CABLE_APPS_SCRIPT_URL` | Cable GAS |
| `CABLE_CHAT_ID` | Cable chat |

---

## Lịch tự động Site Down

| Myanmar | Sự kiện |
|---------|---------|
| **:05 phút** | GAS dispatch relay → relay bắt đầu |
| **:08 phút** | ✅ Tin 1 đến CONTROL + T1/T2/T3/T4 |
| **:35 phút** | GAS dispatch relay → relay bắt đầu |
| **:38 phút** | ✅ Tin 1 đến CONTROL + T1/T2/T3/T4 |

Hoạt động từ **3:30 → 21:39 Myanmar** mỗi ngày.

Cron GitHub Actions backup: `5,35 * * * *` UTC = `:35` và `:05` Myanmar.

---

## Dung lượng sử dụng (23/07/2026)

### GitHub
| Repo | Size | Quota |
|------|------|-------|
| MON6879/tni-sitedown-relay | 0.46 MB | 0.04% / 1000MB |
| phonghdpxd-cmd/TNI-SITE-DOWN | 0.33 MB | 0.03% / 1000MB |

### GAS (Free account)
| Tài nguyên | Dùng/ngày | Quota/ngày |
|-----------|-----------|-----------|
| Script runtime | ~19 phút | 360 phút |
| Trigger runs | 1089 lần | unlimited |
| UrlFetch calls | ~72 lần | 20,000 lần |

### GAS Free Limits
- Script runtime: **6 giờ/ngày** (360 phút) — dùng 5.3%
- Execution time tối đa 1 lần: **6 phút**
- UrlFetchApp: **20,000 calls/ngày**

---

## Code changes hôm nay (23/07/2026)
- `site_down_v2.gs` commit `d2596a2`: dispatch relay đúng phút :05 và :35 Myanmar
- Active window: 3:30 → 21:39 Myanmar
- Thêm `SD_APPS_SCRIPT_URL` vào `.env` và GitHub secrets
