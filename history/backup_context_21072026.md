# Backup Context — 21/07/2026

## Thay đổi trong `apps_script_attendance/TNI attendance.js`

### 1. Thêm cơ chế chống lặp tin Telegram Webhook (Deduplication)
* **Vấn đề:** Khi Telegram gửi tin nhắn ảnh điểm danh, quá trình xử lý có thể mất nhiều thời gian (>10s do xử lý Drive và Gemini API) khiến Telegram báo timeout và liên tục gửi lại (retry) update cũ sau mỗi 1-2 phút.
* **Giải pháp:** Sử dụng `CacheService` để lưu trữ và kiểm tra `update.update_id` trong 10 phút. Nếu phát hiện `update_id` trùng, ngay lập tức trả về phản hồi `"OK"` trong 0.1 giây để kết thúc chuỗi gửi lại của Telegram.

```javascript
    const update = JSON.parse(e.postData.contents);

    // ── DEDUPLICATE TELEGRAM WEBHOOK RETRIES ──
    if (update.update_id) {
      const cache = CacheService.getScriptCache();
      const cacheKey = "attendance_upd_" + update.update_id;
      if (cache.get(cacheKey)) {
        logToSheet_("Duplicate update_id: " + update.update_id + ", ignoring.");
        return ContentService.createTextOutput("OK");
      }
      cache.put(cacheKey, "1", 600); // Cache for 10 minutes
    }
```

### 2. Sửa lỗi logic check trùng ngày (Duplicate checking logic)
* **Vấn đề:** Hàm `isAlreadyLoggedToday_` đọc dữ liệu từ cột B (Date) đến cột E để so khớp với Tên nhân viên. Nhưng cột E trên sheet thực tế lưu `extractedImageName` (Site code trích xuất từ hình ảnh, ví dụ: `TNI0295` hoặc để trống), còn tên đầy đủ nằm ở cột F. Do lệch cột, phép so khớp tên nhân viên luôn trả về `false`, cho phép ghi dữ liệu trùng liên tục.
* **Giải pháp:** Cập nhật hàm `isAlreadyLoggedToday_` để kiểm tra theo **Telegram ID (Cột D)** thay vì so khớp Tên. Cột Telegram ID là duy nhất của mỗi nhân viên nên sẽ chính xác 100%.

```javascript
// Thay đổi kiểm tra trong vòng lặp chính
// Kiểm tra trùng lặp trong ngày hôm nay theo Telegram ID
if (isAlreadyLoggedToday_(attendanceSheet, dateStr, finalTgId)) {
  replyMsg += `- ${finalShortName} (Already logged today)\n`;
  continue;
}

// Thay đổi định nghĩa hàm kiểm tra
/** Kiểm tra xem nhân viên đã điểm danh trong ngày hôm nay chưa theo Telegram ID */
function isAlreadyLoggedToday_(sheet, dateStr, telegramId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  // Đọc từ cột B (Date) đến cột D (Telegram ID) -> 3 cột
  const values = sheet.getRange(2, 2, lastRow - 1, 3).getValues(); 
  for (let i = 0; i < values.length; i++) {
    const rowDate = values[i][0];
    const rowTgId = String(values[i][2] || "").trim(); // Cột D (Telegram ID) là index 2 trong mảng [B, C, D]
    
    let formattedRowDate = "";
    if (rowDate instanceof Date) {
      formattedRowDate = Utilities.formatDate(rowDate, "Asia/Rangoon", "dd/MM/yyyy");
    } else {
      formattedRowDate = String(rowDate || "").trim();
    }
    
    if (formattedRowDate.split(" ")[0] === dateStr && rowTgId === telegramId) {
      return true;
    }
  }
  return false;
}
```
