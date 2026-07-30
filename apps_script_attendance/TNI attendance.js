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

    let fileId = null;
    if (msg.photo && msg.photo.length > 0) {
      fileId = msg.photo[msg.photo.length - 1].file_id;
    } else if (msg.document && msg.document.mime_type && msg.document.mime_type.indexOf("image/") === 0) {
      fileId = msg.document.file_id;
    }

    if (!fileId) {
      return ContentService.createTextOutput("Message does not contain photo");
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

      const statusVal = cols.statusCol ? String(row[cols.statusCol - 1] || "").toLowerCase() : "";
      if (statusVal.indexOf("resign") !== -1 || statusVal.indexOf("nghỉ") !== -1 || statusVal.indexOf("nghi") !== -1 || statusVal.indexOf("quit") !== -1 || statusVal.indexOf("off") !== -1) {
        continue;
      }

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

    if (!extractedImageName && msg.caption) {
      extractedImageName = String(msg.caption).trim();
    }

    const finalMatches = [];

    // 1) Nếu AI nhận diện được khuôn mặt từ hình đối chiếu ở Cột O:
    if (geminiMatches && geminiMatches.length > 0) {
      for (let i = 0; i < geminiMatches.length; i++) {
        const gMatch = geminiMatches[i];
        const dbStaff = staffList.find(s => 
          (s.name && s.name.toLowerCase() === String(gMatch.name).toLowerCase()) || 
          (s.fullName && s.fullName.toLowerCase() === String(gMatch.name).toLowerCase()) ||
          (s.telegramId && s.telegramId === String(gMatch.telegramId))
        );
        if (dbStaff) {
          const isAlreadyAdded = finalMatches.some(m => m.name.toLowerCase() === dbStaff.name.toLowerCase());
          if (!isAlreadyAdded) {
            finalMatches.push({
              name: dbStaff.name,
              fullName: dbStaff.fullName,
              telegramId: senderId, // Col D luôn ghi ID Telegram người gửi
              department: dbStaff.department
            });
          }
        } else {
          finalMatches.push({
            name: gMatch.name,
            fullName: gMatch.name,
            telegramId: senderId,
            department: ""
          });
        }
      }
    }

    // 2) Dự phòng nếu AI chưa nhận diện được ai trên hình: Lấy thông tin người gửi
    if (finalMatches.length === 0) {
      const senderStaff = staffList.find(s => s.telegramId === senderId);
      if (senderStaff) {
        finalMatches.push({
          name: senderStaff.name,
          fullName: senderStaff.fullName,
          telegramId: senderId,
          department: senderStaff.department
        });
      } else {
        finalMatches.push({
          name: senderName,
          fullName: senderName,
          telegramId: senderId,
          department: ""
        });
      }
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

    let successCount = 0;
    let replyMsg = "✅ **Attendance Recorded #" + nextNum + "**:\n";
    if (extractedImageName) {
      replyMsg += `📍 Site/Task: *${extractedImageName}*\n`;
    }

    for (let i = 0; i < finalMatches.length; i++) {
      const match = finalMatches[i];
      const finalShortName = match.name;
      const finalFullName = match.fullName;
      const finalTgId = match.telegramId; // ID Telegram người gửi
      const finalDep = match.department;

      if (isAlreadyLoggedToday_(attendanceSheet, dateStr, timeStr, finalShortName, extractedImageName)) {
        replyMsg += `- ${finalShortName} (Already logged for this time slot)\n`;
        continue;
      }

      attendanceSheet.insertRowAfter(1);
      attendanceSheet.getRange(2, 1, 1, 7).setValues([[
        nextNum,          // Col A: DEF / STT
        dateStr,          // Col B: Date
        timeStr,          // Col C: Time report
        finalTgId,        // Col D: ID Telegram người gửi
        finalShortName,   // Col E: Name Trên Hình (Tên ngắn người được nhận diện)
        finalFullName,    // Col F: Full name (Họ tên người được nhận diện)
        driveFileUrl      // Col G: photo (Link ảnh Google Drive)
      ]]);
      
      replyMsg += `- ${finalShortName} (${finalDep})\n`;
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
  let nameCol = 5;      // Column E (Name / Short name)
  let fullNameCol = 6;  // Column F (Full name)
  let idCol = 1;        // Column A (Telegram ID)
  let photoCol = 15;    // Column O (Link Photo man power)
  let depCol = 11;      // Column K (Dep)
  let statusCol = 14;   // Column N (Status / Probation / Resign)

  for (let j = 0; j < headers.length; j++) {
    const header = String(headers[j]).trim().toLowerCase();
    if (header === "name" || header === "tên") {
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
    const lineText = `• ${fullName || shortName} (${dep || "Office"}) ${dateShort}: ${rec.todayCount} / ${rec.yestCount} / ${rec.day2BeforeCount} , 7D: ${rec.count7D}, 1M: ${rec.countMonth}`;

    staffProcessed.push({
      depOrder: getDepOrder(dep),
      depName: dep,
      name: fullName || shortName,
      lineText: lineText,
      hasSlot: rec.hasCurrentSlot
    });
  }

  // Sắp xếp: Phòng ban -> Team 1 -> Team 2 -> Team 3 -> Team 4 -> Team 5
  staffProcessed.sort((a, b) => {
    if (a.depOrder !== b.depOrder) return a.depOrder - b.depOrder;
    return a.name.localeCompare(b.name);
  });

  const reportedList = [];
  const missingList  = [];

  staffProcessed.forEach(item => {
    if (item.hasSlot) {
      reportedList.push(item.lineText);
    } else {
      missingList.push(item.lineText);
    }
  });

  let msg = `📸 <b>BÁO CÁO HÌNH ẢNH ĐIỂM DANH — ${currentSlotTitle}</b>\n`;
  msg += `📅 Ngày: <b>${todayStr}</b>\n`;
  msg += `─────────────────────────\n\n`;

  msg += `✅ <b>ĐÃ BÁO CÁO (${reportedList.length}):</b>\n`;
  if (reportedList.length > 0) {
    reportedList.forEach(item => msg += `${item}\n`);
  } else {
    msg += `<i>Chưa có ai báo cáo</i>\n`;
  }

  msg += `\n❌ <b>CHƯA BÁO CÁO (${missingList.length}):</b>\n`;
  if (missingList.length > 0) {
    missingList.forEach(item => msg += `${item}\n`);
  } else {
    msg += `<i>Tất cả đã báo cáo đầy đủ</i>\n`;
  }

  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SEND_BOT_TOKEN") || "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw";
  const targetChatId = props.getProperty("ATTENDANCE_CHAT_ID") || "-1004215695747"; // Default Attendance Chat ID

  sendTelegramMessage_(token, targetChatId, msg);
}


// ============================================================
// HỆ THỐNG TRIGGER HẸN GIỜ CHO 4 KHUNG (+25 PHÚT SAU MỖI KHUNG GIỜ)
// 08:55 | 12:25 | 14:25 | 17:25 Myanmar Time (+10m offset)
// ============================================================
function triggerSlotReport0855() { sendAttendanceSlotReport("slot_morning_1");   }
function triggerSlotReport1225() { sendAttendanceSlotReport("slot_morning_2");   }
function triggerSlotReport1425() { sendAttendanceSlotReport("slot_afternoon_1"); }
function triggerSlotReport1725() { sendAttendanceSlotReport("slot_afternoon_2"); }

function setupAttendanceReportTriggers() {
  const handlerNames = ["triggerSlotReport0855", "triggerSlotReport1225", "triggerSlotReport1425", "triggerSlotReport1725", "triggerSlotReport0845", "triggerSlotReport1215", "triggerSlotReport1415", "triggerSlotReport1715"];
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
    ScriptApp.newTrigger("triggerSlotReport0855").timeBased().atHour(8).nearMinute(55).everyDays(1).inTimezone("Asia/Rangoon").create();
    ScriptApp.newTrigger("triggerSlotReport1225").timeBased().atHour(12).nearMinute(25).everyDays(1).inTimezone("Asia/Rangoon").create();
    ScriptApp.newTrigger("triggerSlotReport1425").timeBased().atHour(14).nearMinute(25).everyDays(1).inTimezone("Asia/Rangoon").create();
    ScriptApp.newTrigger("triggerSlotReport1725").timeBased().atHour(17).nearMinute(25).everyDays(1).inTimezone("Asia/Rangoon").create();
    Logger.log("✅ Đã cài đặt thành công 4 trigger hẹn giờ báo cáo (+10m: 08:55, 12:25, 14:25, 17:25).");
  } catch(e) {
    Logger.log("⚠️ Create triggers warning: " + e.message);
  }
}

/** Nhận dạng khuôn mặt & đọc mã Site trên hình bằng Gemini AI */
function identifyFaces_(attendanceBlob, staffList, apiKey) {
  // Lấy danh sách các nhân viên có ảnh mẫu mốc đối chiếu (lên đến 30 người)
  const candidates = staffList.filter(s => s.photoUrl && s.photoUrl.trim() !== "").slice(0, 30);
  if (candidates.length === 0) {
    Logger.log("⚠️ Không tìm thấy ảnh mốc đối chiếu nào trong sheet Staff attendance.");
    return { matches: [], imageName: "" };
  }

  const parts = [];
  parts.push({
    inlineData: {
      mimeType: "image/jpeg",
      data: Utilities.base64Encode(attendanceBlob.getBytes())
    }
  });

  let promptText = "You are an expert AI face recognition and OCR system for staff attendance.\n";
  promptText += "Image 1 (first image) is the target attendance photo uploaded by a staff member.\n";
  promptText += "Below are reference face photos of registered staff members:\n";

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
        promptText += `- Image ${imgIndex}: Reference photo for staff '${cand.name}' (Full name: '${cand.fullName}', Telegram ID: '${cand.telegramId}').\n`;
        imgIndex++;
      }
    } catch (e) {
      Logger.log("⚠️ Không thể đọc ảnh mốc của " + cand.name + ": " + e.message);
    }
  }

  promptText += "\nTASKS TO PERFORM:\n";
  promptText += "1. FACE MATCHING: Compare the face(s) in Image 1 against all reference photos (Image 2 onwards). Identify which staff member(s) are present in Image 1.\n";
  promptText += "2. WATERMARK / TEXT OCR: Read the watermark text on Image 1 (especially at the bottom right, top left, or bottom left corners like 'TNI0047', 'TNI0105', 'Branch Office'). Extract:\n";
  promptText += "   - Any Site Code / Station ID starting with 'TNI' followed by digits (e.g., 'TNI0047', 'TNI0105', 'TNI0295').\n";
  promptText += "   - Or Location / Office name if no TNI code is present (e.g. 'Branch Office').\n";

  promptText += "\nRETURN FORMAT:\n";
  promptText += "Return a strict raw JSON object without markdown formatting:\n";
  promptText += "{\n";
  promptText += "  \"matches\": [{\"name\": \"Staff Name\", \"telegramId\": \"123456\"}],\n";
  promptText += "  \"imageName\": \"Extracted Site Code or Location (e.g. TNI0047 or Branch Office)\"\n";
  promptText += "}\n";

  parts.push({ text: promptText });

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
  const payload = { contents: [{ parts: parts }], generationConfig: { responseMimeType: "application/json" } };

  try {
    const resp = UrlFetchApp.fetch(url, {
      method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true
    });

    if (resp.getResponseCode() !== 200) {
      Logger.log("❌ Gemini API Call Error: " + resp.getContentText());
      return { matches: [], imageName: "" };
    }

    const resData = JSON.parse(resp.getContentText());
    const textResult = resData.candidates[0].content.parts[0].text.trim();
    let cleanJson = textResult.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    Logger.log("❌ Lỗi xử lý Gemini AI: " + e.message);
    return { matches: [], imageName: "" };
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
  let webAppUrl = props.getProperty("WEBAPP_URL") || "";
  if (!webAppUrl) {
    try { webAppUrl = ScriptApp.getService().getUrl() || ""; } catch(e) {}
  }
  if (webAppUrl && webAppUrl.indexOf("/dev") !== -1) {
    webAppUrl = webAppUrl.replace("/dev", "/exec");
  }
  if (!webAppUrl) return;
  
  const url = "https://api.telegram.org/bot" + token + "/setWebhook";
  const payload = { url: webAppUrl, allowed_updates: JSON.stringify(["message"]) };
  UrlFetchApp.fetch(url, { method: "post", payload: payload, muteHttpExceptions: true });
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
