// ============================================================
// DAILY CROSS CHECK WO REPORT
// ============================================================
// Trigger: Chạy daily lúc 17:00 Myanmar
// Setup:   Chạy hàm setupCrossCheckWOTrigger() 1 lần từ Apps Script Editor để cấu hình trigger 17:00 hàng ngày.
// ============================================================

function setupCrossCheckWOTrigger() {
  // Xóa trigger cũ cùng tên
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "sendCrossCheckWOReport")
    .forEach(t => ScriptApp.deleteTrigger(t));
  
  // Tạo mới - chạy hàng ngày từ 17:00 đến 18:00 (múi giờ Asia/Yangon)
  ScriptApp.newTrigger("sendCrossCheckWOReport")
    .timeBased()
    .everyDays(1)
    .atHour(17)
    .nearMinute(0)
    .create();
  Logger.log("✅ Trigger sendCrossCheckWOReport() chạy lúc 17:00 hàng ngày đã cài.");
}

function sendCrossCheckWOReport() {
  try {
    const ss = SpreadsheetApp.openById("1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8");
    const sheet = ss.getSheetByName("Cross Check WO");
    if (!sheet) {
      Logger.log("❌ Không tìm thấy sheet 'Cross Check WO'");
      return;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log("Sheet không có dữ liệu để báo cáo.");
      return;
    }

    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty("SEND_BOT_TOKEN") || "8897800070:AAHcG2eHlPsE0KpZAGjcFTe7ndn8gjpQi-A";

    const chatIds = {
      "Control": "-5251698940",
      "Team 1":  "-1004215695747",
      "Team 2":  "-1004480845549",
      "Team 3":  "-1004369170658",
      "Team 4":  "-1004293741999"
    };

    // Đọc toàn bộ 5 cột từ cột A đến E
    const range = sheet.getRange(1, 1, lastRow, 5);
    const values = range.getValues();

    // Dòng 0: Tên tiêu đề ['Control', 'Team 1', 'Team 2', 'Team 3', 'Team 4']
    const headers = values[0];
    // Dòng 1: Ngày so sánh ['14/07/2026', '14/07/2026', ...]
    const dates = values[1];

    for (let col = 0; col < 5; col++) {
      const colName = String(headers[col] || "").trim();
      const dateStr = String(dates[col] || "").trim();
      const chatId = chatIds[colName];
      if (!chatId) continue;

      const lines = [];
      for (let row = 2; row < lastRow; row++) {
        const val = String(values[row][col] || "").trim();
        if (val && val.toLowerCase() !== "nan" && val.toLowerCase() !== "none") {
          lines.push("• " + val);
        }
      }

      if (lines.length > 0) {
        const messageText = lines.join("\n");

        // Xóa tin nhắn cũ của ngày trước để tránh rác nhóm
        const oldMsgKey = "CROSS_CHECK_MSG_ID_" + colName.toUpperCase().replace(/\s+/g, "");
        const oldMsgId = props.getProperty(oldMsgKey);
        if (oldMsgId) {
          try {
            UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/deleteMessage?chat_id=" + chatId + "&message_id=" + oldMsgId, { 
              muteHttpExceptions: true 
            });
            Logger.log("🗑️ Đã xóa tin nhắn cũ cho " + colName);
          } catch (delErr) {
            Logger.log("⚠️ Lỗi xóa tin cũ " + colName + ": " + delErr.message);
          }
        }

        // Gửi tin nhắn mới
        try {
          const response = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify({
              chat_id: chatId,
              text: messageText,
              parse_mode: "HTML"
            }),
            muteHttpExceptions: true
          });
          const resData = JSON.parse(response.getContentText());
          if (resData.ok && resData.result) {
            props.setProperty(oldMsgKey, resData.result.message_id.toString());
            Logger.log("✅ Đã gửi báo cáo thành công cho " + colName);
          } else {
            Logger.log("❌ Gửi lỗi cho " + colName + ": " + response.getContentText());
          }
        } catch (sendErr) {
          Logger.log("❌ Lỗi mạng khi gửi cho " + colName + ": " + sendErr.message);
        }
      } else {
        Logger.log("ℹ️ Cột " + colName + " không có dữ liệu để báo cáo.");
      }
    }
  } catch (err) {
    Logger.log("❌ Lỗi tổng quát trong sendCrossCheckWOReport: " + err.message);
  }
}
