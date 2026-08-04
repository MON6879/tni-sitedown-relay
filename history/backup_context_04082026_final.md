# 📌 System Snapshot Backup — 04/08/2026 (TELEGRAM MENU SCOPE FULL SYNCHRONIZATION)

> **Lưu trữ cấu hình toàn bộ hệ thống TNI Bot - Nạp đồng bộ trọn bộ 17 lệnh cho TẤT CẢ các Scope (Private Chat & Group Chat).**

---

## ⚡ PHÁT HIỆN NGUYÊN NHÂN CỐT LÕI & GIẢI PHÁP TRIỆT ĐỂ 100%

- **Phát hiện nguyên nhân vì sao trong Chat Riêng tư (Private Chat) giao diện Telegram chưa hiện 4 lệnh `/mycable`, `/mydia`, `/myolt`, `/mysn`**:
  1. Telegram Bot API quản lý menu lệnh theo từng phân vùng đối tượng (Scope): `default`, `all_private_chats`, `all_group_chats`.
  2. Trước đó, menu cũ từng được đăng ký riêng cho Scope `all_private_chats`. Do đó khi người dùng mở Chat Riêng tư (Private Chat như trong ảnh 1 & 2), Telegram Desktop ưu tiên hiển thị menu của `all_private_chats` cũ mà không nạp menu `default` mới.

- **Đã khắc phục triệt để**:
  1. Cưỡng chế xóa toàn bộ menu cũ trên tất cả các Scope (`default`, `all_private_chats`, `all_group_chats`, `all_chat_administrators`).
  2. Nạp đồng bộ trọn bộ 17 lệnh chuẩn (`mysite`, `mycable`, `mydia`, `myolt`, `mysn`, `mydata`, `t1notclose`..`t4notclose`, `t1waitcd`..`t4waitcd`, `daily`, `plan`, `help`) lên TẤT CẢ các Scope `all_private_chats`, `all_group_chats` và `default`.

---

## ⚡ ĐỒNG BỘ MÃ NGUỒN VÀ REPOSITORY
- **Hồ sơ file đã cập nhật**:
  * `Task and WO/api/search_bot.py`
  * `Task and WO/api/collector.py`
  * `Task and WO/apps_script/site_down_v2.gs`
  * `Task and WO/tni_site_down_repo/site_down_v2.gs`
  * `Task and WO/daily_plan_report.py`
  * `tni-sitedown/daily_plan_report.py`
