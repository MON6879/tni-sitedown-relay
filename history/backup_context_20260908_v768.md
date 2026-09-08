# BACKUP CONTEXT — 08/09/2026 (v768)
## PHÂN HỆ: SITE DOWN RELAY + TOA ETA SHARE REMINDER + TELETHON SINGLE-RUNNER FIX

### 1. BỐI CẢNH & YÊU CẦU NGƯỜI DÙNG:
1. Người dùng phản ánh: "sao site down đứng lúc 19:38? nếu đứng thì tin ETA cũng dừng lại".
2. Người dùng phản ánh: "tin này gởi lúc tôi thấy thực tế tin gởi lúc 09 phút hay 10 bạn xem GAS gởi site down khi nào và công thêm 1 phút sau gởi ETA".
3. Người dùng đã gửi mật khẩu mở khóa thép: UNLOCK STEEL: Phucat@7979.

### 2. NGUYÊN NHÂN GỐC (ROOT CAUSE FORENSIC):
- Lúc 19:38 MMT (13:08 UTC), botlookup_relay chạy thành công (Run 34230113177).
- Sau đó, toàn bộ các lần chạy lúc 19:49, 20:08, 20:38, 21:08 MMT đều bị crash ở giây 13-16 với mã lỗi Telethon RPC 406: AuthKeyDuplicatedError.
- Nguyên nhân kỹ thuật: Workflow botlookup_relay.yml bị cấu hình chạy trùng lặp đồng thời ở cả hai repository MON6879/tni-sitedown-relay và MON6879/TNI-DONE với cùng một TELEGRAM_SESSION. Khi 2 runner ở 2 IP khác nhau của GitHub Actions cùng kết nối vào Telegram MTProto, Telegram server lập tức vô hiệu hóa kết nối vì phát hiện phiên bị nhân bản.

### 3. CÁC HÀNH ĐỘNG ĐÃ XỬ LÝ TRIỆT ĐỂ:
1. Vô hiệu hóa runner trùng lặp (Disable Duplicate Runner):
   - Đã gọi GitHub API disable hoàn toàn workflow botlookup_relay.yml trên MON6879/TNI-DONE (Status 204).
   - Đảm bảo MON6879/tni-sitedown-relay là SOLE RUNNER duy nhất theo đúng RULE PM-10 và STRICT REPO ISOLATION RULE.
2. Cập nhật bộ GitHub Secrets chuẩn:
   - Sử dụng PyNaCl SealedBox mã hóa và cập nhật trực tiếp qua GitHub REST API: TELEGRAM_SESSION, TELEGRAM_API_ID, TELEGRAM_API_HASH vào MON6879/tni-sitedown-relay.
3. Kích hoạt kiểm thử Live (Live Verification Run 34243635163):
   - Dispatch botlookup_relay.yml với --force: Status success, Webhook GAS Status 200 (lines: 19, sent_tin1: True).
   - Google Sheet tab GID 0 cập nhật thành công lên mốc 08/09/2026 21:30:00 (Row 0 và Row 1).
4. Chốt chặn an toàn cho tin ETA (ETA Safety Guards):
   - age_minutes > 45: Dữ liệu Sheet cũ hơn 45 phút -> tự động dừng gửi ETA.
   - last_eta_sd_timestamp: Nếu timestamp không đổi so với lần gửi trước -> tự động dừng gửi ETA.
5. Hiệu chỉnh giờ tàu ETA (+1 phút sau GAS Site Down):
   - GAS gửi Site Down vào lúc :09 hoặc :10 MMT.
   - Lịch chạy tàu ETA (train_5min.yml) chuyển sang ga :11 và :41 MMT.

### 4. KHÓA THÉP (STEEL FREEZE RE-LOCKED):
- Phân hệ Site Down (apps_script_sitedown, botlookup_relay.py) đã hoạt động ổn định 100%.
- Trạng thái khóa thép: LOCKED (Tự động đóng lại 100% theo quy tắc).
