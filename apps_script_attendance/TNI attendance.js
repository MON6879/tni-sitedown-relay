// Bot Token: 8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw
// Spreadsheet ID: 18zQB4i0Fu4qFKkKkUZUd6SKWlEBdWDiwgpgNSaL9v54
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
    const ss = SpreadsheetApp.openById("18zQB4i0Fu4qFKkKkUZUd6SKWlEBdWDiwgpgNSaL9v54");
    const s1 = ss.getSheetByName("List Attendance");
    const s2 = ss.getSheetByName("Staff attendance");
    const h1 = s1 ? s1.getRange(1, 1, 1, s1.getLastColumn()).getValues()[0] : [];
    const h2 = s2 ? s2.getRange(1, 1, 1, s2.getLastColumn()).getValues()[0] : [];
    return ContentService.createTextOutput(JSON.stringify({ list_attendance: h1, staff_attendance: h2 }));
  }
  return ContentService.createTextOutput("Unknown action: " + action);
}

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SEND_BOT_TOKEN") || "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw";
  const ssId = props.getProperty("ATTENDANCE_SS_ID") || "18zQB4i0Fu4qFKkKkUZUd6SKWlEBdWDiwgpgNSaL9v54";
  const folderId = props.getProperty("DRIVE_FOLDER_ID") || "1qT8RxGKgVyUo-EG7PwVvH2MSE5bxPUJb";
  const geminiApiKey = props.getProperty("GEMINI_API_KEY") || "";

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput("No post data received");
    }

    const update = JSON.parse(e.postData.contents);
    Logger.log("Update received: " + JSON.stringify(update));

    const msg = update.message;
    if (!msg) {
      return ContentService.createTextOutput("No message object");
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

    // 2. Tải ảnh từ Telegram
    const imageBlob = getTelegramFile_(token, fileId);

    // 3. Lưu ảnh vào Google Drive
    const now = new Date();
    const dateStr = Utilities.formatDate(now, "Asia/Rangoon", "dd/MM/yyyy");
    const timeStr = Utilities.formatDate(now, "Asia/Rangoon", "HH:mm");
    const fileDateSuffix = Utilities.formatDate(now, "Asia/Rangoon", "yyyyMMdd_HHmmss");
    
    const fileName = "attendance_" + fileDateSuffix + "_" + senderId + ".jpg";
    const driveFileUrl = saveToDrive_(imageBlob, folderId, fileName);

    // 4. Đọc danh sách nhân viên từ sheet "Staff attendance"
    const ss = SpreadsheetApp.openById(ssId);
    const staffSheet = ss.getSheetByName("Staff attendance");
    if (!staffSheet) {
      sendTelegramMessage_(token, chatId, "❌ Lỗi: Không tìm thấy sheet 'Staff attendance'");
      return ContentService.createTextOutput("Staff attendance sheet not found");
    }

    const staffLastRow = staffSheet.getLastRow();
    if (staffLastRow < 2) {
      sendTelegramMessage_(token, chatId, "❌ Lỗi: Danh sách nhân viên trống");
      return ContentService.createTextOutput("Staff attendance sheet empty");
    }

    // Định vị động các cột của Staff attendance
    const cols = getStaffColumns_(staffSheet);
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

    // 5. Tiến hành đối chiếu nhận diện bằng Gemini AI
    let matches = [];
    if (geminiApiKey) {
      matches = identifyFaces_(imageBlob, staffList, geminiApiKey);
    }

    // 6. Nếu Gemini không nhận dạng được ai (hoặc chưa cài đặt API key/ảnh mẫu):
    // Đối chiếu dự phòng theo Telegram ID của người gửi tin nhắn.
    if (matches.length === 0) {
      const fallbackStaff = staffList.find(s => s.telegramId === senderId);
      if (fallbackStaff) {
        matches.push({
          name: fallbackStaff.name,
          fullName: fallbackStaff.fullName,
          telegramId: fallbackStaff.telegramId,
          department: fallbackStaff.department
        });
      } else {
        // Nếu không tìm thấy Telegram ID, lưu tạm bằng tên Telegram của người gửi
        matches.push({
          name: senderName,
          fullName: senderName,
          telegramId: senderId,
          department: ""
        });
      }
    }

    // 7. Ghi nhận điểm danh vào sheet "List Attendance"
    const attendanceSheet = ss.getSheetByName("List Attendance");
    if (!attendanceSheet) {
      sendTelegramMessage_(token, chatId, "❌ Lỗi: Không tìm thấy sheet 'List Attendance'");
      return ContentService.createTextOutput("List Attendance sheet not found");
    }

    let successCount = 0;
    let replyMsg = "✅ **Attendance Recorded**:\n";

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      
      // Tìm thông tin phòng ban đầy đủ nếu chưa có từ Gemini
      const dbStaff = staffList.find(s => s.name.toLowerCase() === match.name.toLowerCase() || (s.telegramId && s.telegramId === match.telegramId));
      const finalShortName = dbStaff ? dbStaff.name : match.name;
      const finalFullName = dbStaff ? dbStaff.fullName : (match.fullName || match.name);
      const finalTgId = dbStaff ? dbStaff.telegramId : match.telegramId;
      const finalDep = dbStaff ? dbStaff.department : (match.department || "");

      // Kiểm tra trùng lặp trong ngày hôm nay
      if (isAlreadyLoggedToday_(attendanceSheet, dateStr, finalShortName)) {
        replyMsg += `- ${finalShortName} (Already logged today)\n`;
        continue;
      }

      // Thêm dòng mới vào List Attendance (7 cột)
      attendanceSheet.appendRow([
        finalDep,
        dateStr,
        timeStr,
        finalTgId,
        finalShortName,
        finalFullName,
        driveFileUrl
      ]);
      
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
  let nameCol = 1; // Mặc định cột A
  let fullNameCol = null;
  let idCol = 4;   // Mặc định cột D
  let photoCol = 15; // Mặc định cột O
  let depCol = null;

  for (let j = 0; j < headers.length; j++) {
    const header = String(headers[j]).trim().toLowerCase();
    if (header === "name" || header === "tên") {
      nameCol = j + 1;
    } else if (header.indexOf("full name") !== -1 || header.indexOf("fullname") !== -1 || header.indexOf("họ tên") !== -1) {
      fullNameCol = j + 1;
    } else if (header.indexOf("telegram") !== -1 || header === "id") {
      idCol = j + 1;
    } else if (header.indexOf("photo") !== -1 || header.indexOf("ảnh") !== -1) {
      photoCol = j + 1;
    } else if (header.indexOf("dep") !== -1 || header.indexOf("phòng") !== -1 || header.indexOf("bộ phận") !== -1) {
      depCol = j + 1;
    }
  }
  return { nameCol: nameCol, fullNameCol: fullNameCol, idCol: idCol, photoCol: photoCol, depCol: depCol };
}

/** Kiểm tra xem nhân viên đã điểm danh trong ngày hôm nay chưa */
function isAlreadyLoggedToday_(sheet, dateStr, fullName) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const values = sheet.getRange(2, 2, lastRow - 1, 4).getValues(); // Cột B (Date) đến cột E (Full name)
  for (let i = 0; i < values.length; i++) {
    const rowDate = values[i][0];
    const rowName = String(values[i][3] || "").trim();
    
    let formattedRowDate = "";
    if (rowDate instanceof Date) {
      formattedRowDate = Utilities.formatDate(rowDate, "Asia/Rangoon", "dd/MM/yyyy");
    } else {
      formattedRowDate = String(rowDate || "").trim();
    }
    
    if (formattedRowDate.split(" ")[0] === dateStr && rowName.toLowerCase() === fullName.toLowerCase()) {
      return true;
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
    return [];
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

  promptText += "\nTask: Identify which of the reference staff members are clearly present in the target attendance photo (Image 1).\n";
  promptText += "Return the matched staff members as a strict JSON array of objects, containing name and telegramId. Do not write any markdown formatting, only return the raw JSON.\n";
  promptText += "Example Output:\n";
  promptText += '[{"name": "Ye Lwin", "telegramId": "123456"}]';

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
    return [];
  }

  try {
    const resData = JSON.parse(resp.getContentText());
    const textResult = resData.candidates[0].content.parts[0].text.trim();
    Logger.log("Gemini matched result: " + textResult);
    return JSON.parse(textResult);
  } catch (e) {
    Logger.log("❌ Lỗi parse kết quả Gemini: " + e.message);
    return [];
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
  props.setProperty("ATTENDANCE_SS_ID", "18zQB4i0Fu4qFKkKkUZUd6SKWlEBdWDiwgpgNSaL9v54");
  props.setProperty("DRIVE_FOLDER_ID", "1qT8RxGKgVyUo-EG7PwVvH2MSE5bxPUJb");
  Logger.log("✅ Khởi tạo Script Properties thành công.");
}
