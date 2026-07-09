// ============================================================
// SYSTEM: Refuel Apps Script Collector
// Spreadsheet: https://docs.google.com/spreadsheets/d/1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM/edit
// Description: Đọc cột R của sheet Refuel và gửi tin nhắn hoặc lưu trữ message_ids.
// ============================================================

const REFUEL_BOT_TOKEN = "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME";
const REFUEL_CHAT_ID = "-5469544739";

/**
 * HÀM ỦY QUYỀN MẠNG: Chọn hàm này từ dropdown và bấm "Run" để hiện hộp thoại cấp quyền của Google.
 */
function authorizeUrlFetch() {
  Logger.log("🔐 Đang kích hoạt hộp thoại cấp quyền kết nối mạng...");
  UrlFetchApp.fetch("https://api.telegram.org");
  Logger.log("✅ Đã cấp quyền thành công!");
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";
    
    // 1. Đọc cột R của sheet Refuel
    if (action === "get_refuel_data") {
      return getRefuelData();
    }
    
    // 2. Đọc message_ids cũ phục vụ xóa tin
    if (action === "get_msgids") {
      return handleGetMsgIds(e.parameter || {});
    }
    
    return json({ status: "ok", message: "TNI Refuel Apps Script running" });
  } catch (err) {
    return json({ status: "error", message: err.message });
  }
}

function doPost(e) {
  try {
    let body;
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      body = e.parameter || {};
    }
    
    const action = body.action || "";
    
    // 3. Lưu message_ids mới phục vụ xóa tin
    if (action === "save_msgids") {
      return handleSaveMsgIds(body);
    }
    
    return json({ status: "error", message: "Unknown post action" });
  } catch (err) {
    return json({ status: "error", message: err.message });
  }
}

/**
 * Đọc cột R (cột thứ 18), từ dòng thứ 2 đến cuối cùng của tab "Refuel"
 */
function getRefuelData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Refuel");
  if (!sheet) {
    return json({ status: "error", message: "Sheet 'Refuel' not found" });
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return json({ status: "ok", data: [] });
  }
  
  const values = sheet.getRange(2, 18, lastRow - 1, 1).getValues();
  const data = [];
  for (let i = 0; i < values.length; i++) {
    const valTrim = String(values[i][0] || "").trim();
    if (valTrim) {
      data.push(valTrim);
    }
  }
  return json({ status: "ok", data: data });
}

/**
 * Đọc danh sách message_ids cũ từ PropertiesService của Script
 */
function handleGetMsgIds(params) {
  const key = (params && params.key) ? params.key.toString().trim() : "";
  if (!key) return json({ status: "error", message: "Missing key" });
  
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty("REFUEL_MSGID_" + key) || "[]";
  try {
    return json({ status: "ok", key: key, msgids: JSON.parse(raw) });
  } catch (e) {
    return json({ status: "ok", key: key, msgids: [] });
  }
}

/**
 * Lưu danh sách message_ids mới vào PropertiesService của Script
 */
function handleSaveMsgIds(body) {
  const key = (body && body.key) ? body.key.toString().trim() : "";
  const msgids = (body && body.msgids) ? body.msgids : [];
  
  if (!key) return json({ status: "error", message: "Missing key" });
  
  const props = PropertiesService.getScriptProperties();
  props.setProperty("REFUEL_MSGID_" + key, JSON.stringify(msgids));
  Logger.log("[MsgIds] Saved " + key + " = " + JSON.stringify(msgids));
  return json({ status: "ok", key: key, count: msgids.length });
}

/**
 * Helper tạo phản hồi dạng JSON
 */
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// CHẠY TRỰC TIẾP TRÊN GOOGLE APPS SCRIPT (GAS RUNNER)
// ============================================================

/**
 * Hàm chính để gửi báo cáo Refuel và xóa tin nhắn cũ trực tiếp từ GAS.
 * Tự động chia nhỏ tin nhắn nếu dữ liệu vượt quá 4096 ký tự của Telegram.
 */
function sendRefuelReport() {
  Logger.log("⛽ Bắt đầu tác vụ gửi báo cáo Refuel từ Google Apps Script...");
  
  // 1. Xóa các tin nhắn báo cáo cũ
  deleteOldMessagesRefuel();
  
  // 2. Đọc dữ liệu cột R
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Refuel");
  if (!sheet) {
    Logger.log("❌ Không tìm thấy tab 'Refuel'");
    return;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("📭 Sheet rỗng hoặc chỉ có dòng tiêu đề.");
    return;
  }
  
  const values = sheet.getRange(2, 18, lastRow - 1, 1).getValues();
  const rows = [];
  for (let i = 0; i < values.length; i++) {
    const valTrim = String(values[i][0] || "").trim();
    if (valTrim) {
      rows.push(valTrim);
    }
  }
  
  if (rows.length === 0) {
    Logger.log("📭 Không có dữ liệu để gửi.");
    return;
  }
  
  // 3. Phân chia dòng thành các nhóm nhỏ để tránh lỗi vượt quá 4096 ký tự của Telegram
  const now = new Date();
  const dateStr = Utilities.formatDate(now, "Asia/Rangoon", "dd/MM/yyyy");
  const timeStr = Utilities.formatDate(now, "Asia/Rangoon", "HH:mm");
  
  let headerLine = "";
  let startIdx = 0;
  if (rows[0].indexOf("Report need refuel") !== -1) {
    headerLine = "📋 <b>" + rows[0] + "</b>\n";
    startIdx = 1;
  }
  
  // Trừ hao thêm các ký tự HTML tag <pre> và </pre>
  const baseTitle = "⛽ <b>TNI REQUEST REFUEL — Daily Report</b>\n📅 " + dateStr + "  ⏰ " + timeStr + " (Myanmar)\n━━━━━━━━━━━━━━━━━━━━━\n\n";
  const baseFooter = "\n━━━━━━━━━━━━━━━━━━━━━\n🤖 <i>Auto report by @TNI_REFUEL_BOT</i>";
  
  const chunks = [];
  let currentChunkLines = [];
  let currentLength = baseTitle.length + baseFooter.length + (headerLine ? headerLine.length : 0) + 13; // +13 cho <pre></pre>
  
  for (let i = startIdx; i < rows.length; i++) {
    const line = rows[i];
    // 3800 ký tự là ngưỡng an toàn
    if (currentLength + line.length + 1 > 3800) {
      chunks.push(currentChunkLines);
      currentChunkLines = [line];
      currentLength = baseTitle.length + baseFooter.length + line.length + 13;
    } else {
      currentChunkLines.push(line);
      currentLength += line.length + 1; // +1 cho newline
    }
  }
  if (currentChunkLines.length > 0) {
    chunks.push(currentChunkLines);
  }
  
  // 4. Gửi từng phần lên Telegram và gom các message ID mới
  const newMsgIds = [];
  for (let c = 0; c < chunks.length; c++) {
    const chunkLines = chunks[c];
    const lines = [];
    
    // Ghi tiêu đề kèm thông tin phân trang nếu gửi nhiều phần
    const titleText = "⛽ <b>TNI REQUEST REFUEL — Daily Report</b>" + (chunks.length > 1 ? " (Phần " + (c + 1) + "/" + chunks.length + ")" : "");
    lines.push(titleText);
    lines.push("📅 " + dateStr + "  ⏰ " + timeStr + " (Myanmar)");
    lines.push("━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
    
    // Chỉ ghi Header ở Phần 1
    if (c === 0 && headerLine) {
      lines.push(headerLine);
    }
    
    // Đóng khung trong thẻ pre để tạo giao diện Monospace gọn gàng (ép thành 1 dòng)
    lines.push("<pre>");
    for (let j = 0; j < chunkLines.length; j++) {
      lines.push(chunkLines[j]);
    }
    lines.push("</pre>");
    
    lines.push("━━━━━━━━━━━━━━━━━━━━━");
    lines.push("🤖 <i>Auto report by @TNI_REFUEL_BOT</i>");
    
    const formattedMsg = lines.join("\n");
    const newMsgId = sendTelegramMessage(formattedMsg);
    if (newMsgId) {
      newMsgIds.push(newMsgId);
    }
  }
  
  // 5. Lưu danh sách message ID mới gửi để xóa ở lần kế tiếp
  if (newMsgIds.length > 0) {
    saveNewMsgIdRefuel(newMsgIds);
  }
}

/**
 * Gửi tin nhắn đến Telegram và trả về message_id
 */
function sendTelegramMessage(text) {
  const url = "https://api.telegram.org/bot" + REFUEL_BOT_TOKEN + "/sendMessage";
  const payload = {
    chat_id: REFUEL_CHAT_ID,
    text: text,
    parse_mode: "HTML"
  };
  
  try {
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    if (result.ok) {
      Logger.log("✅ Gửi tin nhắn mới thành công! Message ID: " + result.result.message_id);
      return result.result.message_id;
    } else {
      Logger.log("❌ Gửi tin nhắn Telegram lỗi: " + response.getContentText());
    }
  } catch (e) {
    Logger.log("❌ Gửi tin nhắn Telegram gặp lỗi: " + e.message);
  }
  return null;
}

/**
 * Xóa các tin nhắn cũ
 */
function deleteOldMessagesRefuel() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty("REFUEL_MSGID_REFUEL_DAILY_REPORT") || "[]";
  let oldIds = [];
  try {
    oldIds = JSON.parse(raw);
  } catch(e) {
    oldIds = [];
  }
  
  if (oldIds.length === 0) {
    Logger.log("ℹ️ Không có tin nhắn cũ cần xóa.");
    return;
  }
  
  const url = "https://api.telegram.org/bot" + REFUEL_BOT_TOKEN + "/deleteMessage";
  let deletedCount = 0;
  
  for (let i = 0; i < oldIds.length; i++) {
    const mid = oldIds[i];
    try {
      const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ chat_id: REFUEL_CHAT_ID, message_id: mid }),
        muteHttpExceptions: true
      };
      const response = UrlFetchApp.fetch(url, options);
      const resJson = JSON.parse(response.getContentText());
      if (resJson.ok) {
        Logger.log("🗑️ Đã xóa tin nhắn cũ ID: " + mid);
        deletedCount++;
      } else {
        Logger.log("⚠️ Không thể xóa tin nhắn ID " + mid + ": " + resJson.description);
      }
    } catch(e) {
      Logger.log("❌ Lỗi khi xóa tin nhắn cũ: " + e.message);
    }
  }
  Logger.log("📊 Đã xóa " + deletedCount + "/" + oldIds.length + " tin nhắn cũ.");
}

/**
 * Lưu danh sách message_ids mới gửi
 */
function saveNewMsgIdRefuel(msgIds) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("REFUEL_MSGID_REFUEL_DAILY_REPORT", JSON.stringify(msgIds));
  Logger.log("💾 Đã lưu danh sách message ID mới vào bộ nhớ: " + JSON.stringify(msgIds));
}

/**
 * Thiết lập 2 trigger chạy tự động hàng ngày lúc 17:00 và 05:00
 * (Lưu ý: Giờ chạy thực tế sẽ dựa trên múi giờ cài đặt của Spreadsheet này)
 */
function setupRefuelDailyTriggers() {
  // Xóa các trigger cũ cùng tên
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "sendRefuelReport") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Tạo trigger chạy lúc 05:00 - 06:00 sáng
  ScriptApp.newTrigger("sendRefuelReport")
           .timeBased()
           .everyDays(1)
           .atHour(5)
           .create();
           
  // Tạo trigger chạy lúc 17:00 - 18:00 chiều
  ScriptApp.newTrigger("sendRefuelReport")
           .timeBased()
           .everyDays(1)
           .atHour(17)
           .create();
           
  Logger.log("✅ Đã thiết lập thành công 2 trigger tự động lúc 05:00 và 17:00 hàng ngày!");
}
