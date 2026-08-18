// ============================================================
// DỰ ÁN: TNI CONSTRUCTION - BOT 10 TNI_SITE
// TÀI KHOẢN: phonghdpxd
// FILE: 13_TNI_CONSTRUCTION.gs
// MÔ TẢ: Tự động thu thập báo cáo từ 4 Team Construction trên Telegram.
//        - GIỮ DUY NHẤT 1 LINK "DOWNLOAD ALL" SIÊU GỌN GÀNG:
//          Tự động gom tất cả ảnh gửi theo STT vào Thư mục Google Drive riêng (`Report_STT_#STT`).
//          - BỎ HOÀN TOÀN CÁC LINK ẢNH LẺ (Photo 1, Photo 2...).
//          - TRONG Ô CHỈ GIỮ ĐÚNG 1 DÒNG DUY NHẤT: `📥 DOWNLOAD ALL (N Photos): [URL Thư Mục]`.
//          - Rà chuột vào link Download All vẫn xem trước được toàn bộ danh sách các file ảnh trong khung popup!
//          - Bấm 1 cái mở thư mục để Tải toàn bộ tất cả ảnh trong 1 click.
//          - TỰ ĐỘNG CẬP NHẬT TĂNG SỐ LƯỢNG ẢNH TRỰC TIẾP TỪ THƯ MỤC DRIVE.
//        - TIÊU ĐỀ TRẢ VỀ DYNAMIC HÀNG 1: Tự động lấy Tên Tiêu Đề Cột từ Hàng 1 của tab 'Search Construction' (nếu có).
//        - KHÓA CỨNG TỪ KHÓA 'Pro': Phải là từ độc lập 'Pro' hoặc '/pro' ở dòng 1 đi kèm mã TNIxxxxxx.
//        - ĐỊNH VỊ CHÍNH XÁC SPREADSHEET ID: Khóa cứng mở trực tiếp file '1ViXXv5P8jSgx5heBqEP419ZkSR77C3OsflK0xpHMoi8'.
//        - TÌM KIẾM MẪU BÁO CÁO (Template / Plan / Delivery...): 
//          Đối chiếu tên lệnh Cột A và LẤY NỘI DUNG CHÍNH XÁC DUY NHẤT TỪ CỘT D của tab 'Template Cons'.
//        - CƠ CHẾ PHẢN HỒI AN TOÀN (SAFE TELEGRAM RETRY): Tự động thử lại không dùng reply_id hoặc gửi dạng Plain Text.
//        - GIỚI HẠN 10 PHÚT LƯU ẢNH: Thời gian chờ nhận ảnh từ thợ sau khi gửi báo cáo rút ngắn còn 10 phút. Sau 10 phút tự động dừng thu thập & bỏ qua toàn bộ hình ảnh trò chuyện.
//        - ĐIỀU KIỆN LỌC BÁO CÁO: Chỉ thu thập tin nhắn CÓ TIÊU ĐỀ KHỚP MẪU. Bỏ qua 100% trò chuyện tự do.
// ============================================================

// ⚙️ SYSTEM CONFIGURATION
var TNI_CONFIG = {
  // Token Bot 10 TNI_SITE
  DEFAULT_BOT_TOKEN: '8903841312:AAHQ_LeI19gs2nrqBSInTsgzJXOuv6H8LmE',
  
  // Explicit Spreadsheet ID FOR TNI CONSTRUCTION
  SPREADSHEET_ID: '1ViXXv5P8jSgx5heBqEP419ZkSR77C3OsflK0xpHMoi8',

  // Sheet Names in Google Spreadsheet "TNI CONSTRUCTION"
  SHEET_TEMPLATE: 'Template Cons',
  SHEET_COLLECT: 'Collect Data',
  SHEET_SEARCH_CONS: 'Search Construction',
  
  // Google Drive Photo Folder Name
  DRIVE_FOLDER_NAME: '2.10 TNI PHOTO CONSTRUCTION'
};

/**
 * 📊 Get Spreadsheet ALWAYS FORCED BY ID (Prevents opening active container spreadsheet)
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(TNI_CONFIG.SPREADSHEET_ID);
}

/**
 * 📌 Custom Google Sheets UI Menu
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🛠️ TNI CONSTRUCTION')
      .addItem('🔗 Convert Existing Links to Live Hyperlinks', 'convertExistingLinksToHyperlinks')
      .addItem('🔄 Sync Telegram Menu (Column A Keys)', 'setTelegramMenuCommands')
      .addItem('⏰ Setup Daily Auto-Sync (1:00 AM)', 'createDailySyncTrigger')
      .addToUi();
  } catch (e) {
    console.log("onOpen context skipped");
  }
}

/**
 * ⚡ Auto-Trigger on Edit (Sheet 'Template Cons')
 */
function onEdit(e) {
  if (!e || !e.range) return;
  try {
    var sheet = e.range.getSheet();
    if (sheet.getName() === TNI_CONFIG.SHEET_TEMPLATE) {
      invalidateTemplateCache_();
      var col = e.range.getColumn();
      if (col === 1 || col === 4) {
        setTelegramMenuCommands();
      }
    }
  } catch (err) {
    console.error("onEdit error:", err);
  }
}

/**
 * 🔄 Invalidate Template Cache upon sheet edit
 */
function invalidateTemplateCache_() {
  try {
    CacheService.getScriptCache().remove("TNI_TEMPLATE_CONS_DATA");
  } catch (e) {}
}

/**
 * ⚡ Get Template Cons Data with RAM Cache (CacheService 6 hours)
 * Tăng tốc phản hồi lệnh slash command từ ~4s xuống 0.2s
 */
function getCachedTemplateConsData_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("TNI_TEMPLATE_CONS_DATA");
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(TNI_CONFIG.SHEET_TEMPLATE);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var maxCols = Math.max(sheet.getLastColumn(), 4);
  var rawData = sheet.getRange(2, 1, lastRow - 1, maxCols).getValues();
  
  var templateList = [];
  for (var i = 0; i < rawData.length; i++) {
    var key = rawData[i][0] ? rawData[i][0].toString().trim() : "";
    var content = rawData[i][3] ? rawData[i][3].toString().trim() : "";
    if (key) {
      templateList.push([key, "", "", content]);
    }
  }

  try {
    cache.put("TNI_TEMPLATE_CONS_DATA", JSON.stringify(templateList), 21600); // 6 hours
  } catch (e) {}

  return templateList;
}

/**
 * ⏰ Daily Auto-Sync Trigger Setup (Runs daily at 1:00 AM)
 */
function createDailySyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'setTelegramMenuCommands' || t.getHandlerFunction() === 'syncTemplateCons') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('setTelegramMenuCommands')
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .create();

  console.log("✅ Daily template sync trigger created (1:00 AM)!");
}

/**
 * 🚀 Main Telegram Webhook Handler (doPost)
 */
function doPostConstruction_(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return HtmlService.createHtmlOutput("OK");
    }

    var data = JSON.parse(e.postData.contents);

    // ⛽ Process Refuel Collect Message Action
    if (data && data.action === "collect_message") {
      return handleRefuelCollectMessage_(data);
    }

    processTelegramUpdate(data);

    return HtmlService.createHtmlOutput("OK");
  } catch (err) {
    console.error("doPost Webhook error:", err);
    return HtmlService.createHtmlOutput("OK");
  }
}

/**
 * ⛽ Process Refuel Collector Message Action -> Insert row at Row 2 (TNI_Refuel sheet)
 */
function handleRefuelCollectMessage_(data) {
  try {
    var ssId = "1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM";
    var ss = SpreadsheetApp.openById(ssId);
    var text = data.text || "";
    var sender = data.sender || "";
    var senderId = data.sender_id || "";
    var dateStr = data.date || "";

    var textLower = text.toLowerCase();

    // 1. Identify category & target tab
    var targetTabName = "";
    if (/^\s*team[\s_\-]*\w*\s*plan\b/m.test(textLower) || /^\s*plan\s*refuel\b/m.test(textLower)) {
      targetTabName = "Plan refuel";
    } else if (/^\s*team[\s_\-]*\w*\s*request\b/m.test(textLower) || /^\s*request\s*refuel\b/m.test(textLower)) {
      targetTabName = "Team request";
    } else if (textLower.indexOf("dg type") !== -1 || textLower.indexOf("actual filled qty") !== -1) {
      targetTabName = "Refueled";
    } else if (/(letter\s*submit|submit\s*letter|approved\s*letter|letter\s*approved)\s*[:\-]/i.test(textLower) || /(letter\s*submit|submit\s*letter|approved\s*letter|letter\s*approved)\b.*\d{1,2}[/\-\.]\d{1,2}/i.test(textLower)) {
      targetTabName = "Lettel Progress";
    } else if (textLower.indexOf("name of ft staff member") !== -1 || /follow\s*monit?er?/i.test(textLower)) {
      targetTabName = "FT follow monitor";
    }

    if (!targetTabName) {
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", msg: "No category match" })).setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = ss.getSheetByName(targetTabName);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", msg: "Tab not found: " + targetTabName })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Parse Team name
    var teamName = "Team 1";
    var teamMatch = text.match(/team\s*([0-9]+)/i);
    if (teamMatch) {
      teamName = "Team " + teamMatch[1];
    }

    // 3. Parse Plan Date
    var dateMatch = text.match(/\b([0-3]?[0-9][\/\.-][0-1]?[0-9][\/\.-]20[2-9][0-9])\b/);
    var planDate = dateMatch ? dateMatch[1] : dateStr.split(" ")[0];

    // 4. Parse TNI site codes & amounts
    var siteMatches = [];
    var regex = /(TNI[A-Za-z0-9_]+)[\s:]*([+:]?\s*[0-9]+)\s*L?/gi;
    var match;
    while ((match = regex.exec(text)) !== null) {
      var tniCode = match[1].toUpperCase();
      var qtyStr = match[2].replace(/[^0-9]/g, "");
      if (tniCode && qtyStr) {
        siteMatches.push({ tni: tniCode, qty: parseInt(qtyStr, 10) });
      }
    }

    if (siteMatches.length === 0) {
      var tniOnlyMatch = text.match(/TNI[A-Za-z0-9_]+/i);
      if (tniOnlyMatch) {
        siteMatches.push({ tni: tniOnlyMatch[0].toUpperCase(), qty: 440 });
      }
    }

    // 5. Generate DEF ID (#00128...)
    var lastDefNum = 127;
    var firstCell = sheet.getRange(2, 1).getValue();
    if (firstCell && String(firstCell).indexOf("#") !== -1) {
      var num = parseInt(String(firstCell).replace("#", ""), 10);
      if (!isNaN(num)) lastDefNum = num;
    }

    // 6. Insert new row(s) AT ROW 2 (immediately below Header Row 1)
    for (var i = 0; i < siteMatches.length; i++) {
      var item = siteMatches[i];
      var defId = "#" + ("00000" + (lastDefNum + 1 + i)).slice(-5);
      
      sheet.insertRowsBefore(2, 1);
      
      if (targetTabName === "Plan refuel" || targetTabName === "Team request") {
        sheet.getRange(2, 1, 1, 8).setValues([[
          defId,
          planDate,
          teamName,
          item.tni,
          item.qty,
          dateStr.split(" ")[0],
          sender,
          senderId
        ]]);
      } else if (targetTabName === "FT follow monitor") {
        sheet.getRange(2, 4, 1, 5).setValues([[
          item.tni,
          item.qty,
          dateStr.split(" ")[0],
          sender,
          senderId
        ]]);
      } else {
        sheet.getRange(2, 1, 1, 6).setValues([[
          defId,
          planDate,
          teamName,
          item.tni,
          item.qty,
          dateStr
        ]]);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ok", def: "#" + ("00000" + (lastDefNum + 1)).slice(-5) })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error("handleRefuelCollectMessage_ error:", err);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 🔍 Process Incoming Telegram Text, Commands & Photo Updates
 */
function processTelegramUpdate(update) {
  try {
    var message = update.message || update.edited_message || update.channel_post;
    if (!message) return;

    var fromUser = message.from;
    
    // 🛡️ EXCLUDE ALL MESSAGES SENT BY BOTS (Including Chatbot 10 TNI_SITE)
    if (!fromUser || fromUser.is_bot) {
      console.log("🚫 Excluded message sent by Chatbot:", fromUser ? (fromUser.username || fromUser.id) : "unknown bot");
      return;
    }

    var userId = fromUser.id;
    var nameParts = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(" ");
    var userName = nameParts || fromUser.username || ("ID:" + userId);
    if (fromUser.username && nameParts) {
      userName = nameParts + " (@" + fromUser.username + ")";
    }

    var chatTitle = message.chat ? (message.chat.title || ("Chat " + message.chat.id)) : "Unknown Group";
    var chatId = message.chat ? message.chat.id : userId;
    var msgDate = new Date(message.date * 1000);
    var messageId = message.message_id;

    // Case 1: Incoming TEXT Message
    if (message.text || (message.caption && !message.photo)) {
      var textContent = (message.text || message.caption || "").trim();

      // 🔍 STRICT Search Trigger: First line must contain standalone 'Pro' or '/pro' + TNIxxxx
      var firstLine = textContent.split('\n')[0].trim();
      var isSearchCandidate = !firstLine.startsWith('/') || firstLine.toLowerCase().startsWith('/pro');

      if (isSearchCandidate && (/(?:^|\s)\/?pro[\s_:]+(TNI[A-Za-z0-9_-]+)/i.test(firstLine) || /^(?:\/pro|pro)$/i.test(firstLine))) {
        var isSearchHandled = handleProSearchCommand(chatId, textContent, messageId);
        if (isSearchHandled) return;
      }

      // 🤖 Handle General Commands starting with '/' (e.g., /plan, /template, /delivery, /cable_route_over_head_progress...)
      if (textContent.startsWith('/')) {
        var isCmdHandled = handleSlashCommand(chatId, textContent, messageId);
        if (isCmdHandled) return; // Command request handled, do not insert into Collect Data sheet
      }

      handleNewTextMessage(userId, userName, chatTitle, textContent, msgDate, chatId, messageId);
    } 
    // Case 2: Incoming PHOTO Message
    else if (message.photo && message.photo.length > 0) {
      var textCaption = (message.caption || "").trim();
      
      // If photo contains command in caption
      if (textCaption.startsWith('/')) {
        var isCmdHandled = handleSlashCommand(chatId, textCaption, messageId);
        if (isCmdHandled) return;
      }

      // If photo has a long caption -> treat as new report text if it matches headers
      if (textCaption.length > 10) {
        handleNewTextMessage(userId, userName, chatTitle, textCaption, msgDate, chatId, messageId);
      }
      
      // Collect photo into active user session
      handlePhotoMessage(userId, message.photo, msgDate, chatId, messageId);
    }
  } catch (err) {
    console.error("processTelegramUpdate error:", err);
  }
}

/**
 * 🔎 Helper to find Sheet 'Search Construction' strictly in spreadsheet 1ViXXv5P8jSgx5heBqEP419ZkSR77C3OsflK0xpHMoi8
 */
function getSearchConstructionSheet(ss) {
  if (!ss) ss = getSpreadsheet();
  var targetName = TNI_CONFIG.SHEET_SEARCH_CONS || 'Search Construction';
  
  var sheet = ss.getSheetByName(targetName);
  if (sheet) return sheet;

  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().trim().toLowerCase();
    if (name === targetName.toLowerCase() || name.indexOf("search construction") !== -1) {
      return sheets[i];
    }
  }

  return sheets[0];
}

/**
 * 🏗️ Handle /pro Command (e.g. Kep Pro TNI0310, Pro TNI0310, /pro TNI0310)
 */
function handleProSearchCommand(chatId, commandText, messageId) {
  try {
    var cleanText = commandText.replace(/@\w+/g, "").trim();
    var firstLine = cleanText.split('\n')[0].trim();

    var match = firstLine.match(/(?:^|\s)\/?pro[\s_:]+(TNI[A-Za-z0-9_-]+)/i);
    if (!match || !match[1]) {
      if (/^(?:\/pro|pro)$/i.test(firstLine)) {
        sendTelegramMsg(chatId, "Please specify a TNI code with 'Pro'. Usage: <code>Kep Pro TNI0310</code>", messageId);
        return true;
      }
      return false;
    }

    var tniCode = match[1].trim().toUpperCase();
    var cleanTargetCode = tniCode.replace(/[\s_-]/g, "");

    var ss = getSpreadsheet();
    var sheet = getSearchConstructionSheet(ss);

    if (!sheet) {
      sendTelegramMsg(chatId, "⚠️ Sheet 'Search Construction' not found in Google Sheet.", messageId);
      return true;
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      sendTelegramMsg(chatId, "No data found in '" + escapeHtml(sheet.getName()) + "' sheet.", messageId);
      return true;
    }

    var maxCols = Math.max(sheet.getLastColumn(), 5);
    var rangeData = sheet.getRange(1, 1, lastRow, maxCols).getValues();

    var headers = rangeData[0];
    var headerB = (headers[1] && headers[1].toString().trim()) ? headers[1].toString().trim() : "";
    var headerC = (headers[2] && headers[2].toString().trim()) ? headers[2].toString().trim() : "";
    var headerD = (headers[3] && headers[3].toString().trim()) ? headers[3].toString().trim() : "";
    var headerE = (headers[4] && headers[4].toString().trim()) ? headers[4].toString().trim() : "";

    var matchedRow = null;
    for (var i = 1; i < rangeData.length; i++) {
      var keyCell = rangeData[i][0] ? rangeData[i][0].toString().trim().toUpperCase() : "";
      var cleanKeyCell = keyCell.replace(/[\s_-]/g, "");

      if (cleanKeyCell !== "" && (cleanKeyCell === cleanTargetCode || cleanKeyCell.indexOf(cleanTargetCode) !== -1 || cleanTargetCode.indexOf(cleanKeyCell) !== -1)) {
        matchedRow = rangeData[i];
        break;
      }
    }

    if (!matchedRow) {
      sendTelegramMsg(chatId, "❌ No construction info found for TNI code: <b>" + escapeHtml(tniCode) + "</b> in tab '" + escapeHtml(sheet.getName()) + "'", messageId);
      return true;
    }

    var colA = matchedRow[0] ? matchedRow[0].toString().trim() : tniCode;
    var colB = matchedRow[1] ? matchedRow[1].toString().trim() : "";
    var colC = matchedRow[2] ? matchedRow[2].toString().trim() : "";
    var colD = matchedRow[3] ? matchedRow[3].toString().trim() : "";
    var colE = (matchedRow.length >= 5 && matchedRow[4]) ? matchedRow[4].toString().trim() : "";

    var replyParts = [];
    replyParts.push("🏗️ <b>CONSTRUCTION INFO: " + escapeHtml(colA) + "</b>");

    if (colB) {
      var labelB = headerB ? ("🔹 <b>" + escapeHtml(headerB) + ":</b>\n") : "";
      replyParts.push(labelB + "<code>" + escapeHtml(colB) + "</code>");
    }
    if (colC) {
      var labelC = headerC ? ("🔹 <b>" + escapeHtml(headerC) + ":</b>\n") : "";
      replyParts.push(labelC + "<code>" + escapeHtml(colC) + "</code>");
    }
    if (colD) {
      var labelD = headerD ? ("🔹 <b>" + escapeHtml(headerD) + ":</b>\n") : "";
      replyParts.push(labelD + "<code>" + escapeHtml(colD) + "</code>");
    }
    if (colE) {
      var labelE = headerE ? ("🔹 <b>" + escapeHtml(headerE) + ":</b>\n") : "";
      replyParts.push(labelE + "<code>" + escapeHtml(colE) + "</code>");
    }

    if (replyParts.length === 1) {
      replyParts.push("No detailed content found in Columns B, C, D, E for " + escapeHtml(colA));
    }

    sendTelegramMsg(chatId, replyParts.join("\n\n"), messageId);
    return true;
  } catch (err) {
    console.error("handleProSearchCommand error:", err);
    sendTelegramMsg(chatId, "⚠️ Error searching construction info: " + err.message, messageId);
    return true;
  }
}

/**
 * ⚡ Handle Slash Commands starting with '/' (e.g., /plan, /delivery, /template...)
 */
function handleSlashCommand(chatId, commandText, messageId) {
  var rangeData = getCachedTemplateConsData_();
  if (!rangeData || rangeData.length === 0) return false;

  var firstWord = commandText.trim().split(/\s+/)[0];
  var rawCmdKey = firstWord.substring(1).toLowerCase().replace(/@\w+/g, "").trim();

  if (!rawCmdKey) return false;

  if (rawCmdKey.startsWith('template') || rawCmdKey.startsWith('mau') || rawCmdKey.startsWith('teamplate')) {
    handleTemplateCommand(chatId, commandText, messageId, rangeData);
    return true;
  }

  var normCmdKey = rawCmdKey.replace(/_/g, " ").trim();

  for (var i = 0; i < rangeData.length; i++) {
    var keyName = rangeData[i][0] ? rangeData[i][0].toString().trim() : "";
    var cleanKey = keyName.toLowerCase().replace(/_/g, " ").trim();

    if (cleanKey !== "" && (cleanKey === normCmdKey || normCmdKey.indexOf(cleanKey) === 0 || cleanKey.indexOf(normCmdKey) === 0)) {
      var content = rangeData[i][3] ? rangeData[i][3].toString().trim() : "";

      if (content !== "") {
        sendTelegramMsg(chatId, escapeHtml(content), messageId);
      } else {
        sendTelegramMsg(chatId, "⚠️ Template key <b>" + escapeHtml(keyName) + "</b> found, but Column D in 'Template Cons' sheet is empty.", messageId);
      }
      return true;
    }
  }

  return false;
}

/**
 * 📋 Handle General /template Command
 */
function handleTemplateCommand(chatId, commandText, messageId, rangeData) {
  var parts = commandText.split(/\s+/);
  var searchKey = parts.slice(1).join(" ").trim().toLowerCase();

  var templateList = [];

  for (var i = 0; i < rangeData.length; i++) {
    var keyName = rangeData[i][0] ? rangeData[i][0].toString().trim() : "";
    if (keyName === "" || keyName.toLowerCase() === "key" || keyName.toLowerCase() === "stt" || keyName.toLowerCase() === "ref") continue;

    var content = rangeData[i][3] ? rangeData[i][3].toString().trim() : "";

    if (content !== "") {
      if (searchKey === "" || keyName.toLowerCase().indexOf(searchKey) !== -1) {
        templateList.push("📋 <b>" + escapeHtml(keyName) + "</b>:\n" + escapeHtml(content));
      }
    }
  }

  if (templateList.length > 0) {
    sendTelegramMsg(chatId, templateList.join("\n\n---\n\n"), messageId);
  } else {
    sendTelegramMsg(chatId, "⚠️ No template content found in Column D of 'Template Cons' sheet.", messageId);
  }
}

/**
 * 🛡️ Escape HTML Characters for Telegram Parse Mode
 */
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 📲 Send Telegram Message via Bot API
 */
function sendTelegramMsg(chatId, textMsg, replyToMsgId) {
  try {
    var token = getBotToken();
    var url = "https://api.telegram.org/bot" + token + "/sendMessage";
    
    var payload = {
      chat_id: String(chatId),
      text: textMsg,
      parse_mode: 'HTML',
      reply_to_message_id: replyToMsgId || undefined
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var resp = UrlFetchApp.fetch(url, options);
    var json = JSON.parse(resp.getContentText());

    if (!json.ok) {
      console.warn("sendTelegramMsg initial attempt failed:", json.description);

      if (replyToMsgId) {
        delete payload.reply_to_message_id;
        resp = UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        json = JSON.parse(resp.getContentText());
      }

      if (!json.ok) {
        console.warn("sendTelegramMsg retrying as Plain Text...");
        delete payload.parse_mode;
        payload.text = textMsg.replace(/<[^>]*>/g, "");
        UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
      }
    }
  } catch (err) {
    console.error("sendTelegramMsg error:", err);
  }
}

/**
 * 🔗 Helper: Format Cell Text with Live Clickable Hyperlinks on all URLs
 */
function setCellWithHyperlinks(cell, plainText) {
  if (!plainText) {
    cell.setValue("");
    return;
  }

  var strText = String(plainText);
  var builder = SpreadsheetApp.newRichTextValue().setText(strText);
  var urlRegex = /(https?:\/\/[^\s]+)/gi;
  var match;
  var hasLink = false;

  while ((match = urlRegex.exec(strText)) !== null) {
    var startIdx = match.index;
    var endIdx = startIdx + match[0].length;
    var urlStr = match[0];
    builder.setLinkUrl(startIdx, endIdx, urlStr);
    hasLink = true;
  }

  if (hasLink) {
    cell.setRichTextValue(builder.build());
  } else {
    cell.setValue(strText);
  }
}

/**
 * 🔗 Manual 1-Click Tool: Convert all plain text URLs in 'Collect Data' sheet to Clickable Hyperlinks
 */
function convertExistingLinksToHyperlinks() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(TNI_CONFIG.SHEET_COLLECT);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 3 || lastCol < 8) return;

  var range = sheet.getRange(3, 8, lastRow - 2, lastCol - 7);
  var values = range.getValues();
  var count = 0;

  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      var val = values[r][c];
      if (val && String(val).indexOf("http") !== -1) {
        var cell = range.getCell(r + 1, c + 1);
        setCellWithHyperlinks(cell, String(val));
        count++;
      }
    }
  }

  try {
    SpreadsheetApp.getUi().alert("✅ Convert success! Updated " + count + " cells to live clickable hyperlinks.");
  } catch (e) {
    console.log("Converted " + count + " cells.");
  }
}

/**
 * 📝 Process Incoming Text Message -> Create New Data Row at Row 3 (Sheet 'Collect Data')
 */
function handleNewTextMessage(userId, userName, chatTitle, textContent, msgDate, chatId, messageId) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(TNI_CONFIG.SHEET_COLLECT);
  if (!sheet) {
    sheet = ss.insertSheet(TNI_CONFIG.SHEET_COLLECT);
  }

  var map = getDynamicColumnMapping(sheet);

  // 🛡️ STRICT VALIDATION: Must start with a valid Header Key + Date (e.g. Plan: 14/08/2026) AND contain "Team..."
  if (!isValidConstructionReport(textContent, map.templateKeys)) {
    console.log("🚫 Ignored general conversation message (No valid Header Key + Date or Team):", textContent.substring(0, 60));
    return;
  }

  var sectionValues = parseTemplateSections(textContent, map.templateKeys);
  var activeContentCols = Object.keys(sectionValues).map(Number);

  var startRow = getTargetInsertRow(sheet);

  var nextSTT = 1;
  if (sheet.getLastRow() >= startRow) {
    var topSTT = sheet.getRange(startRow, map.colRef).getValue();
    if (!isNaN(topSTT) && topSTT !== "") {
      nextSTT = Number(topSTT) + 1;
    } else {
      nextSTT = Math.max(sheet.getLastRow() - startRow + 1, 1);
    }
  }

  var timeRealStr = Utilities.formatDate(msgDate, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  var timePlanStr = extractPlanDateFromText(textContent, msgDate);
  var teamNameStr = extractTeamNameFromText(textContent, chatTitle);
  var tniCodeStr  = extractTniCodesFromText(textContent);

  sheet.insertRowBefore(startRow);

  var maxCol = Math.max(sheet.getLastColumn(), map.maxKeyCol || 10, 10);
  var rowData = new Array(maxCol).fill("");

  rowData[map.colRef - 1]          = nextSTT;          // Column A: REF / STT
  rowData[map.colTelegramId - 1]   = userId;           // Column B: ID Telegram
  rowData[map.colTelegramName - 1] = userName;         // Column C: Tên theo telegram in group
  rowData[map.colDateReal - 1]     = timeRealStr;      // Column D: Date time sent group
  rowData[map.colDatePlan - 1]     = timePlanStr;      // Column E: Date Conten
  rowData[map.colTeam - 1]         = teamNameStr;      // Column F: Team
  rowData[map.colTniName - 1]      = tniCodeStr;       // Column G: Name TNI

  activeContentCols.forEach(function(colIdx) {
    var textVal = sectionValues[colIdx];
    if (textVal) {
      rowData[colIdx - 1] = textVal;
    }
  });

  sheet.getRange(startRow, 1, 1, rowData.length).setValues([rowData]);

  activeContentCols.forEach(function(colIdx) {
    var cell = sheet.getRange(startRow, colIdx);
    var textVal = rowData[colIdx - 1];
    setCellWithHyperlinks(cell, textVal);
  });

  var props = PropertiesService.getScriptProperties();
  props.setProperty("ACTIVE_STT_USER_" + userId, String(nextSTT));
  props.setProperty("ACTIVE_COLS_USER_" + userId, JSON.stringify(activeContentCols));
  props.setProperty("ACTIVE_TIME_USER_" + userId, String(new Date().getTime()));

  var confirmMsg = "✅ Report #" + nextSTT + " saved successfully!";
  if (tniCodeStr) {
    confirmMsg = "✅ Report #" + nextSTT + " (" + tniCodeStr + ") saved successfully!";
  }
  sendTelegramMsg(chatId, confirmMsg, messageId);

  console.log("[TEXT] STT #" + nextSTT + " | User: " + userName + " | Team: " + teamNameStr + " | TNI: " + tniCodeStr);
}

/**
 * 🖼️ Process Incoming Photo Message -> 
 * EXCLUSIVELY KEEP ONLY THE CLEAN "📥 DOWNLOAD ALL (N Photos)" LINK LINE AT THE BOTTOM OF THE REPORT CELL!
 * Strips out all individual Photo 1, Photo 2... lines.
 */
function handlePhotoMessage(userId, photoArray, msgDate, chatId, messageId) {
  var props = PropertiesService.getScriptProperties();
  var activeSTT = props.getProperty("ACTIVE_STT_USER_" + userId);
  var activeColsJson = props.getProperty("ACTIVE_COLS_USER_" + userId);
  var activeTimeStr = props.getProperty("ACTIVE_TIME_USER_" + userId);

  if (!activeSTT) {
    console.warn("[PHOTO] User " + userId + " sent a photo without an active text session.");
    return;
  }

  if (activeTimeStr) {
    var elapsedMs = new Date().getTime() - Number(activeTimeStr);
    if (elapsedMs > 10 * 60 * 1000) {
      console.warn("[PHOTO] Session for User " + userId + " expired (>10 mins). Stopping photo collection & clearing session.");
      // 🛑 Tự động xóa phiên hoạt động đã quá 10 phút -> Ngừng thu thập & bỏ qua toàn bộ ảnh trò chuyện sau 10 phút
      props.deleteProperty("ACTIVE_STT_USER_" + userId);
      props.deleteProperty("ACTIVE_COLS_USER_" + userId);
      props.deleteProperty("ACTIVE_TIME_USER_" + userId);
      return;
    }
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(TNI_CONFIG.SHEET_COLLECT);
  if (!sheet) return;

  var map = getDynamicColumnMapping(sheet);

  var targetRow = findRowBySTT(sheet, map.colRef, Number(activeSTT));
  if (targetRow === -1) {
    console.warn("[PHOTO] STT #" + activeSTT + " row not found on sheet.");
    return;
  }

  var largestPhoto = photoArray[photoArray.length - 1];
  var fileData = saveTelegramPhotoToDrive(largestPhoto.file_id, activeSTT, userId);

  if (!fileData) {
    console.error("[PHOTO] Failed to save photo for STT #" + activeSTT);
    return;
  }

  var targetCols = [];
  if (activeColsJson) {
    try { targetCols = JSON.parse(activeColsJson); } catch(e) {}
  }
  if (!targetCols || targetCols.length === 0) {
    targetCols = [map.defaultContentCol || 8];
  }

  // Count exact number of photo files currently stored in this STT Drive folder
  var rootFolder = getOrCreateFolder(TNI_CONFIG.DRIVE_FOLDER_NAME);
  var sttFolder = getOrCreateSubFolder(rootFolder, "Report_STT_" + activeSTT);
  var totalPhotosCount = 0;
  var files = sttFolder.getFiles();
  while (files.hasNext()) {
    files.next();
    totalPhotosCount++;
  }

  // Update target cells: KEEP ONLY THE SINGLE CLEAN "📥 DOWNLOAD ALL (N Photos)" LINK LINE!
  targetCols.forEach(function(colIdx) {
    var cell = sheet.getRange(targetRow, colIdx);
    var currentRichText = cell.getRichTextValue();
    var currentVal = currentRichText ? currentRichText.getText().trim() : cell.getValue().toString().trim();

    // Strip out any previous DOWNLOAD ALL or Photo lines
    var lines = currentVal.split('\n').filter(function(line) {
      var trimmed = line.trim();
      return trimmed.indexOf("DOWNLOAD ALL") === -1 && 
             trimmed.indexOf("Photo Link") === -1 && 
             trimmed.indexOf("Photo ") === -1 &&
             trimmed.indexOf("Download Link") === -1;
    });

    var textBody = lines.join('\n').trim();
    var downloadLine = "📥 DOWNLOAD ALL (" + totalPhotosCount + " Photos): " + fileData.folderUrl;

    var finalCellText = "";
    if (textBody !== "") {
      finalCellText = textBody + "\n\n" + downloadLine;
    } else {
      finalCellText = downloadLine;
    }

    setCellWithHyperlinks(cell, finalCellText);
  });

  if (chatId && messageId) {
    sendTelegramMsg(chatId, "📷 Photo attached to Report #" + activeSTT + "!", messageId);
  }

  console.log("[PHOTO] Updated single Download All link (" + totalPhotosCount + " photos) for STT #" + activeSTT);
}

/**
 * 🔍 Map Dynamic Header Positions from Row 1
 */
function getDynamicColumnMapping(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 20);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var map = {
    colRef: 1,
    colTelegramId: 2,
    colTelegramName: 3,
    colDateReal: 4,
    colDatePlan: 5,
    colTeam: 6,
    colTniName: 7,
    defaultContentCol: 8,
    templateKeys: {},
    maxKeyCol: 8
  };

  headers.forEach(function(h, idx) {
    var title = h ? h.toString().trim() : "";
    var lowerTitle = title.toLowerCase();
    var colNum = idx + 1;

    if (lowerTitle === "ref" || lowerTitle === "stt") {
      map.colRef = colNum;
    } else if (lowerTitle.indexOf("id telegram") !== -1 || lowerTitle.indexOf("telegram id") !== -1) {
      map.colTelegramId = colNum;
    } else if (lowerTitle.indexOf("tên theo telegram") !== -1 || lowerTitle.indexOf("name telegram") !== -1 || lowerTitle.indexOf("telegram name") !== -1) {
      map.colTelegramName = colNum;
    } else if (lowerTitle.indexOf("date time") !== -1 || lowerTitle.indexOf("sent") !== -1) {
      map.colDateReal = colNum;
    } else if (lowerTitle.indexOf("date conten") !== -1 || lowerTitle.indexOf("date content") !== -1) {
      map.colDatePlan = colNum;
    } else if (lowerTitle === "team" || lowerTitle.indexOf("nhóm") !== -1) {
      map.colTeam = colNum;
    } else if (lowerTitle.indexOf("name tni") !== -1 || (lowerTitle.indexOf("tni") !== -1 && lowerTitle.indexOf("bot") === -1)) {
      map.colTniName = colNum;
    } else if (colNum >= 8 && title !== "") {
      map.templateKeys[lowerTitle] = colNum;
      if (lowerTitle === "delivery") map.defaultContentCol = colNum;
      if (colNum > map.maxKeyCol) map.maxKeyCol = colNum;
    }
  });

  return map;
}

/**
 * 🧩 Parse Text into Template Sections
 */
function parseTemplateSections(text, templateKeys) {
  var result = {};
  if (!text || !templateKeys || Object.keys(templateKeys).length === 0) {
    return result;
  }

  var keys = Object.keys(templateKeys);
  var patternStr = "(?:^|\\n)\\s*(" + keys.map(function(k) { return escapeRegExp(k); }).join("|") + ")\\s*[:\\-]?\\s*";
  var regex = new RegExp(patternStr, "gi");

  var matches = [];
  var match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      keyLower: match[1].toLowerCase().trim(),
      index: match.index,
      headerLength: match[0].length
    });
  }

  if (matches.length > 0) {
    for (var i = 0; i < matches.length; i++) {
      var current = matches[i];
      var startPos = current.index + current.headerLength;
      var endPos = (i + 1 < matches.length) ? matches[i + 1].index : text.length;

      var sectionText = text.substring(startPos, endPos).trim();
      var colIdx = templateKeys[current.keyLower];

      if (colIdx) {
        result[colIdx] = (result[colIdx] ? result[colIdx] + "\n" : "") + sectionText;
      }
    }
  }

  return result;
}

/**
 * 🛡️ Strict Validation for Construction Bot Messages:
 * Must start at beginning (Line 1) with a valid Header Key + Date (e.g., "Plan: 14/08/2026", "Delivery: 14/08/2026", "Team received material: 14/08/2026", etc.)
 * AND must contain a "Team" line (e.g. "Team 1:", "Team 2:", "Team 3:", etc.).
 * Ignores casual conversations (e.g. "Myint Ko Ko Aung Pyae Phyo Zaw need sent plan tomorrow...").
 */
function isValidConstructionReport(text, templateKeys) {
  if (!text) return false;

  var cleanText = text.trim();
  var firstLine = cleanText.split('\n')[0].trim();

  // 1. Check if first line matches any of the official mandatory header keys followed by a Date (DD/MM/YYYY)
  var officialHeaderRegex = /^\s*(delivery|team\s*received\s*material|plan|upgraded|revoked\s*material|degraded|solared|cable\s*route\s*over\s*head\s*progress|cable\s*route\s*over\s*head\s*complete|cable\s*route\s*under\s*ground\s*progress|cable\s*route\s*under\s*ground\s*completed)\s*[:\-]?\s*[0-3]?[0-9][\/\.-][0-1]?[0-9][\/\.-]20[2-9][0-9]/i;

  var isHeaderValid = officialHeaderRegex.test(firstLine);

  if (!isHeaderValid && templateKeys) {
    // Dynamic fallback: check against keys from Column D of sheet
    var keys = Object.keys(templateKeys);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i].trim();
      if (!k) continue;
      var dynRegex = new RegExp("^\\s*" + escapeRegExp(k) + "\\s*[:\\-]?\\s*[0-3]?[0-9][\\/\\.-][0-1]?[0-9][\\/\\.-]20[2-9][0-9]", "i");
      if (dynRegex.test(firstLine)) {
        isHeaderValid = true;
        break;
      }
    }
  }

  if (!isHeaderValid) {
    return false;
  }

  // 2. Must contain "Team" line in the message body
  var hasTeamLine = /\bteam\b/i.test(cleanText);
  if (!hasTeamLine) {
    return false;
  }

  return true;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 🏷️ Extract TNI Codes
 */
function extractTniCodesFromText(text) {
  if (!text) return "";
  var tniRegex = /\bTNI[A-Za-z0-9_]+(?:-TNI[A-Za-z0-9_]+)?\b/gi;
  var matches = text.match(tniRegex);

  if (matches && matches.length > 0) {
    var uniqueCodes = Array.from(new Set(matches.map(function(m) { return m.trim(); })));
    return uniqueCodes.join(", ");
  }

  return "";
}

/**
 * 👥 Extract Team Name
 */
function extractTeamNameFromText(text, defaultChatTitle) {
  if (text) {
    var teamRegex = /\b(Team\s*[1-4]|TEC\s*[1-4]|TNI\s*Team\s*[1-4])\b/i;
    var match = text.match(teamRegex);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  if (defaultChatTitle) {
    var matchTitle = defaultChatTitle.match(/\b(TEAM\s*[1-4])\b/i);
    if (matchTitle) return matchTitle[1].toUpperCase();
    return defaultChatTitle;
  }

  return "TEAM 1";
}

/**
 * 📅 Extract Plan Date
 */
function extractPlanDateFromText(text, fallbackDate) {
  if (!text) return Utilities.formatDate(fallbackDate, Session.getScriptTimeZone(), "dd/MM/yyyy");

  var dateRegex = /(\b[0-3]?[0-9][\/\.-][0-1]?[0-9](?:[\/\.-]20[2-9][0-9])?\b)/i;
  var match = text.match(dateRegex);

  if (match && match[1]) {
    var dateStr = match[1].replace(/[\.-]/g, "/");
    var parts = dateStr.split("/");
    if (parts.length === 2) {
      var year = fallbackDate.getFullYear();
      dateStr = parts[0].padStart(2, '0') + '/' + parts[1].padStart(2, '0') + '/' + year;
    } else if (parts.length === 3) {
      dateStr = parts[0].padStart(2, '0') + '/' + parts[1].padStart(2, '0') + '/' + parts[2];
    }
    return dateStr;
  }

  return Utilities.formatDate(fallbackDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

/**
 * 📂 Save Telegram Photo to STT Subfolder -> Returns Object with View & Folder URLs
 */
function saveTelegramPhotoToDrive(fileId, stt, userId) {
  try {
    var token = getBotToken();
    var getFileUrl = "https://api.telegram.org/bot" + token + "/getFile?file_id=" + fileId;
    var resp = UrlFetchApp.fetch(getFileUrl, { muteHttpExceptions: true });
    var json = JSON.parse(resp.getContentText());

    if (!json.ok || !json.result || !json.result.file_path) {
      console.error("Telegram getFile error:", json.description);
      return null;
    }

    var filePath = json.result.file_path;
    var downloadUrl = "https://api.telegram.org/file/bot" + token + "/" + filePath;

    var imageBlob = UrlFetchApp.fetch(downloadUrl).getBlob();
    var timeStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss_SSS");
    var fileName = "STT_" + stt + "_U" + userId + "_" + timeStamp + ".jpg";
    imageBlob.setName(fileName);

    // Root Folder "2.10 TNI PHOTO CONSTRUCTION"
    var rootFolder = getOrCreateFolder(TNI_CONFIG.DRIVE_FOLDER_NAME);
    
    // Dedicated Subfolder for this STT Report
    var folderName = "Report_STT_" + stt;
    var sttFolder = getOrCreateSubFolder(rootFolder, folderName);
    sttFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var driveFile = sttFolder.createFile(imageBlob);
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      fileId: driveFile.getId(),
      viewUrl: driveFile.getUrl(),
      folderUrl: sttFolder.getUrl()
    };
  } catch (err) {
    console.error("saveTelegramPhotoToDrive error:", err);
    return null;
  }
}

/**
 * 📁 Get or Create Subfolder inside Parent Folder
 */
function getOrCreateSubFolder(parentFolder, subFolderName) {
  var folders = parentFolder.getFoldersByName(subFolderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(subFolderName);
}

/**
 * 🔎 Find Row Index by STT Number
 */
function findRowBySTT(sheet, colRef, targetSTT) {
  var lastRow = sheet.getLastRow();
  var startRow = getTargetInsertRow(sheet);
  if (lastRow < startRow) return -1;

  var sttValues = sheet.getRange(startRow, colRef, lastRow - startRow + 1, 1).getValues();
  for (var i = 0; i < sttValues.length; i++) {
    if (Number(sttValues[i][0]) === targetSTT) {
      return i + startRow;
    }
  }
  return -1;
}

/**
 * 📌 Target Row for Inserting New Reports (Row 3)
 */
function getTargetInsertRow(sheet) {
  if (sheet.getLastRow() < 2) return 2;
  var valRow2 = sheet.getRange(2, 1).getFormula();
  if (valRow2 && valRow2.toString().indexOf("=") === 0) {
    return 3;
  }
  return 2;
}

/**
 * 📁 Get or Create Google Drive Folder
 */
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

/**
 * 🔑 Get Telegram Bot Token
 */
function getBotToken() {
  var token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (token && token.trim() !== '') return token.trim();
  return TNI_CONFIG.DEFAULT_BOT_TOKEN;
}

/**
 * 🔄 Internal Template Map Synchronizer
 */
function syncTemplateCons() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(TNI_CONFIG.SHEET_TEMPLATE);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  var rangeA = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
  var rangeD = sheet.getRange(3, 4, lastRow - 2, 1).getValues();

  var templateMap = {};
  for (var i = 0; i < rangeA.length; i++) {
    var key = rangeA[i][0] ? rangeA[i][0].toString().trim() : "";
    var val = rangeD[i][0] ? rangeD[i][0].toString().trim() : "";
    if (key !== "") {
      templateMap[key] = val;
    }
  }

  PropertiesService.getScriptProperties().setProperty("TEMPLATE_CONS_MAP", JSON.stringify(templateMap));
  console.log("✅ Internal template cache updated successfully:", Object.keys(templateMap).length, "items.");
}

/**
 * 📲 Register Telegram Slash Command Menu
 */
function setTelegramMenuCommands() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(TNI_CONFIG.SHEET_TEMPLATE);

  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  var rangeA = sheet.getRange(3, 1, lastRow - 2, 1).getValues();

  var commandsList = [
    { command: "template", description: "All Templates" }
  ];

  for (var i = 0; i < rangeA.length; i++) {
    var keyName = rangeA[i][0] ? rangeA[i][0].toString().trim() : "";
    if (keyName !== "") {
      var cleanCmd = keyName.toLowerCase()
                              .replace(/[^a-z0-9_]/g, "_")
                              .replace(/_+/g, "_")
                              .substring(0, 32);
      
      if (cleanCmd && !commandsList.some(function(c) { return c.command === cleanCmd; })) {
        commandsList.push({
          command: cleanCmd,
          description: keyName
        });
      }
    }
  }

  var token = getBotToken();
  var url = "https://api.telegram.org/bot" + token + "/setWebhook";
  var payload = {
    commands: commandsList
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var resp = UrlFetchApp.fetch(url, options);
  var result = JSON.parse(resp.getContentText());

  if (result.ok) {
    console.log("✅ Registered " + commandsList.length + " neat commands on Telegram Menu!");
  } else {
    console.error("❌ Telegram setMyCommands error: " + result.description);
  }
}

/**
 * 🌐 Webhook & Command Registration Setup
 */
function setWebhookTniSiteBot() {
  var newUrl = 'https://script.google.com/macros/s/AKfycbwi3J0VrrIE91mnPvIUuykPjwGvNc4y9JDxCNPvJTtOmVAvvalDXu5ZwYZmu5jW-fSo0w/exec';
  var token = getBotToken();
  var url = "https://api.telegram.org/bot" + token + "/setWebhook?url=" + encodeURIComponent(newUrl);

  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var result = JSON.parse(resp.getContentText());

  if (result.ok) {
    console.log("✅ Set Webhook successfully for Bot 10 TNI_SITE!\nURL: " + newUrl);
    setTelegramMenuCommands();
  } else {
    console.error("❌ Set Webhook failed: " + result.description);
  }
}
