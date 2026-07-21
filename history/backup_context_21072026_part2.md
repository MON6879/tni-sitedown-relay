# Backup Context — 21/07/2026 (Part 2)

## Cập nhật logic điểm danh theo Giờ gửi Telegram và Mã Site/Task

1. **Ghi nhận ngày giờ theo giờ gửi (Message Sent Time):**
   - Thay vì dùng `new Date()` (thời gian server xử lý request), hệ thống chuyển sang dùng `msg.date` (timestamp tính bằng giây do Telegram đính kèm khi người dùng bấm gửi tin nhắn).
   - `dateStr` và `timeStr` sẽ lấy chính xác giờ gửi tin nhắn trên Telegram của nhân viên (ví dụ 07:02 hoặc 07:24).

```javascript
const msgDateObj = msg.date ? new Date(msg.date * 1000) : new Date();
const dateStr = Utilities.formatDate(msgDateObj, "Asia/Rangoon", "dd/MM/yyyy");
const timeStr = Utilities.formatDate(msgDateObj, "Asia/Rangoon", "HH:mm");
```

2. **Cho phép điểm danh nhiều Trạm / Mã Site khác nhau trong ngày:**
   - Cập nhật hàm `isAlreadyLoggedToday_` nhận thêm tham số `siteCode` (ví dụ `TNI0004_1`).
   - Nếu nhân viên gửi ảnh của một trạm mới (mã site khác với mã site đã điểm danh trước đó trong ngày), hệ thống vẫn ghi nhận điểm danh mới cho trạm đó thay vì báo trùng toàn bộ trong ngày.
   - Trùng lặp chỉ bị chặn khi cùng một Telegram ID gửi lại đúng Mã Site đó trong cùng một ngày.
