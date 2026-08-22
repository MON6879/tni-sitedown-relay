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
  if (action === "build_general") {
    buildGeneralTab();
    return ContentService.createTextOutput("General tab updated successfully");
  }
  // Chẩn đoán: kiểm tra GEMINI_API_KEY và ảnh mẫu cột O
  if (action === "check_props") {
    const props = PropertiesService.getScriptProperties();
    const gemKey = props.getProperty("GEMINI_API_KEY") || "";
    const ss = SpreadsheetApp.openById("18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
    const staffSheet = ss.getSheetByName("Staff attendance");
    let photoCount = 0;
    if (staffSheet && staffSheet.getLastRow() >= 2) {
      const vals = staffSheet.getRange(2, 15, staffSheet.getLastRow() - 1, 1).getValues();
      photoCount = vals.filter(r => String(r[0] || "").trim() !== "").length;
    }
    return ContentService.createTextOutput(JSON.stringify({
      gemini_key_set: gemKey.length > 0,
      gemini_key_length: gemKey.length,
      staff_photos_in_colO: photoCount
    }));
  }
  // Set GEMINI_API_KEY từ xa: ?action=set_gemini_key&key=AIza...
  if (action === "set_gemini_key") {
    const key = e.parameter.key || "";
    if (key.length > 10) {
      PropertiesService.getScriptProperties().setProperty("GEMINI_API_KEY", key);
      return ContentService.createTextOutput("GEMINI_API_KEY set OK. Length: " + key.length);
    }
    return ContentService.createTextOutput("ERROR: key param missing or too short");
  }
  return ContentService.createTextOutput("Unknown action: " + action);
}

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SEND_BOT_TOKEN") || "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw";
  const ssId = props.getProperty("ATTENDANCE_SS_ID") || "18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54";
  const folderId = getAttendanceFolderId_();
  const geminiApiKey = props.getProperty("GEMINI_API_KEY") || "";

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput("No post data received");
    }

    const update = JSON.parse(e.postData.contents);

    logToSheet_("Update received: " + JSON.stringify(update));
    Logger.log("Update received: " + JSON.stringify(update));

    const msg = update.message;
    if (!msg) {
      return ContentService.createTextOutput("No message object");
    }

    const chatId = msg.chat.id.toString();
    const telegramUser = msg.from;
    const senderId = telegramUser ? telegramUser.id.toString() : "unknown";
    const senderName = telegramUser ? (telegramUser.first_name + (telegramUser.last_name ? " " + telegramUser.last_name : "")) : "Staff";

    // ── XỬ LÝ TIN NHẮN VĂN BẢN (TEXT COMMANDS & ATTENDANCE / LEAVE REPORTS) ──
    const rawText = (msg.text || msg.caption || "").trim();
    let fileId = null;
    if (msg.photo && msg.photo.length > 0) {
      fileId = msg.photo[msg.photo.length - 1].file_id;
    } else if (msg.document && msg.document.mime_type && msg.document.mime_type.indexOf("image/") === 0) {
      fileId = msg.document.file_id;
    }

    if (rawText && !fileId) {
      const textL = rawText.toLowerCase();

      // 1. Tra cứu Attendance & Leave Templates (Strict Anchored Commands — Max 4 words)
      const cleanCmd = textL.split("@")[0].trim();
      const isExplicitTemplateCommand = (
        cleanCmd === "/menu" || cleanCmd === "menu" ||
        cleanCmd === "/help" || cleanCmd === "help" ||
        cleanCmd === "/attendance" || cleanCmd === "attendance" ||
        cleanCmd === "/att" || cleanCmd === "att" ||
        cleanCmd === "/leave" || cleanCmd === "leave" ||
        cleanCmd === "/leave_half" || cleanCmd === "leave half" || cleanCmd === "/leavehalf" ||
        cleanCmd === "/diemdanh" || cleanCmd === "diemdanh" ||
        cleanCmd === "/header" || cleanCmd === "header" ||
        cleanCmd === "/team" ||
        cleanCmd === "/t1" || cleanCmd === "t1" || cleanCmd === "/t1_main" || cleanCmd === "/t1_s1" || cleanCmd === "/t1s1" ||
        cleanCmd === "/t2" || cleanCmd === "t2" || cleanCmd === "/t2_main" || cleanCmd === "/t2_s1" || cleanCmd === "/t2s1" ||
        cleanCmd === "/t3" || cleanCmd === "t3" || cleanCmd === "/t3_main" || cleanCmd === "/t3_s1" || cleanCmd === "/t3s1" ||
        cleanCmd === "/t4" || cleanCmd === "t4" || cleanCmd === "/t4_main" ||
        cleanCmd === "/template_team1" || cleanCmd === "/template_team2" || cleanCmd === "/template_team3" || cleanCmd === "/template_team4" ||
        cleanCmd.startsWith("/template") || cleanCmd.startsWith("template ") ||
        cleanCmd.startsWith("/attendance ") || cleanCmd.startsWith("attendance template") ||
        cleanCmd.startsWith("/leave ") || cleanCmd.startsWith("leave template") ||
        cleanCmd.startsWith("/diemdanh ") || cleanCmd.startsWith("diemdanh template")
      ) && cleanCmd.split(/\s+/).length <= 4;

      if (isExplicitTemplateCommand) {
        const tplReply = handleAttendanceTemplateQuery_(ssId, cleanCmd);
        if (tplReply) {
          sendTelegramMessage_(token, chatId, tplReply);
          return ContentService.createTextOutput("Template sent");
        }
      }

      // 2. Thu thập báo cáo điểm danh của Team Leader / Xin nghỉ phép cá nhân
      if (isAttendanceReportText_(rawText)) {
        const count = processAttendanceReportText_(ssId, rawText, senderId);
        if (count > 0) {
          const nowMM = new Date();
          const timeStr = Utilities.formatDate(nowMM, "Asia/Rangoon", "HH:mm");
          sendTelegramMessage_(token, chatId, "✅ Attendance saved (" + timeStr + ") — Recorded " + count + " staff to Sheet.");
          return ContentService.createTextOutput("Attendance recorded: " + count);
        }
      }
    }

    if (!fileId) {
      return ContentService.createTextOutput("Message does not contain photo or attendance report");
    }

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
      logToSheet_("Error: Sheet 'Staff attendance' not found");
      sendTelegramMessage_(token, chatId, "Loi: Khong tim thay sheet 'Staff attendance'");
      return ContentService.createTextOutput("Staff attendance sheet not found");
    }

    const staffLastRow = staffSheet.getLastRow();
    if (staffLastRow < 2) {
      logToSheet_("Error: Staff attendance sheet is empty");
      sendTelegramMessage_(token, chatId, "Loi: Danh sach nhan vien trong");
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

      const statusVal = cols.statusCol ? String(row[cols.statusCol - 1] || "").toLowerCase() : "";
      if (statusVal.indexOf("resign") !== -1 || statusVal.indexOf("nghỉ") !== -1 || statusVal.indexOf("nghi") !== -1 || statusVal.indexOf("quit") !== -1 || statusVal.indexOf("off") !== -1) {
        continue;
      }

      if (shortName && shortName.toLowerCase() !== "tni") {
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

    logToSheet_("Face recognition disabled — looking up staff directly by Telegram ID: " + senderId);
    const finalMatches = [];

    // Tra cứu trực tiếp thông tin nhân viên theo Telegram ID (senderId)
    const senderStaff = staffList.find(s => String(s.telegramId) === String(senderId) && s.name.toLowerCase() !== "tni" && s.name.toLowerCase() !== "vcm");
    if (senderStaff) {
      finalMatches.push({
        name: senderStaff.name,
        fullName: senderStaff.fullName,
        telegramId: senderId,
        department: senderStaff.department
      });
    } else {
      // Nếu chưa đăng ký Telegram ID trong danh sách staff, lấy tên Telegram hiển thị an toàn
      const BLOCKED_NAMES = ["tni", "vcm", "office", "branch"];
      const senderNameLow = senderName ? senderName.toLowerCase().trim() : "";
      const isSafe = senderNameLow &&
        !BLOCKED_NAMES.includes(senderNameLow) &&
        !/^tni\d+/i.test(senderNameLow);
      const safeName = isSafe ? senderName : "";
      finalMatches.push({
        name: safeName,
        fullName: safeName,
        telegramId: senderId,
        department: ""
      });
    }

    const attendanceSheet = ss.getSheetByName("List Attendance");
    if (!attendanceSheet) {
      sendTelegramMessage_(token, chatId, "❌ Lỗi: Không tìm thấy sheet 'List Attendance'");
      return ContentService.createTextOutput("List Attendance sheet not found");
    }

    let nextNum = 1;
    const lastRow = attendanceSheet.getLastRow();
    if (lastRow >= 2) {
      const currentTopNum = parseInt(attendanceSheet.getRange(2, 1).getValue(), 10);
      if (!isNaN(currentTopNum)) {
        nextNum = currentTopNum + 1;
      }
    }

    // extractedImageName: trích Site/Task name từ caption ảnh (thay thế luồng Gemini AI cũ đã bị xóa)
    let extractedImageName = "";
    if (msg.caption) {
      extractedImageName = String(msg.caption).trim();
    }

    let successCount = 0;
    let replyMsg = "✅ **Recorded #" + nextNum + "**";
    if (extractedImageName) {
      replyMsg += "\n📍 Site/Task: *" + extractedImageName + "*";
    }

    if (finalMatches.length > 0) {
      replyMsg += ":\n";
      for (let i = 0; i < finalMatches.length; i++) {
        const match = finalMatches[i];
        // Lọc final safety: không bao giờ ghi 'TNI', 'VCM', hoặc TNIxxxx vào cột tên
        const BLOCKED = ["tni", "vcm", "office", "branch"];
        const rawName = String(match.name || "").trim();
        const rawNameLow = rawName.toLowerCase();
        const finalShortName = (rawName && !BLOCKED.includes(rawNameLow) && !/^tni\d+/i.test(rawNameLow)) ? rawName : "";
        const rawFullName = String(match.fullName || "").trim();
        const rawFullLow = rawFullName.toLowerCase();
        const finalFullName = (rawFullName && !BLOCKED.includes(rawFullLow) && !/^tni\d+/i.test(rawFullLow)) ? rawFullName : "";
        const finalTgId = match.telegramId; // ID Telegram người gửi
        const finalDep = match.department;

        if (finalShortName && isAlreadyLoggedToday_(attendanceSheet, dateStr, timeStr, finalShortName, extractedImageName)) {
          replyMsg += `- ${finalShortName} (Already logged for this time slot)\n`;
          continue;
        }

        attendanceSheet.insertRowAfter(1);
        attendanceSheet.getRange(2, 1, 1, 7).setValues([[
          nextNum,          // Col A: DEF / STT
          dateStr,          // Col B: Date
          timeStr,          // Col C: Time report
          finalTgId,        // Col D: ID Telegram người gửi
          finalShortName,   // Col E: Name Trên Hình (Tên ngắn người được nhận diện - trống nếu chưa nhận)
          finalFullName,    // Col F: Full name (Họ tên người được nhận diện - trống nếu chưa nhận)
          driveFileUrl      // Col G: photo (Link ảnh Google Drive)
        ]]);
        
        replyMsg += finalShortName ? (`- ${finalShortName}` + (finalDep ? ` (${finalDep})\n` : `\n`)) : `- (Chưa nhận diện được tên)\n`;
        successCount++;
      }
    } else {
        // Nếu chưa nhận diện được tên nhân viên, vẫn ghi nhận lượt điểm danh với ảnh Drive, Col E & F để trống
        attendanceSheet.insertRowAfter(1);
        attendanceSheet.getRange(2, 1, 1, 7).setValues([[
          nextNum,          // Col A: DEF / STT
          dateStr,          // Col B: Date
          timeStr,          // Col C: Time report
          senderId,         // Col D: ID Telegram người gửi
          "",               // Col E: Trống nếu chưa nhận diện tên
          "",               // Col F: Trống nếu chưa nhận diện tên
          driveFileUrl      // Col G: photo (Link ảnh Google Drive)
        ]]);
        successCount++;
    }

    if (successCount > 0) {
      sendTelegramMessage_(token, chatId, replyMsg);
      // ✅ Tự động cập nhật bảng General sau khi nhận ảnh mới thành công
      try { buildGeneralTab(); } catch(eGeneral) { Logger.log("Lỗi buildGeneralTab: " + eGeneral.message); }
    } else {
      sendTelegramMessage_(token, chatId, "⚠️ Today's attendance for you/your group has already been recorded for this time slot.");
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
  let nameCol = 3;      // Mặc định Cột C (Name in Sheet / Short name)
  let fullNameCol = 6;  // Mặc định Cột F (Full name)
  let idCol = 1;        // Column A (Telegram ID)
  let photoCol = 15;    // Column O (Link Photo man power)
  let depCol = 11;      // Column K (Dep)
  let statusCol = 14;   // Column N (Status / Probation / Resign)

  for (let j = 0; j < headers.length; j++) {
    const header = String(headers[j]).trim().toLowerCase();
    if (header === "name in sheet" || header === "short name" || header === "name" || header === "tên") {
      nameCol = j + 1;
    } else if (header.indexOf("full name") !== -1 || header.indexOf("fullname") !== -1 || header.indexOf("họ tên") !== -1) {
      fullNameCol = j + 1;
    } else if (header.indexOf("telegram id") !== -1 || header === "telegram id ") {
      idCol = j + 1;
    } else if (header.indexOf("photo") !== -1 || header.indexOf("ảnh") !== -1 || header.indexOf("link photo") !== -1 || header.indexOf("man power") !== -1) {
      photoCol = j + 1;
    } else if (header.indexOf("dep") !== -1 || header.indexOf("phòng") !== -1 || header.indexOf("bộ phận") !== -1) {
      depCol = j + 1;
    } else if (header.indexOf("status") !== -1 || header.indexOf("probation") !== -1 || header.indexOf("trạng thái") !== -1) {
      statusCol = j + 1;
    }
  }

  // KHÓA AN TOÀN TUYỆT ĐỐI: Cột E chứa chữ "TNI" -> Nếu lỡ nhận diện nhầm Cột E thì ép quay về Cột C (Short Name)
  if (nameCol === 5) {
    nameCol = 3;
  }

  return { nameCol: nameCol, fullNameCol: fullNameCol, idCol: idCol, photoCol: photoCol, depCol: depCol, statusCol: statusCol };
}

/** Xác định khung giờ điểm danh (<8:30, 10:00-12:00, 13:00-14:00, 16:00-17:00) */
function getAttendanceSlot_(timeVal) {
  if (!timeVal) return "slot_other";
  let h = 0, m = 0;
  if (timeVal instanceof Date) {
    h = timeVal.getHours();
    m = timeVal.getMinutes();
  } else {
    const str = String(timeVal).trim();
    const mMatch = str.match(/(\d{1,2}):(\d{2})/);
    if (mMatch) {
      h = parseInt(mMatch[1], 10);
      m = parseInt(mMatch[2], 10);
    }
  }
  const totalMin = h * 60 + m;

  if (totalMin <= 8 * 60 + 30) return "slot_morning_1";                       // <= 08:30
  if (totalMin >= 10 * 60 && totalMin <= 12 * 60) return "slot_morning_2";   // 10:00 - 12:00
  if (totalMin >= 13 * 60 && totalMin <= 14 * 60) return "slot_afternoon_1"; // 13:00 - 14:00
  if (totalMin >= 16 * 60 && totalMin <= 17 * 60) return "slot_afternoon_2"; // 16:00 - 17:00
  
  return "slot_custom_" + h;
}

/** Kiểm tra xem nhân viên đã điểm danh trong cùng KHUNG GIỜ hôm nay chưa */
function isAlreadyLoggedToday_(sheet, dateStr, currentTimeStr, telegramId, siteCode) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  
  const currentSlot = getAttendanceSlot_(currentTimeStr);

  const values = sheet.getRange(2, 2, lastRow - 1, 4).getValues(); 
  for (let i = 0; i < values.length; i++) {
    const rowDate = values[i][0];
    const rowTime = values[i][1];
    const rowTgId = String(values[i][2] || "").trim();
    const rowSite = String(values[i][3] || "").trim();
    
    let formattedRowDate = "";
    if (rowDate instanceof Date) {
      formattedRowDate = Utilities.formatDate(rowDate, "Asia/Rangoon", "dd/MM/yyyy");
    } else {
      formattedRowDate = String(rowDate || "").trim();
    }
    
    if (formattedRowDate.split(" ")[0] === dateStr && rowTgId === telegramId) {
      const rowSlot = getAttendanceSlot_(rowTime);
      if (rowSlot === currentSlot) {
        if (siteCode && siteCode.trim() !== "") {
          if (rowSite.toLowerCase() === siteCode.trim().toLowerCase()) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
  }
  return false;
}


// ============================================================
// BẢNG BÁO CÁO CÔNG THỨC — TAB GENERAL (XỬ LÝ DỮ LIỆU ĐIỂM DANH)
// ============================================================
function buildGeneralTab() {
  const ss = SpreadsheetApp.openById("18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
  let genSheet = ss.getSheetByName("General");
  if (!genSheet) {
    genSheet = ss.insertSheet("General");
  }

  const staffSheet = ss.getSheetByName("Staff attendance");
  const listSheet  = ss.getSheetByName("List Attendance");
  if (!staffSheet || !listSheet) return;

  const cols = getStaffColumns_(staffSheet);
  const staffLastRow = staffSheet.getLastRow();
  if (staffLastRow < 2) return;

  const staffVals = staffSheet.getRange(2, 1, staffLastRow - 1, staffSheet.getLastColumn()).getValues();

  // Đọc dữ liệu từ List Attendance
  const listLastRow = listSheet.getLastRow();
  const listData = listLastRow >= 2 ? listSheet.getRange(2, 1, listLastRow - 1, 7).getValues() : [];

  // Xác định mốc ngày Today / Yesterday / Day Before
  const now = new Date();
  const todayStr  = Utilities.formatDate(now, "Asia/Rangoon", "dd/MM/yyyy");

  const d1 = new Date(now.getTime() - 24 * 3600 * 1000);
  const yestStr   = Utilities.formatDate(d1, "Asia/Rangoon", "dd/MM/yyyy");

  const d2 = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
  const day2Before = Utilities.formatDate(d2, "Asia/Rangoon", "dd/MM/yyyy");

  const d7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const currentMonth = Utilities.formatDate(now, "Asia/Rangoon", "MM/yyyy");

  // Gom nhóm dữ liệu theo Telegram ID
  const attendanceMap = {};

  for (let i = 0; i < listData.length; i++) {
    const row = listData[i];
    const rowDateRaw = row[1];
    const rowTime    = row[2];
    const tgId       = String(row[3] || "").trim();

    if (!tgId) continue;

    let dateStr = "";
    let dateObj = null;
    if (rowDateRaw instanceof Date) {
      dateObj = rowDateRaw;
      dateStr = Utilities.formatDate(rowDateRaw, "Asia/Rangoon", "dd/MM/yyyy");
    } else {
      dateStr = String(rowDateRaw || "").trim().split(" ")[0];
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }

    if (!attendanceMap[tgId]) {
      attendanceMap[tgId] = {
        todayCount: 0,
        yestCount: 0,
        day2BeforeCount: 0,
        count7D: 0,
        countMonth: 0,
        slotsToday: {
          slot_morning_1: 0,   // < 08:30
          slot_morning_2: 0,   // 10:00 - 12:00
          slot_afternoon_1: 0, // 13:00 - 14:00
          slot_afternoon_2: 0  // 16:00 - 17:00
        }
      };
    }

    const rec = attendanceMap[tgId];

    if (dateStr === todayStr) {
      rec.todayCount++;
      const slot = getAttendanceSlot_(rowTime);
      if (rec.slotsToday[slot] !== undefined) {
        rec.slotsToday[slot]++;
      }
    }
    if (dateStr === yestStr) rec.yestCount++;
    if (dateStr === day2Before) rec.day2BeforeCount++;

    if (dateObj && dateObj >= d7) rec.count7D++;
    if (dateStr.indexOf(currentMonth) !== -1) rec.countMonth++;
  }

  // Tạo tiêu đề cho tab General
  const headers = [
    "STT", "Họ & Tên Nhân Viên", "Bộ Phận / Team", "Telegram ID",
    "Hôm Nay (" + todayStr + ")", "Hôm Qua (" + yestStr + ")", "Hôm Kia (" + day2Before + ")",
    "Thống Kê 7 Ngày", "Thống Kê Tháng (" + currentMonth + ")",
    "Khung 1 (<08:30)", "Khung 2 (10-12h)", "Khung 3 (13-14h)", "Khung 4 (16-17h)", "Trạng Thái Đủ Khung"
  ];

  const tableData = [headers];

  for (let i = 0; i < staffVals.length; i++) {
    const row = staffVals[i];
    const shortName = String(row[cols.nameCol - 1] || "").trim();
    const fullName  = cols.fullNameCol ? String(row[cols.fullNameCol - 1] || "").trim() : shortName;
    const tgId      = String(row[cols.idCol - 1] || "").trim();
    const dep       = cols.depCol ? String(row[cols.depCol - 1] || "").trim() : "";

    const statusVal = cols.statusCol ? String(row[cols.statusCol - 1] || "").toLowerCase() : "";
    if (statusVal.indexOf("resign") !== -1 || statusVal.indexOf("nghỉ") !== -1 || statusVal.indexOf("nghi") !== -1 || statusVal.indexOf("quit") !== -1 || statusVal.indexOf("off") !== -1) {
      continue;
    }

    if (!shortName) continue;

    const stats = attendanceMap[tgId] || {
      todayCount: 0, yestCount: 0, day2BeforeCount: 0, count7D: 0, countMonth: 0,
      slotsToday: { slot_morning_1: 0, slot_morning_2: 0, slot_afternoon_1: 0, slot_afternoon_2: 0 }
    };

    const isTeamMember = /team\s*[1-5]/i.test(dep) || /t[1-5]/i.test(dep);

    const s1 = stats.slotsToday.slot_morning_1;
    const s2 = stats.slotsToday.slot_morning_2;
    const s3 = stats.slotsToday.slot_afternoon_1;
    const s4 = stats.slotsToday.slot_afternoon_2;

    let status = "";
    if (isTeamMember) {
      status = (s1 > 0 && s2 > 0 && s3 > 0 && s4 > 0) ? "✅ Đủ 4 khung" : "⚠️ Thiếu khung";
    } else {
      status = (s1 > 0 || s2 > 0) ? "✅ Đã báo sáng" : "❌ Chưa báo sáng";
    }

    tableData.push([
      i + 1,
      fullName || shortName,
      dep,
      tgId,
      stats.todayCount,
      stats.yestCount,
      stats.day2BeforeCount,
      stats.count7D,
      stats.countMonth,
      s1 > 0 ? "✅ " + s1 : "❌ 0",
      s2 > 0 ? "✅ " + s2 : "❌ 0",
      s3 > 0 ? "✅ " + s3 : "❌ 0",
      s4 > 0 ? "✅ " + s4 : "❌ 0",
      status
    ]);
  }

  genSheet.clearContents();
  if (tableData.length > 0) {
    genSheet.getRange(1, 1, tableData.length, tableData[0].length).setValues(tableData);
    genSheet.getRange(1, 1, 1, tableData[0].length).setFontWeight("bold").setBackground("#d9ead3");
  }
}


// ============================================================
// GỬI BÁO CÁO TELEGRAM 4 KHUNG GIỜ (+15 PHÚT SAU MỖI KHUNG GIỜ)
// 08:45 | 12:15 | 14:15 | 17:15 Myanmar Time
// ============================================================
function sendAttendanceSlotReport(slotKey) {
  const ss = SpreadsheetApp.openById("18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
  const staffSheet = ss.getSheetByName("Staff attendance");
  const listSheet  = ss.getSheetByName("List Attendance");
  if (!staffSheet || !listSheet) return;

  const cols = getStaffColumns_(staffSheet);
  const staffLastRow = staffSheet.getLastRow();
  if (staffLastRow < 2) return;

  const staffVals = staffSheet.getRange(2, 1, staffLastRow - 1, staffSheet.getLastColumn()).getValues();

  const listLastRow = listSheet.getLastRow();
  const listData = listLastRow >= 2 ? listSheet.getRange(2, 1, listLastRow - 1, 7).getValues() : [];

  const now = new Date();
  const todayStr  = Utilities.formatDate(now, "Asia/Rangoon", "dd/MM/yyyy");
  const dateShort = Utilities.formatDate(now, "Asia/Rangoon", "dd/MM/yy");

  const d1 = new Date(now.getTime() - 24 * 3600 * 1000);
  const yestStr = Utilities.formatDate(d1, "Asia/Rangoon", "dd/MM/yyyy");

  const d2 = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
  const day2Before = Utilities.formatDate(d2, "Asia/Rangoon", "dd/MM/yyyy");

  const d7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const currentMonth = Utilities.formatDate(now, "Asia/Rangoon", "MM/yyyy");

  // Tên tiêu đề khung giờ
  const slotTitleMap = {
    slot_morning_1:   "Khung 1 (Sáng < 08:30)",
    slot_morning_2:   "Khung 2 (Trưa 10:00 - 12:00)",
    slot_afternoon_1: "Khung 3 (Chiều 13:00 - 14:00)",
    slot_afternoon_2: "Khung 4 (Chiều 16:00 - 17:00)",
  };

  const currentSlotTitle = slotTitleMap[slotKey] || "Khung điểm danh";

  // Thống kê từng nhân viên
  const statsMap = {};

  for (let i = 0; i < listData.length; i++) {
    const row = listData[i];
    const rowDateRaw = row[1];
    const rowTime    = row[2];
    const tgId       = String(row[3] || "").trim();

    if (!tgId) continue;

    let dateStr = "";
    let dateObj = null;
    if (rowDateRaw instanceof Date) {
      dateObj = rowDateRaw;
      dateStr = Utilities.formatDate(rowDateRaw, "Asia/Rangoon", "dd/MM/yyyy");
    } else {
      dateStr = String(rowDateRaw || "").trim().split(" ")[0];
      const parts = dateStr.split("/");
      if (parts.length === 3) dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }

    if (!statsMap[tgId]) {
      statsMap[tgId] = {
        todayCount: 0, yestCount: 0, day2BeforeCount: 0, count7D: 0, countMonth: 0,
        hasCurrentSlot: false
      };
    }

    const rec = statsMap[tgId];
    if (dateStr === todayStr) {
      rec.todayCount++;
      const slot = getAttendanceSlot_(rowTime);
      if (slot === slotKey) rec.hasCurrentSlot = true;
    }
    if (dateStr === yestStr) rec.yestCount++;
    if (dateStr === day2Before) rec.day2BeforeCount++;
    if (dateObj && dateObj >= d7) rec.count7D++;
    if (dateStr.indexOf(currentMonth) !== -1) rec.countMonth++;
  }

  function getDepOrder(depStr) {
    const s = String(depStr || "").toLowerCase();
    if (s.indexOf("team 1") !== -1 || s.indexOf("t1") !== -1) return 1;
    if (s.indexOf("team 2") !== -1 || s.indexOf("t2") !== -1) return 2;
    if (s.indexOf("team 3") !== -1 || s.indexOf("t3") !== -1) return 3;
    if (s.indexOf("team 4") !== -1 || s.indexOf("t4") !== -1) return 4;
    if (s.indexOf("team 5") !== -1 || s.indexOf("t5") !== -1) return 5;
    return 0; // Các phòng ban / Office lên đầu
  }

  const staffProcessed = [];

  for (let i = 0; i < staffVals.length; i++) {
    const row = staffVals[i];
    const shortName = String(row[cols.nameCol - 1] || "").trim();
    const fullName  = cols.fullNameCol ? String(row[cols.fullNameCol - 1] || "").trim() : shortName;
    const tgId      = String(row[cols.idCol - 1] || "").trim();
    const dep       = cols.depCol ? String(row[cols.depCol - 1] || "").trim() : "";

    const statusVal = cols.statusCol ? String(row[cols.statusCol - 1] || "").toLowerCase() : "";
    if (statusVal.indexOf("resign") !== -1 || statusVal.indexOf("nghỉ") !== -1 || statusVal.indexOf("nghi") !== -1 || statusVal.indexOf("quit") !== -1 || statusVal.indexOf("off") !== -1) {
      continue;
    }

    if (!shortName) continue;

    const isTeamMember = /team\s*[1-5]/i.test(dep) || /t[1-5]/i.test(dep);

    // Ngoài Team chỉ cần khung 9:00 (Slot 1)
    if (!isTeamMember && slotKey !== "slot_morning_1") continue;

    const rec = statsMap[tgId] || { todayCount: 0, yestCount: 0, day2BeforeCount: 0, count7D: 0, countMonth: 0, hasCurrentSlot: false };

    // Format gọn: • Phyo Htet Aung (Team 1) 30/07/26: 1 / 0 / 1 , 7D: 1, 1M: 1
    const lineText = "• " + (fullName || shortName) + " (" + (dep || "Office") + ") " + dateShort + ": " + rec.todayCount + " / " + rec.yestCount + " / " + rec.day2BeforeCount + " , 7D: " + rec.count7D + ", 1M: " + rec.countMonth;

    staffProcessed.push({
      depOrder: getDepOrder(dep),
      depName: dep,
      name: fullName || shortName,
      lineText: lineText,
      hasSlot: rec.hasCurrentSlot
    });
  }

  // Sắp xếp: Phòng ban -> Team 1 -> Team 2 -> Team 3 -> Team 4 -> Team 5
  staffProcessed.sort(function(a, b) {
    if (a.depOrder !== b.depOrder) return a.depOrder - b.depOrder;
    return a.name.localeCompare(b.name);
  });

  const reportedList = [];
  const missingList  = [];

  staffProcessed.forEach(function(item) {
    if (item.hasSlot) {
      reportedList.push(item.lineText);
    } else {
      missingList.push(item.lineText);
    }
  });

  let msg = "📸 <b>BÁO CÁO HÌNH ẢNH ĐIỂM DANH — " + currentSlotTitle + "</b>\n";
  msg += "📅 Ngày: <b>" + todayStr + "</b>\n";
  msg += "─────────────────────────\n\n";

  msg += "✅ <b>ĐÃ BÁO CÁO (" + reportedList.length + "):</b>\n";
  if (reportedList.length > 0) {
    reportedList.forEach(function(item) { msg += item + "\n"; });
  } else {
    msg += "<i>Chưa có ai báo cáo</i>\n";
  }

  msg += "\n❌ <b>CHƯA BÁO CÁO (" + missingList.length + "):</b>\n";
  if (missingList.length > 0) {
    missingList.forEach(function(item) { msg += item + "\n"; });
  } else {
    msg += "<i>Tất cả đã báo cáo đầy đủ</i>\n";
  }

  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SEND_BOT_TOKEN") || "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw";
  const targetChatId = props.getProperty("ATTENDANCE_CHAT_ID") || "-1004215695747"; // Default Attendance Chat ID

  sendTelegramMessage_(token, targetChatId, msg);
}


// ============================================================
// HỆ THỐNG TRIGGER HẸN GIỜ CHO 4 KHUNG (+15 PHÚT SAU MỖI KHUNG)
// 08:45 | 12:15 | 14:15 | 17:15 Myanmar Time
// ============================================================
function triggerSlotReport0845() { sendAttendanceSlotReport("slot_morning_1");   }
function triggerSlotReport1215() { sendAttendanceSlotReport("slot_morning_2");   }
function triggerSlotReport1415() { sendAttendanceSlotReport("slot_afternoon_1"); }
function triggerSlotReport1715() { sendAttendanceSlotReport("slot_afternoon_2"); }

function setupAttendanceReportTriggers() {
  const handlerNames = ["triggerSlotReport0845", "triggerSlotReport1215", "triggerSlotReport1415", "triggerSlotReport1715"];
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (handlerNames.indexOf(triggers[i].getHandlerFunction()) !== -1) {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
  } catch(e) {
    Logger.log("⚠️ Delete existing triggers warning: " + e.message);
  }

  try {
    ScriptApp.newTrigger("triggerSlotReport0845").timeBased().atHour(8).nearMinute(45).everyDays(1).inTimezone("Asia/Rangoon").create();
    ScriptApp.newTrigger("triggerSlotReport1215").timeBased().atHour(12).nearMinute(15).everyDays(1).inTimezone("Asia/Rangoon").create();
    ScriptApp.newTrigger("triggerSlotReport1415").timeBased().atHour(14).nearMinute(15).everyDays(1).inTimezone("Asia/Rangoon").create();
    ScriptApp.newTrigger("triggerSlotReport1715").timeBased().atHour(17).nearMinute(15).everyDays(1).inTimezone("Asia/Rangoon").create();
    Logger.log("✅ Đã cài đặt thành công 4 trigger hẹn giờ báo cáo (08:45, 12:15, 14:15, 17:15).");
  } catch(e) {
    Logger.log("⚠️ Create triggers warning: " + e.message);
  }
}



function extractFileId_(url) {
  if (!url) return null;
  let match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  match = url.match(/id=([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return null;
}

function sendTelegramMessage_(token, chatId, text) {
  const url = "https://api.telegram.org/bot" + token + "/sendMessage";
  const payload = { chat_id: chatId, text: text, parse_mode: "HTML" };
  const resp = UrlFetchApp.fetch(url, {
    method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  return resp.getResponseCode() === 200;
}

function setupAttendanceWebhook() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SEND_BOT_TOKEN") || "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw";
  const webAppUrl = "https://tni-bot.vercel.app/api/attendance";
  props.setProperty("WEBAPP_URL", webAppUrl);
  
  const url = "https://api.telegram.org/bot" + token + "/setWebhook";
  const payload = { url: webAppUrl, allowed_updates: JSON.stringify(["message"]) };
  const resp = UrlFetchApp.fetch(url, { method: "post", payload: payload, muteHttpExceptions: true });
  Logger.log("✅ Webhook Attendance Bot set to Vercel Proxy: " + webAppUrl + " | Response: " + resp.getContentText());
}

/** Tìm hoặc lấy Folder ID của thư mục "2.11 Attendance photo" ở bất kỳ vị trí nào trên Google Drive */
function getAttendanceFolderId_() {
  const props = PropertiesService.getScriptProperties();

  // 1. Tìm kiếm thư mục có tên "2.11 Attendance photo" trên toàn bộ Google Drive (dù chuyển đi vị trí nào)
  try {
    const folders = DriveApp.getFoldersByName("2.11 Attendance photo");
    if (folders.hasNext()) {
      const targetFolder = folders.next();
      const folderId = targetFolder.getId();
      props.setProperty("DRIVE_FOLDER_ID", folderId);
      Logger.log("📁 Đã tự động kết nối thư mục '2.11 Attendance photo' mới với ID: " + folderId);
      return folderId;
    }
  } catch(e) {
    Logger.log("⚠️ Lỗi tìm thư mục 2.11 Attendance photo: " + e.message);
  }

  // 2. Dự phòng dùng ID đã lưu trong ScriptProperties
  let savedId = props.getProperty("DRIVE_FOLDER_ID");
  if (savedId && savedId !== "1qT8RxGKgVyUo-EG7PwVvH2MSE5bxPUJb") {
    try {
      if (DriveApp.getFolderById(savedId)) return savedId;
    } catch(e) {}
  }

  return "1qT8RxGKgVyUo-EG7PwVvH2MSE5bxPUJb";
}

function initAttendanceScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("SEND_BOT_TOKEN", "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw");
  props.setProperty("ATTENDANCE_SS_ID", "18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
  const fId = getAttendanceFolderId_();
  Logger.log("✅ Khởi tạo Script Properties với Folder '2.11 Attendance photo' ID: " + fId);
}

function logToSheet_(message) {
  try {
    const ss = SpreadsheetApp.openById("18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
    let logSheet = ss.getSheetByName("Logs");
    if (!logSheet) {
      logSheet = ss.insertSheet("Logs");
      logSheet.appendRow(["Timestamp", "Message"]);
    }
    logSheet.appendRow([new Date(), message]);
  } catch (e) {}
}

// ── ATTENDANCE & LEAVE TEMPLATE & RECORDING FUNCTIONS ──

function isAttendanceReportText_(text) {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  if (/(?:team\s*0?[1-4]|t[1-4])(?:\s*s[1-9])?.*attendan[ce]+.*report/i.test(t)) return true;
  if (/^[^:\n]+:\s*take\s*leave/i.test(t)) return true;
  return false;
}

function handleAttendanceTemplateQuery_(ssId, queryText) {
  try {
    const ss = SpreadsheetApp.openById(ssId);
    const tplSheet = ss.getSheetByName("Template Attendance");
    if (!tplSheet || tplSheet.getLastRow() < 1) return null;

    const q = queryText.toLowerCase().trim();

    // 0. Menu / Help Commands
    if (q === "/menu" || q === "menu" || q === "/help" || q === "help" || q === "/huongdan") {
      return "📋 *TNI ATTENDANCE BOT — TEMPLATE MENU*\n" +
             "──────────────────────────────\n" +
             "🔹 `/t1` — Mẫu Team 1 Main (Dawei/Myeik)\n" +
             "🔹 `/t1_s1` — Mẫu Team 1 Sub-team 1\n" +
             "🔹 `/t2` — Mẫu Team 2 Main\n" +
             "🔹 `/t2_s1` — Mẫu Team 2 Sub-team 1\n" +
             "🔹 `/t3` — Mẫu Team 3 Main\n" +
             "🔹 `/t3_s1` — Mẫu Team 3 Sub-team 1\n" +
             "🔹 `/t4` — Mẫu Team 4 Main\n" +
             "🔹 `/attendance` — Mẫu toàn bộ 4 Team\n" +
             "🔹 `/header` — Dòng tiêu đề điểm danh nhanh\n" +
             "🔹 `/leave` — Mẫu xin nghỉ phép cả ngày (Take leave)\n" +
             "🔹 `/leave_half` — Mẫu xin nghỉ phép nửa ngày (Half day)\n" +
             "──────────────────────────────\n" +
             "📸 *Điểm danh tự động:* Gửi ảnh chụp mặt kèm vị trí vào nhóm!";
    }

    const isLeave = q.indexOf("leave") !== -1 || q.indexOf("nghi") !== -1 || q.indexOf("phep") !== -1;
    const isHeaderOnly = q.indexOf("header") !== -1 || q.indexOf("title") !== -1 || q.indexOf("short") !== -1;

    // 1. Leave templates (Cols A & B)
    if (isLeave) {
      const isHalf = q.indexOf("half") !== -1 || q.indexOf("nuangay") !== -1 || q.indexOf("1/2") !== -1;
      const isFull = q.indexOf("full") !== -1 || q.indexOf("cangay") !== -1;
      const isAll = q.indexOf("all") !== -1 || q.indexOf("both") !== -1;
      
      const strHalf = "Full Name: take leave half day\nReason:";
      const strFull = "Full Name: Take leave\nReason:";

      if (isAll) return strFull + "\n\n" + strHalf;
      if (isHalf) return strHalf;
      return strFull;
    }

    // 2. Team & Sub-team Attendance templates
    // Mapping exact columns in 'Template Attendance' tab:
    // Team 1: Col F (6) [T1 Main], Col G (7) [T1 S1]
    // Team 2: Col I (9) [T2 Main], Col J (10) [T2 S1]
    // Team 3: Col K (11) [T3 Main], Col L (12) [T3 S1]
    // Team 4: Col M (13) [T4 Main]
    const subTeamColMap = {
      "t1_main": [6],
      "t1_s1": [7],
      "t1_all": [6, 7],
      "t2_main": [9],
      "t2_s1": [10],
      "t2_all": [9, 10],
      "t3_main": [11],
      "t3_s1": [12],
      "t3_all": [11, 12],
      "t4": [13]
    };

    let targetCols = null;
    const isS1 = q.indexOf("s1") !== -1 || q.indexOf("sub") !== -1 || q.indexOf("nhom1") !== -1;
    const isAll = q.indexOf("all") !== -1 || q.indexOf("both") !== -1 || q.indexOf("template_team") !== -1;

    if (/team\s*0?1|\bt1\b|_team1\b|team_1\b|template_t1\b/i.test(q)) {
      if (isS1) targetCols = subTeamColMap["t1_s1"];
      else if (isAll) targetCols = subTeamColMap["t1_all"];
      else targetCols = subTeamColMap["t1_main"];
    } else if (/team\s*0?2|\bt2\b|_team2\b|team_2\b|template_t2\b/i.test(q)) {
      if (isS1) targetCols = subTeamColMap["t2_s1"];
      else if (isAll) targetCols = subTeamColMap["t2_all"];
      else targetCols = subTeamColMap["t2_main"];
    } else if (/team\s*0?3|\bt3\b|_team3\b|team_3\b|template_t3\b/i.test(q)) {
      if (isS1) targetCols = subTeamColMap["t3_s1"];
      else if (isAll) targetCols = subTeamColMap["t3_all"];
      else targetCols = subTeamColMap["t3_main"];
    } else if (/team\s*0?4|\bt4\b|_team4\b|team_4\b|template_t4\b/i.test(q)) {
      targetCols = subTeamColMap["t4"];
    }

    const maxRow = Math.min(tplSheet.getLastRow(), 35);

    function getColumnLines(colIdx) {
      if (!colIdx) return [];
      const vals = tplSheet.getRange(1, colIdx, maxRow, 1).getValues();
      const lines = [];
      for (let r = 0; r < vals.length; r++) {
        let v = String(vals[r][0] || "").trim();
        if (v) {
          if (v.toLowerCase().indexOf("total:") === 0) continue;
          lines.push(v);
          if (isHeaderOnly && lines.length >= 1) break;
        }
      }
      return lines;
    }

    if (targetCols) {
      const blocks = [];
      for (let c = 0; c < targetCols.length; c++) {
        const lines = getColumnLines(targetCols[c]);
        if (lines.length > 0) blocks.push(lines.join("\n"));
      }
      return blocks.join("\n\n");
    } else {
      const allCols = [6, 7, 9, 10, 11, 12, 13];
      const allBlocks = [];
      for (let c = 0; c < allCols.length; c++) {
        const lines = getColumnLines(allCols[c]);
        if (lines.length > 0) allBlocks.push(lines.join("\n"));
      }
      return isHeaderOnly ? allBlocks.join("\n") : allBlocks.join("\n\n");
    }
  } catch (err) {
    Logger.log("handleAttendanceTemplateQuery_ error: " + err);
    return null;
  }
}

function processAttendanceReportText_(ssId, text, defaultTgId) {
  try {
    const ss = SpreadsheetApp.openById(ssId);
    const sumSheet = ss.getSheetByName("Sum report morning attendance");
    if (!sumSheet) return 0;

    // 1. Build lookup map from 'Staff attendance' (Col A: Telegram ID, Col C: Name Telegram, Col F: Full Name, Col H: VMY Code)
    const staffMap = {};
    const staffSheet = ss.getSheetByName("Staff attendance");
    if (staffSheet && staffSheet.getLastRow() > 1) {
      const staffValues = staffSheet.getRange(2, 1, staffSheet.getLastRow() - 1, 8).getValues();
      for (let i = 0; i < staffValues.length; i++) {
        const tgId = String(staffValues[i][0] || "").trim();
        const tgName = String(staffValues[i][2] || "").trim().toLowerCase();
        const fullName = String(staffValues[i][5] || "").trim().toLowerCase();
        const vmyCode = String(staffValues[i][7] || "").trim().toLowerCase();
        if (tgId) {
          if (fullName) staffMap[fullName] = tgId;
          if (tgName) staffMap[tgName] = tgId;
          if (vmyCode) staffMap[vmyCode] = tgId;
        }
      }
    }

    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return 0;

    const items = [];
    const mTeam = lines[0].match(/(?:team\s*0?([1-4])|t([1-4]))(?:\s*s[1-9])?.*attendan[ce]+.*report[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);

    if (mTeam) {
      const dateStr = mTeam[2];
      let currentRec = null;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const mP = line.match(/^(?:\d+[\.\)]\s*)?([^:]+):\s*(.*)$/);
        if (mP && !/^reason/i.test(mP[1]) && !/^total/i.test(mP[1])) {
          if (currentRec) items.push(currentRec);
          const pName = mP[1].trim();
          const pStat = mP[2].trim().toLowerCase();
          const isWork = pStat.indexOf("work") !== -1 && pStat.indexOf("leave") === -1;
          const isHalf = pStat.indexOf("half") !== -1;
          const isLeave = pStat.indexOf("leave") !== -1 && !isHalf;
          currentRec = {
            date: dateStr,
            name: pName,
            work: isWork ? "Work" : "",
            takeLeave: isLeave ? "Take leave" : "",
            halfDay: isHalf ? "Half day" : "",
            reason: "",
            telegramId: ""
          };
        } else if (/^reason:/i.test(line) && currentRec) {
          currentRec.reason = line.substring(line.indexOf(":") + 1).trim();
        }
      }
      if (currentRec) items.push(currentRec);
    } else {
      const mIndiv = lines[0].match(/^([^:]+):\s*take\s*leave(?:\s*(half\s*day|full\s*day))?/i);
      if (mIndiv) {
        const pName = mIndiv[1].trim();
        const isHalf = (mIndiv[2] && mIndiv[2].toLowerCase().indexOf("half") !== -1) || lines[0].toLowerCase().indexOf("half") !== -1;
        const isLeave = !isHalf;
        let reason = "";
        for (let i = 1; i < lines.length; i++) {
          if (/^reason:/i.test(lines[i])) {
            reason = lines[i].substring(lines[i].indexOf(":") + 1).trim();
          }
        }
        const nowMM = new Date();
        const dateStr = Utilities.formatDate(nowMM, "Asia/Rangoon", "dd/MM/yyyy");
        items.push({
          date: dateStr,
          name: pName,
          work: "",
          takeLeave: isLeave ? "Take leave" : "",
          halfDay: isHalf ? "Half day" : "",
          reason: reason,
          telegramId: String(defaultTgId || "")
        });
      }
    }

    if (items.length === 0) return 0;

    // 2. Base REF sequence
    let nextRefSeq = 1;
    if (sumSheet.getLastRow() > 1) {
      const topRef = String(sumSheet.getRange(2, 1).getValue() || "").trim();
      const mRef = topRef.match(/ATT-(\d+)/i);
      if (mRef) {
        nextRefSeq = parseInt(mRef[1], 10) + 1;
      } else {
        nextRefSeq = sumSheet.getLastRow();
      }
    }

    // 3. Prepare rows (Strict Top Insertion Rule: insert at Row 2)
    const rowsToInsert = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const name = it.name;
      const normName = name.toLowerCase();
      let tgId = it.telegramId;
      if (!tgId && staffMap[normName]) {
        tgId = staffMap[normName];
      }
      const refStr = "ATT-" + String(nextRefSeq + i).padStart(4, "0");
      rowsToInsert.push([
        refStr,
        it.date,
        name,
        it.work,
        it.takeLeave,
        it.halfDay,
        it.reason,
        tgId
      ]);
    }

    sumSheet.insertRowsBefore(2, rowsToInsert.length);
    sumSheet.getRange(2, 1, rowsToInsert.length, 8).setValues(rowsToInsert);
    return rowsToInsert.length;
  } catch (err) {
    Logger.log("processAttendanceReportText_ error: " + err);
    return 0;
  }
}

function setupAttendanceBotCommands() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SEND_BOT_TOKEN") || "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw";
  const commands = [
    { command: "template_team1", description: "Team 1 Attendance template" },
    { command: "template_team2", description: "Team 2 Attendance template" },
    { command: "template_team3", description: "Team 3 Attendance template" },
    { command: "template_team4", description: "Team 4 Attendance template" },
    { command: "leave",          description: "Full-day leave template (Take leave)" },
    { command: "leave_half",     description: "Half-day leave template (Half day)" },
    { command: "header",         description: "Header-only attendance template" }
  ];
  
  const urlDefault = "https://api.telegram.org/bot" + token + "/setMyCommands";
  UrlFetchApp.fetch(urlDefault, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ commands: commands })
  });

  const urlGroups = "https://api.telegram.org/bot" + token + "/setMyCommands";
  UrlFetchApp.fetch(urlGroups, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ commands: commands, scope: { type: "all_group_chats" } })
  });
  
  Logger.log("✅ Attendance bot commands registered successfully.");
}


