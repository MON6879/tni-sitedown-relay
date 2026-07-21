// Bot Token: 8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw
// Spreadsheet ID: 18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54
// Drive Folder ID: 1qT8RxGKgVyUo-EG7PwVvH2MSE5bxPUJb

function doGet(e) {
  if (!e || !e.parameter) {
    return ContentService.createTextOutput("No parameter received");
  }
  const action = e.parameter.action;
  if (action === "init") {
    initAttendanceScriptProperties();
    return ContentService.createTextOutput("Properties initialized successfully");
  }
  if (action === "setup_webhook") {
    const props = PropertiesService.getScriptProperties();
    const webAppUrl = ScriptApp.getService().getUrl() || e.parameter.url;
    if (webAppUrl) {
      props.setProperty("WEBAPP_URL", webAppUrl);
    }
    setupAttendanceWebhook();
    return ContentService.createTextOutput("Webhook set to: " + props.getProperty("WEBAPP_URL"));
  }
  if (action === "get_headers") {
    const ss = SpreadsheetApp.openById("18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
    const s1 = ss.getSheetByName("List Attendance");
    const s2 = ss.getSheetByName("Staff attendance");
    const h1 = s1 ? s1.getRange(1, 1, 1, s1.getLastColumn()).getValues()[0] : [];
    const h2 = s2 ? s2.getRange(1, 1, 1, s2.getLastColumn()).getValues()[0] : [];
    return ContentService.createTextOutput(JSON.stringify({ list_attendance: h1, staff_attendance: h2 }));
  }
  if (action === "get_logs") {
    const ss = SpreadsheetApp.openById("18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
    const logSheet = ss.getSheetByName("Logs");
    if (!logSheet) return ContentService.createTextOutput(JSON.stringify([]));
    const lastRow = logSheet.getLastRow();
    if (lastRow < 2) return ContentService.createTextOutput(JSON.stringify([]));
    const logs = logSheet.getRange(2, 1, lastRow - 1, 2).getValues();
    return ContentService.createTextOutput(JSON.stringify(logs));
  }
  return ContentService.createTextOutput("Unknown action: " + action);
}

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SEND_BOT_TOKEN") || "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw";
  const ssId = props.getProperty("ATTENDANCE_SS_ID") || "18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54";
  const folderId = props.getProperty("DRIVE_FOLDER_ID") || "1qT8RxGKgVyUo-EG7PwVvH2MSE5bxPUJb";
  const geminiApiKey = props.getProperty("GEMINI_API_KEY") || "";

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput("No post data received");
    }

    const update = JSON.parse(e.postData.contents);

    // ── DEDUPLICATE TELEGRAM WEBHOOK RETRIES ──
    if (update.update_id) {
      const cache = CacheService.getScriptCache();
      const cacheKey = "attendance_upd_" + update.update_id;
      if (cache.get(cacheKey)) {
        logToSheet_("Duplicate update_id (cache): " + update.update_id + ", ignoring.");
        return ContentService.createTextOutput("OK");
      }
      cache.put(cacheKey, "1", 21600); // Cache for 6 hours

      // Deduplicate permanently in PropertiesService (keep last 100 update_ids)
      const rawUpds = props.getProperty("PROCESSED_UPDATES") || "[]";
      let processedUpds = [];
      try { processedUpds = JSON.parse(rawUpds); } catch (ex) {}
      if (processedUpds.indexOf(update.update_id) !== -1) {
        logToSheet_("Duplicate update_id (props): " + update.update_id + ", ignoring.");
        return ContentService.createTextOutput("OK");
      }
      processedUpds.push(update.update_id);
      if (processedUpds.length > 100) processedUpds = processedUpds.slice(-100);
      props.setProperty("PROCESSED_UPDATES", JSON.stringify(processedUpds));
    }

    logToSheet_("Update received: " + JSON.stringify(update));
    Logger.log("Update received: " + JSON.stringify(update));

    const msg = update.message;
    if (!msg) {
      return ContentService.createTextOutput("No message object");
    }

    // Ignore old messages (older than 10 minutes = 600 seconds)
    const nowSec = Math.floor((new Date()).getTime() / 1000);
    if (msg.date && (nowSec - msg.date > 600)) {
      logToSheet_("Message too old (" + (nowSec - msg.date) + "s old), update_id: " + update.update_id + ", ignoring.");
      return ContentService.createTextOutput("OK");
    }

    const chatId = msg.chat.id.toString();
    const telegramUser = msg.from;
    const senderId = telegramUser.id.toString();
    const senderName = telegramUser.first_name + (telegramUser.last_name ? " " + telegramUser.last_name : "");

    // 1. Kiểm tra xem tin nhắn có chứa ảnh hay không
    const photoArray = msg.photo;
    if (!photoArray || photoArray.length === 0) {
      return ContentService.createTextOutput("Message does not contain photo");
    }

    // Lấy ảnh kích thước lớn nhất
    const fileId = photoArray[photoArray.length - 1].file_id;

    logToSheet_("Photo fileId: " + fileId + ", downloading from Telegram...");
    const imageBlob = getTelegramFile_(token, fileId);

    logToSheet_("Photo downloaded. Saving to Google Drive folder " + folderId + "...");
    const msgDateObj = msg.date ? new Date(msg.date * 1000) : new Date();
    const dateStr = Utilities.formatDate(msgDateObj, "Asia/Rangoon", "dd/MM/yyyy");
    const timeStr = Utilities.formatDate(msgDateObj, "Asia/Rangoon", "HH:mm");
    const fileDateSuffix = Utilities.formatDate(msgDateObj, "Asia/Rangoon", "yyyyMMdd_HHmmss");
    
    const fileName = "attendance_" + fileDateSuffix + "_" + senderId + ".jpg";
    const driveFileUrl = saveToDrive_(imageBlob, folderId, fileName);
    logToSheet_("Photo saved to Drive. URL: " + driveFileUrl);

    logToSheet_("Reading Staff attendance sheet database...");
    const ss = SpreadsheetApp.openById(ssId);
    const staffSheet = ss.getSheetByName("Staff attendance");
    if (!staffSheet) {
      logToSheet_("❌ Error: Sheet 'Staff attendance' not found");
      sendTelegramMessage_(token, chatId, "❌ Lỗi: Không tìm thấy sheet 'Staff attendance'");
      return ContentService.createTextOutput("Staff attendance sheet not found");
    }

    const staffLastRow = staffSheet.getLastRow();
    if (staffLastRow < 2) {
      logToSheet_("❌ Error: Staff attendance sheet is empty");
      sendTelegramMessage_(token, chatId, "❌ Lỗi: Danh sách nhân viên trống");
      return ContentService.createTextOutput("Staff attendance sheet empty");
    }

    const cols = getStaffColumns_(staffSheet);
    logToSheet_("Column mapping: " + JSON.stringify(cols));
    const staffRange = staffSheet.getRange(2, 1, staffLastRow - 1, staffSheet.getLastColumn());
    const staffValues = staffRange.getValues();

    const staffList = [];
    for (let i = 0; i < staffValues.length; i++) {
      const row = staffValues[i];
      const shortName = String(row[cols.nameCol - 1] || "").trim();
      const fullName = cols.fullNameCol ? String(row[cols.fullNameCol - 1] || "").trim() : shortName;
      const tgId = String(row[cols.idCol - 1] || "").trim();
      const photoUrl = String(row[cols.photoCol - 1] || "").trim();
      const depName = cols.depCol ? String(row[cols.depCol - 1] || "").trim() : "";

      if (shortName) {
        staffList.push({
          name: shortName,
          fullName: fullName,
          telegramId: tgId,
          photoUrl: photoUrl,
          department: depName,
          rowNum: i + 2
        });
      }
    }
    logToSheet_("Read " + staffList.length + " staff members from database.");

    // 5. Tiến hành đối chiếu nhận diện bằng Gemini AI
    let geminiMatches = [];
    let extractedImageName = "";
    if (geminiApiKey) {
      logToSheet_("Calling Gemini API for face matching and OCR...");
      const geminiResult = identifyFaces_(imageBlob, staffList, geminiApiKey);
      if (geminiResult) {
        geminiMatches = geminiResult.matches || [];
        extractedImageName = geminiResult.imageName || "";
      }
      logToSheet_("Gemini result: matches=" + JSON.stringify(geminiMatches) + ", extractedImageName=" + extractedImageName);
    } else {
      logToSheet_("⚠️ No Gemini API Key configured. Skipping AI face recognition.");
    }

    // Nếu không tìm thấy tên ảnh từ Gemini, sử dụng caption làm dự phòng
    if (!extractedImageName && msg.caption) {
      extractedImageName = String(msg.caption).trim();
    }

    // 6. Xây dựng danh sách người điểm danh cuối cùng
    const finalMatches = [];

    // Luôn ưu tiên đưa người gửi tin nhắn (sender) vào danh sách điểm danh
    const senderStaff = staffList.find(s => s.telegramId === senderId);
    if (senderStaff) {
      finalMatches.push({
        name: senderStaff.name,
        fullName: senderStaff.fullName,
        telegramId: senderStaff.telegramId,
        department: senderStaff.department
      });
    } else {
      // Nếu người gửi chưa có trong database, vẫn thêm tạm bằng thông tin Telegram của họ
      finalMatches.push({
        name: senderName,
        fullName: senderName,
        telegramId: senderId,
        department: ""
      });
    }

    // Nếu là chụp chung (Gemini nhận diện được nhiều người hơn hoặc người khác)
    // Thêm các nhân viên khác được Gemini nhận diện vào danh sách điểm danh
    for (let i = 0; i < geminiMatches.length; i++) {
      const gMatch = geminiMatches[i];
      const isAlreadyAdded = finalMatches.some(m => 
        (m.telegramId && m.telegramId === gMatch.telegramId) || 
        (m.name.toLowerCase() === gMatch.name.toLowerCase())
      );
      if (!isAlreadyAdded) {
        const dbStaff = staffList.find(s => s.name.toLowerCase() === gMatch.name.toLowerCase() || (s.telegramId && s.telegramId === gMatch.telegramId));
        if (dbStaff) {
          finalMatches.push({
            name: dbStaff.name,
            fullName: dbStaff.fullName,
            telegramId: dbStaff.telegramId,
            department: dbStaff.department
          });
        }
      }
    }

    // 7. Ghi nhận điểm danh vào sheet "List Attendance"
    const attendanceSheet = ss.getSheetByName("List Attendance");
    if (!attendanceSheet) {
      sendTelegramMessage_(token, chatId, "❌ Lỗi: Không tìm thấy sheet 'List Attendance'");
      return ContentService.createTextOutput("List Attendance sheet not found");
    }

    // Tính số thứ tự điểm danh (tạo số cho bot trả lời)
    let nextNum = 1;
    const lastRow = attendanceSheet.getLastRow();
    if (lastRow >= 2) {
      const currentTopNum = parseInt(attendanceSheet.getRange(2, 1).getValue(), 10);
      if (!isNaN(currentTopNum)) {
        nextNum = currentTopNum + 1;
      }
    }

    let successCount = 0;
    let replyMsg = "✅ **Attendance Recorded #" + nextNum + "**:\n";
    if (extractedImageName) {
      replyMsg += `📍 Site/Task: *${extractedImageName}*\n`;
    }

    for (let i = 0; i < finalMatches.length; i++) {
      const match = finalMatches[i];
      const finalShortName = match.name;
      const finalFullName = match.fullName;
      const finalTgId = match.telegramId;
      const finalDep = match.department;

      // Kiểm tra trùng lặp trong ngày hôm nay theo Telegram ID và Mã Site (nếu có)
      if (isAlreadyLoggedToday_(attendanceSheet, dateStr, finalTgId, extractedImageName)) {
        replyMsg += `- ${finalShortName} (Already logged today)\n`;
        continue;
      }

      // Thêm dòng mới vào đầu bảng (dưới tiêu đề ở dòng 1)
      attendanceSheet.insertRowAfter(1); // Chèn dòng trống ở dòng 2
      attendanceSheet.getRange(2, 1, 1, 7).setValues([[
        nextNum,
        dateStr,
        timeStr,
        finalTgId,
        extractedImageName, // E: Name Trên Hình (Nội dung trích xuất từ hình, vd TNI0295)
        finalFullName,      // F: Full name
        driveFileUrl        // G: photo
      ]]);
      
      replyMsg += `- ${finalShortName} (${finalDep})\n`;
      successCount++;
    }

    if (successCount > 0) {
      sendTelegramMessage_(token, chatId, replyMsg);
    } else {
      sendTelegramMessage_(token, chatId, "⚠️ Điểm danh hôm nay của bạn/nhóm đã được ghi nhận trước đó.");
    }

    return ContentService.createTextOutput("OK");
  } catch (err) {
    logToSheet_("❌ Exception in doPost: " + err.message + "\nStack: " + err.stack);
    Logger.log("Error processing update: " + err.message);
    return ContentService.createTextOutput("Error: " + err.message);
  }
}

/** Tải file từ Telegram */
function getTelegramFile_(token, fileId) {
  const getFileUrl = "https://api.telegram.org/bot" + token + "/getFile?file_id=" + fileId;
  const resp = UrlFetchApp.fetch(getFileUrl, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error("Failed to get file path from Telegram: " + resp.getContentText());
  }
  const fileData = JSON.parse(resp.getContentText());
  const filePath = fileData.result.file_path;
  
  const downloadUrl = "https://api.telegram.org/file/bot" + token + "/" + filePath;
  const imageResp = UrlFetchApp.fetch(downloadUrl, { muteHttpExceptions: true });
  if (imageResp.getResponseCode() !== 200) {
    throw new Error("Failed to download file from Telegram");
  }
  return imageResp.getBlob();
}

/** Lưu ảnh vào thư mục Drive và trả về link public */
function saveToDrive_(blob, folderId, fileName) {
  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(blob);
  file.setName(fileName);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log("⚠️ Set sharing permission warning: " + e.message);
  }
  return file.getUrl();
}

/** Định vị động các cột trong sheet Staff attendance */
function getStaffColumns_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let nameCol = 5;      // Column E (Name / Short name)
  let fullNameCol = 6;  // Column F (Full name)
  let idCol = 1;        // Column A (Telegram ID)
  let photoCol = 15;    // Column O (photo)
  let depCol = 11;      // Column K (Dep)

  for (let j = 0; j < headers.length; j++) {
    const header = String(headers[j]).trim().toLowerCase();
    if (header === "name" || header === "tên") {
      nameCol = j + 1;
    } else if (header.indexOf("full name") !== -1 || header.indexOf("fullname") !== -1 || header.indexOf("họ tên") !== -1) {
      fullNameCol = j + 1;
    } else if (header.indexOf("telegram id") !== -1 || header === "telegram id ") {
      idCol = j + 1;
    } else if (header.indexOf("photo") !== -1 || header.indexOf("ảnh") !== -1) {
      photoCol = j + 1;
    } else if (header.indexOf("dep") !== -1 || header.indexOf("phòng") !== -1 || header.indexOf("bộ phận") !== -1) {
      depCol = j + 1;
    }
  }
  return { nameCol: nameCol, fullNameCol: fullNameCol, idCol: idCol, photoCol: photoCol, depCol: depCol };
}

/** Kiểm tra xem nhân viên đã điểm danh trong ngày hôm nay chưa theo Telegram ID và Mã Site (nếu có) */
function isAlreadyLoggedToday_(sheet, dateStr, telegramId, siteCode) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  // Đọc từ cột B (Date) đến cột E (Name Trên Hình / Site) -> 4 cột
  const values = sheet.getRange(2, 2, lastRow - 1, 4).getValues(); 
  for (let i = 0; i < values.length; i++) {
    const rowDate = values[i][0];
    const rowTgId = String(values[i][2] || "").trim(); // Cột D (Telegram ID)
    const rowSite = String(values[i][3] || "").trim(); // Cột E (Name Trên Hình / Site)
    
    let formattedRowDate = "";
    if (rowDate instanceof Date) {
      formattedRowDate = Utilities.formatDate(rowDate, "Asia/Rangoon", "dd/MM/yyyy");
    } else {
      formattedRowDate = String(rowDate || "").trim();
    }
    
    if (formattedRowDate.split(" ")[0] === dateStr && rowTgId === telegramId) {
      if (siteCode && siteCode.trim() !== "") {
        if (rowSite.toLowerCase() === siteCode.trim().toLowerCase()) {
          return true; // Đã điểm danh mã site này rồi
        }
      } else {
        if (!rowSite || rowSite.toLowerCase() === (siteCode || "").trim().toLowerCase()) {
          return true;
        }
      }
    }
  }
  return false;
}

/** Nhận dạng khuôn mặt bằng Gemini AI */
function identifyFaces_(attendanceBlob, staffList, apiKey) {
  // Chỉ lọc các nhân viên đã có link ảnh mẫu, giới hạn tối đa 15 người để tránh vượt giới hạn kích thước request
  const candidates = staffList.filter(s => s.photoUrl && s.photoUrl.trim() !== "").slice(0, 15);
  if (candidates.length === 0) {
    Logger.log("⚠️ Không tìm thấy ảnh mẫu đối chiếu nào.");
    return { matches: [], imageName: "" };
  }

  const parts = [];
  
  // 1. Thêm ảnh điểm danh cần kiểm tra
  parts.push({
    inlineData: {
      mimeType: "image/jpeg",
      data: Utilities.base64Encode(attendanceBlob.getBytes())
    }
  });

  let promptText = "You are a staff attendance system. Image 1 (first image) is the target attendance photo.\n";
  promptText += "Here are the reference photos of our staff members:\n";

  let imgIndex = 2;
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    try {
      const fileId = extractFileId_(cand.photoUrl);
      if (fileId) {
        const fileBlob = DriveApp.getFileById(fileId).getBlob();
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: Utilities.base64Encode(fileBlob.getBytes())
          }
        });
        promptText += "- Image " + imgIndex + ": Reference photo for staff '" + cand.name + "' (Telegram ID: " + cand.telegramId + ").\n";
        imgIndex++;
      }
    } catch (e) {
      Logger.log("⚠️ Lỗi tải ảnh mẫu của " + cand.name + ": " + e.message);
    }
  }

  promptText += "\nTask:\n";
  promptText += "1. Identify which of the reference staff members are clearly present in the target attendance photo (Image 1).\n";
  promptText += "2. Look at the target attendance photo (Image 1) and find any text watermark, label, or handwritten code starting with 'TNI' followed by numbers or letters (e.g., 'TNI0295', 'TNI0312'). Extract this code completely (exclude labels like 'Name:' or 'TNI: ' prefix if separate, return the code itself like 'TNI0295').\n\n";
  promptText += "Return the result as a strict JSON object containing:\n";
  promptText += "- \"matches\": Array of objects, each containing:\n";
  promptText += "  - \"name\": String, name of matched staff member.\n";
  promptText += "  - \"telegramId\": String, telegram ID of matched staff member.\n";
  promptText += "- \"imageName\": String, the extracted code starting with 'TNI' from the photo (e.g., \"TNI0295\"). If not found, return empty string \"\".\n\n";
  promptText += "Do not write any markdown code block formatting (like ```json), only return the raw JSON.\n";
  promptText += "Example Output:\n";
  promptText += '{"matches": [{"name": "Ye Lwin", "telegramId": "123456"}], "imageName": "TNI0295"}';

  parts.push({
    text: promptText
  });

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
  const payload = {
    contents: [{ parts: parts }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (resp.getResponseCode() !== 200) {
    Logger.log("❌ Gemini API failed: " + resp.getContentText());
    return { matches: [], imageName: "" };
  }

  try {
    const resData = JSON.parse(resp.getContentText());
    const textResult = resData.candidates[0].content.parts[0].text.trim();
    Logger.log("Gemini matched result: " + textResult);
    
    // Clean markdown blocks if Gemini accidentally included them
    let cleanJson = textResult;
    if (cleanJson.indexOf("```") !== -1) {
      cleanJson = cleanJson.replace(/```json/g, "").replace(/```/g, "").trim();
    }
    
    return JSON.parse(cleanJson);
  } catch (e) {
    Logger.log("❌ Lỗi parse kết quả Gemini: " + e.message);
    return { matches: [], imageName: "" };
  }
}

/** Trích xuất file ID từ link Google Drive */
function extractFileId_(url) {
  if (!url) return null;
  let match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  match = url.match(/id=([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return null;
}

/** Gửi tin nhắn phản hồi Telegram */
function sendTelegramMessage_(token, chatId, text) {
  const url = "https://api.telegram.org/bot" + token + "/sendMessage";
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown"
  };
  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  return resp.getResponseCode() === 200;
}

/** Hàm thiết lập Webhook cho Bot */
function setupAttendanceWebhook() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SEND_BOT_TOKEN") || "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw";
  const webAppUrl = props.getProperty("WEBAPP_URL") || "";
  
  if (!webAppUrl) {
    Logger.log("❌ Thiếu WEBAPP_URL trong Script Properties. Hãy deploy làm Web App trước.");
    return;
  }
  
  const url = "https://api.telegram.org/bot" + token + "/setWebhook";
  const payload = {
    url: webAppUrl,
    allowed_updates: JSON.stringify(["message"])
  };
  
  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    payload: payload,
    muteHttpExceptions: true
  });
  Logger.log("Set Webhook Response: " + resp.getContentText());
}

/** Hàm thiết lập các tham số cấu hình ban đầu */
function initAttendanceScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("SEND_BOT_TOKEN", "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw");
  props.setProperty("ATTENDANCE_SS_ID", "18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
  props.setProperty("DRIVE_FOLDER_ID", "1qT8RxGKgVyUo-EG7PwVvH2MSE5bxPUJb");
  Logger.log("✅ Khởi tạo Script Properties thành công.");
}

/** Ghi log trực tiếp lên sheet Logs để debug */
function logToSheet_(message) {
  try {
    const ss = SpreadsheetApp.openById("18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
    let logSheet = ss.getSheetByName("Logs");
    if (!logSheet) {
      logSheet = ss.insertSheet("Logs");
      logSheet.appendRow(["Timestamp", "Message"]);
    }
    logSheet.appendRow([new Date(), message]);
  } catch (e) {
    // Bỏ qua lỗi ghi log
  }
}
