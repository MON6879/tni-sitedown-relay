# 📌 System Snapshot Backup — 04/08/2026 (TELEGRAM MENU CACHE INVALIDATION)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot - Xóa bộ nhớ đệm cũ & Nạp mới trọn bộ 17 lệnh lên Nút Menu Telegram.**

---

## ⚡ XÓA CACHE MENU CŨ & NẠP TRỌN BỘ 17 LỆNH NÚT MENU TELEGRAM (`deleteMyCommands` + `setMyCommands`)
- **Phát hiện nguyên nhân Telegram Desktop chưa hiển thị lệnh mới**:
  - Telegram Desktop ứng dụng máy tính lưu bộ nhớ đệm (cache) danh sách lệnh cũ. Nếu chỉ gọi `setMyCommands`, ứng dụng Telegram Desktop chưa chịu làm mới UI ngay.
- **Khắc phục triệt để**:
  1. Thêm lệnh `deleteMyCommands` với `scope: {"type": "default"}` để cưỡng chế xóa bỏ hoàn toàn bộ nhớ đệm lệnh cũ trên ứng dụng Telegram Desktop / Mobile.
  2. Nạp mới toàn bộ 17 lệnh chuẩn (`mysite`, `mycable`, `mydia`, `myolt`, `mysn`, `mydata`, `t1notclose`..`t4notclose`, `t1waitcd`..`t4waitcd`, `daily`, `plan`, `help`).

---

## ⚡ ĐỒNG BỘ MÃ NGUỒN VÀ REPOSITORY
- **Hồ sơ file đã cập nhật**:
  * `Task and WO/api/search_bot.py`
  * `Task and WO/apps_script/site_down_v2.gs`
  * `Task and WO/tni_site_down_repo/site_down_v2.gs`
  * `Task and WO/api/collector.py`
  * `Task and WO/daily_plan_report.py`
  * `tni-sitedown/daily_plan_report.py`
