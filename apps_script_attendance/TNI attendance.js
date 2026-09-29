// Bot Token: 8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw
// Spreadsheet ID: 18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54
// Drive Folder ID: 1qT8RxGKgVyUo-EG7PwVvH2MSE5bxPUJb

function doGet(e) {
  if (!e || !e.parameter) {
    return ContentService.createTextOutput("No parameter received");
  }
  const action = e.parameter.action;
  // Ping siêu tốc cho Keepalive và Ghế Giám Sát Auditor (<50ms) per Rule PM-28
  if (action === "ping") {
    return ContentService.createTextOutput("PONG");
  }
  // Xóa các dòng fake do bấm lệnh /take_leave hoặc /half_leave thử nghiệm
  if (action === "delete_fake_leave") {
    const ss = SpreadsheetApp.openById("18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
    const sumSheet = ss.getSheetByName("Sum report morning attendance");
    if (!sumSheet) return ContentService.createTextOutput("Sheet not found");
    let deleted = [];
    const lastRow = sumSheet.getLastRow();
    for (let r = Math.min(lastRow, 20); r >= 2; r--) {
      const refVal = String(sumSheet.getRange(r, 1).getValue() || "").trim();
      const staffVal = String(sumSheet.getRange(r, 3).getValue() || "").trim();
      const tgIdVal = String(sumSheet.getRange(r, 8).getValue() || "").trim();
      if ((refVal === "ATT-0036" || refVal === "ATT-0035") && (staffVal.toLowerCase() === "tni" || tgIdVal === "6859790680")) {
        sumSheet.deleteRow(r);
        deleted.push(refVal + " (Row " + r + ")");
      }
    }
    try { buildSumWorkTab(); } catch(e) {}
    return ContentService.createTextOutput("Deleted " + deleted.length + " fake rows: " + JSON.stringify(deleted));
  }
  // Cập nhật tab CheckJoint và gửi báo cáo Group 10
  if (action === "update_checkjoint" || action === "check_joint" || action === "check_membership") {
    const cid = e.parameter.chat_id || "";
    const resText = sendGroup10MembershipSummary(cid);
    return ContentService.createTextOutput(resText || "CheckJoint updated successfully");
  }
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
  if (action === "build_sum_work") {
    buildSumWorkTab();
    return ContentService.createTextOutput("Sum work tab updated successfully");
  }
  if (action === "send_control_summary") {
    const ok = sendMonthlyAttendanceSummaryToControl();
    return ContentService.createTextOutput(ok ? "Control summary sent successfully" : "Failed to send control summary");
  }
  if (action === "setup_morning_trigger") {
    setupMorningAttendanceSummaryTrigger();
    return ContentService.createTextOutput("Morning trigger set for 09:00 MMT");
  }
  if (action === "setup_commands") {
    setupAttendanceBotCommands();
    return ContentService.createTextOutput("Bot commands updated");
  }
  // Kích hoạt trigger 08:45 MMT cho sendDailyAttendanceTemplates
  if (action === "setup_templates_trigger") {
    setupDailyTemplatesTrigger();
    return ContentService.createTextOutput("Daily templates trigger set for 08:45 MMT");
  }
  // Xóa sạch các template hiện tại trong group 10: ?action=delete_templates_now
  if (action === "delete_templates_now") {
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty("SEND_BOT_TOKEN") || "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw";
    var DAILY_ATT_CHAT = props.getProperty("DAILY_ATT_CHAT_ID") || "-5465634644";
    var keys = ["office", "t1_main", "t1_s1", "t2_main", "t2_s1", "t3_main", "t3_s1", "t4", "summary"];
    var deleted = [];
    for (var k = 0; k < keys.length; k++) {
      var propKey = keys[k] === "summary" ? "daily_tpl_summary_mid" : ("daily_tpl_" + keys[k] + "_mid");
      var mid = props.getProperty(propKey);
      if (mid) {
        deleteTgMessage_(token, DAILY_ATT_CHAT, mid);
        props.deleteProperty(propKey);
        deleted.push(mid);
      }
    }
    return ContentService.createTextOutput("Deleted " + deleted.length + " template messages from Group 10: " + JSON.stringify(deleted));
  }
  // Kiểm tra danh sách trigger đang chạy trên GAS: ?action=list_triggers
  if (action === "list_triggers") {
    var triggers = ScriptApp.getProjectTriggers();
    var tList = [];
    for (var ti = 0; ti < triggers.length; ti++) {
      tList.push({
        handler: triggers[ti].getHandlerFunction(),
        type: triggers[ti].getEventType().toString()
      });
    }
    return ContentService.createTextOutput(JSON.stringify(tList, null, 2));
  }
  // Xóa sạch trigger báo cáo hình ảnh 4 khung giờ: ?action=delete_slot_triggers
  if (action === "delete_slot_triggers" || action === "cleanup_slot_triggers") {
    const deletedCount = deleteAttendanceReportTriggers();
    return ContentService.createTextOutput("✅ Successfully deleted " + deletedCount + " slot report triggers.");
  }
  // Cập nhật chat ID nhóm 10 từ xa: ?action=set_att_chat_id&chat_id=-100xxxxxxxxx
  if (action === "set_att_chat_id") {
    const cid = e.parameter.chat_id || "";
    if (cid) {
      PropertiesService.getScriptProperties().setProperty("DAILY_ATT_CHAT_ID", cid);
      return ContentService.createTextOutput("DAILY_ATT_CHAT_ID set to: " + cid);
    }
    return ContentService.createTextOutput("Missing chat_id parameter");
  }
  // Gửi thử template ngay (test): ?action=send_templates_now
  if (action === "send_templates_now") {
    sendDailyAttendanceTemplates();
    return ContentService.createTextOutput("Templates sent to group now");
  }
  // Gửi thử tin tổng hợp thành viên group 10: ?action=send_membership_summary
  if (action === "send_membership_summary" || action === "check_group10") {
    const cid = e.parameter.chat_id || "";
    const resText = sendGroup10MembershipSummary(cid);
    return ContentService.createTextOutput(resText || "Membership summary sent");
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
  if (action === "debug_staff") {
    const ss = SpreadsheetApp.openById("18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
    const staffSheet = ss.getSheetByName("Staff attendance");
    const cols = getStaffColumns_(staffSheet);
    const lastRow = staffSheet.getLastRow();
    const rows = staffSheet.getRange(2, 1, Math.min(lastRow - 1, 5), staffSheet.getLastColumn()).getValues();
    return ContentService.createTextOutput(JSON.stringify({
      cols: cols,
      totalRows: lastRow - 1,
      sampleRows: rows
    }, null, 2));
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
      // LƯU Ý: Lệnh /take_leave và /half_leave CHỈ trả về template để nhân viên copy điền tên và lý do,
      // TUYỆT ĐỐI KHÔNG tự động chèn dòng nghỉ phép vào Sheet khi bấm lệnh!
      const cleanCmd = textL.split("@")[0].trim();
      const isExplicitTemplateCommand = (
        cleanCmd === "/menu" || cleanCmd === "menu" ||
        cleanCmd === "/help" || cleanCmd === "help" ||
        cleanCmd === "/attendance" || cleanCmd === "attendance" ||
        cleanCmd === "/att" || cleanCmd === "att" ||
        cleanCmd === "/leave" || cleanCmd === "leave" ||
        cleanCmd === "/take_leave" || cleanCmd === "take_leave" || cleanCmd === "/takeleave" || cleanCmd === "take leave" ||
        cleanCmd === "/half_leave" || cleanCmd === "half_leave" || cleanCmd === "/halfleave" || cleanCmd === "half leave" ||
        cleanCmd === "/leave_half" || cleanCmd === "leave half" || cleanCmd === "/leavehalf" ||
        cleanCmd === "/diemdanh" || cleanCmd === "diemdanh" ||
        cleanCmd === "/header" || cleanCmd === "header" ||
        cleanCmd === "/team" ||
        cleanCmd === "/office" || cleanCmd === "office" || cleanCmd === "/vp" || cleanCmd === "vp" || cleanCmd === "/vanphong" || cleanCmd === "vanphong" ||
        cleanCmd === "/t1" || cleanCmd === "t1" || cleanCmd === "/t1_main" || cleanCmd === "/t1_s1" || cleanCmd === "/t1s1" ||
        cleanCmd === "/t2" || cleanCmd === "t2" || cleanCmd === "/t2_main" || cleanCmd === "/t2_s1" || cleanCmd === "/t2s1" ||
        cleanCmd === "/t3" || cleanCmd === "t3" || cleanCmd === "/t3_main" || cleanCmd === "/t3_s1" || cleanCmd === "/t3s1" ||
        cleanCmd === "/t4" || cleanCmd === "t4" || cleanCmd === "/t4_main" ||
        cleanCmd === "/template_office" || cleanCmd === "/template_team1" || cleanCmd === "/template_team2" || cleanCmd === "/template_team3" || cleanCmd === "/template_team4" ||
        cleanCmd === "/template_t1" || cleanCmd === "/template_t1_s1" || cleanCmd === "/template_t2" || cleanCmd === "/template_t2_s1" ||
        cleanCmd === "/template_t3" || cleanCmd === "/template_t3_s1" || cleanCmd === "/template_t4" ||
        cleanCmd === "/template_header" || cleanCmd === "/template_leave" || cleanCmd === "/template_leave_half" ||
        cleanCmd.startsWith("template ") ||
        cleanCmd.startsWith("/attendance ") || cleanCmd.startsWith("attendance template") ||
        cleanCmd.startsWith("/leave ") || cleanCmd.startsWith("leave template") ||
        cleanCmd.startsWith("/take_leave ") || cleanCmd.startsWith("take leave template") ||
        cleanCmd.startsWith("/half_leave ") || cleanCmd.startsWith("half leave template") ||
        cleanCmd.startsWith("/diemdanh ") || cleanCmd.startsWith("diemdanh template")
      ) && cleanCmd.split(/\s+/).length <= 4;

      // ── ETA Site Down per Team ──────────────────────────────────────────────
      var etaTeamFilter = null;
      if (cleanCmd === "/eta_t1" || cleanCmd === "eta_t1" || cleanCmd === "/eta t1") etaTeamFilter = "T1";
      else if (cleanCmd === "/eta_t1_s1" || cleanCmd === "eta_t1_s1" || cleanCmd === "/eta_t1s1" || cleanCmd === "/eta t1 s1") etaTeamFilter = "T1 S1";
      else if (cleanCmd === "/eta_t2" || cleanCmd === "eta_t2" || cleanCmd === "/eta t2") etaTeamFilter = "T2";
      else if (cleanCmd === "/eta_t2_s1" || cleanCmd === "eta_t2_s1" || cleanCmd === "/eta_t2s1" || cleanCmd === "/eta t2 s1") etaTeamFilter = "T2 S1";
      else if (cleanCmd === "/eta_t3" || cleanCmd === "eta_t3" || cleanCmd === "/eta t3") etaTeamFilter = "T3";
      else if (cleanCmd === "/eta_t3_s1" || cleanCmd === "eta_t3_s1" || cleanCmd === "/eta_t3s1" || cleanCmd === "/eta t3 s1") etaTeamFilter = "T3 S1";
      else if (cleanCmd === "/eta_t4" || cleanCmd === "eta_t4" || cleanCmd === "/eta t4") etaTeamFilter = "T4";
      else if (cleanCmd === "/eta" || cleanCmd === "eta" || cleanCmd === "/eta_all") etaTeamFilter = "ALL";

      if (etaTeamFilter) {
        const etaText = getEtaSiteDownByTeam_(etaTeamFilter);
        if (etaText) {
          sendTelegramMessage_(token, chatId, etaText);
          return ContentService.createTextOutput("ETA sent for " + etaTeamFilter);
        }
      }

      if (cleanCmd === "/sum_work" || cleanCmd === "sum_work" || cleanCmd === "/baocao_thang" || cleanCmd === "/monthly_report") {
        const sumText = getMonthlyAttendanceSummaryText();
        if (sumText) {
          sendTelegramMessage_(token, chatId, sumText);
          return ContentService.createTextOutput("Monthly summary sent");
        }
      }

      if (cleanCmd === "/check_members" || cleanCmd === "/group10" || cleanCmd === "/membership" || cleanCmd === "/check_group" || cleanCmd === "/check_join" || cleanCmd === "/checkjoin" || cleanCmd === "/check_joint") {
        sendGroup10MembershipSummary(chatId);
        return ContentService.createTextOutput("Membership check sent");
      }

      if (isExplicitTemplateCommand) {
        const tplReply = handleAttendanceTemplateQuery_(ssId, cleanCmd);
        if (tplReply) {
          sendTelegramMessage_(token, chatId, tplReply);
          return ContentService.createTextOutput("Template sent");
        }
      }

      // 2. Thu thập báo cáo điểm danh của Team Leader / Xin nghỉ phép cá nhân
      // CHỈ THU THẬP TIN CỦA NGƯỜI (không thu thập tin bot tự reply)
      const isBotSender = telegramUser && telegramUser.is_bot === true;
      if (!isBotSender && isAttendanceReportText_(rawText)) {
        const count = processAttendanceReportText_(ssId, rawText, senderId);
        if (count > 0) {
          const nowMM = new Date();
          const timeStr = Utilities.formatDate(nowMM, "Asia/Rangoon", "HH:mm");
          sendTelegramMessage_(token, chatId, "✅ Attendance saved (" + timeStr + ") — Recorded " + count + " staff to Sheet.");
          try { buildSumWorkTab(); } catch(eSum) { Logger.log("Lỗi buildSumWorkTab: " + eSum.message); }
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
      sendTelegramMessage_(token, chatId, "❌ Error: Staff attendance sheet not found.");
      return ContentService.createTextOutput("Staff attendance sheet not found");
    }

    const staffLastRow = staffSheet.getLastRow();
    if (staffLastRow < 2) {
      logToSheet_("Error: Staff attendance sheet is empty");
      sendTelegramMessage_(token, chatId, "❌ Error: Staff attendance list is empty.");
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
      const fullName = cols.fullNameCol ? String(row[cols.fullNameCol - 1] || "").trim() : "";
      // Ưu tiên Họ & Tên thật ở Cột F (hoặc Cột C nếu có)
      const effectiveName = fullName || shortName;
      const tgId = String(row[cols.idCol - 1] || "").trim();
      const photoUrl = String(row[cols.photoCol - 1] || "").trim();
      const depName = cols.depCol ? String(row[cols.depCol - 1] || "").trim() : "";

      const statusVal = cols.statusCol ? String(row[cols.statusCol - 1] || "").toLowerCase() : "";
      if (statusVal.indexOf("resign") !== -1 || statusVal.indexOf("nghỉ") !== -1 || statusVal.indexOf("nghi") !== -1 || statusVal.indexOf("quit") !== -1 || statusVal.indexOf("off") !== -1) {
        continue;
      }

      if (effectiveName && effectiveName.toLowerCase() !== "tni" && effectiveName.toLowerCase() !== "vcm") {
        staffList.push({
          name: effectiveName,
          fullName: fullName || effectiveName,
          telegramId: tgId,
          photoUrl: photoUrl,
          department: depName,
          rowNum: i + 2
        });
      }
    }
    logToSheet_("Read " + staffList.length + " staff members from database.");

    logToSheet_("Looking up staff directly by Telegram ID: " + senderId);
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
      sendTelegramMessage_(token, chatId, "❌ Error: List Attendance sheet not found.");
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

        if (finalShortName && isAlreadyLoggedToday_(attendanceSheet, dateStr, timeStr, finalTgId, finalShortName, extractedImageName)) {
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
        
        replyMsg += finalShortName ? (`- ${finalShortName}` + (finalDep ? ` (${finalDep})\n` : `\n`)) : `- (Name not identified)\n`;
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
      // ✅ Tự động cập nhật bảng General & Sum work sau khi nhận ảnh mới thành công
      try { buildGeneralTab(); } catch(eGeneral) { Logger.log("Lỗi buildGeneralTab: " + eGeneral.message); }
      try { buildSumWorkTab(); } catch(eSum) { Logger.log("Lỗi buildSumWorkTab: " + eSum.message); }
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
function isAlreadyLoggedToday_(sheet, dateStr, currentTimeStr, telegramId, staffName, siteCode) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  
  const currentSlot = getAttendanceSlot_(currentTimeStr);

  const values = sheet.getRange(2, 2, Math.min(lastRow - 1, 100), 5).getValues(); 
  for (let i = 0; i < values.length; i++) {
    const rowDate = values[i][0];
    const rowTime = values[i][1];
    const rowTgId = String(values[i][2] || "").trim();
    const rowName = String(values[i][3] || values[i][4] || "").trim().toLowerCase();
    
    let formattedRowDate = "";
    if (rowDate instanceof Date) {
      formattedRowDate = Utilities.formatDate(rowDate, "Asia/Rangoon", "dd/MM/yyyy");
    } else {
      formattedRowDate = String(rowDate || "").trim();
    }
    
    const isSameDate = formattedRowDate.split(" ")[0] === dateStr;
    const isSamePerson = (telegramId && rowTgId && rowTgId === String(telegramId)) ||
                         (staffName && rowName && rowName === staffName.toLowerCase());

    if (isSameDate && isSamePerson) {
      const rowSlot = getAttendanceSlot_(rowTime);
      if (rowSlot === currentSlot) {
        return true;
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

    if (!shortName || shortName.toLowerCase().indexOf("nyi nyi") !== -1 || fullName.toLowerCase().indexOf("nyi nyi") !== -1) {
      continue;
    }

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
// BÁO CÁO HÌNH ẢNH ĐIỂM DANH 4 KHUNG GIỜ — ĐÃ XÓA SẠCH VĨNH VIỄN THEO YÊU CẦU NGƯỜI DÙNG
// ============================================================
function sendAttendanceSlotReport(slotKey) {
  Logger.log("🛑 BÁO CÁO HÌNH ẢNH ĐIỂM DANH (sendAttendanceSlotReport) đã bị xóa vĩnh viễn theo yêu cầu.");
  deleteAttendanceReportTriggers();
  return;
}

function triggerSlotReport0845() { deleteAttendanceReportTriggers(); return; }
function triggerSlotReport1215() { deleteAttendanceReportTriggers(); return; }
function triggerSlotReport1415() { deleteAttendanceReportTriggers(); return; }
function triggerSlotReport1715() { deleteAttendanceReportTriggers(); return; }

function setupAttendanceReportTriggers() {
  return deleteAttendanceReportTriggers();
}

/**
 * Xóa sạch toàn bộ 4 triggers hẹn giờ báo cáo hình ảnh điểm danh trên Google Apps Script project
 */
function deleteAttendanceReportTriggers() {
  const handlerNames = [
    "triggerSlotReport0845",
    "triggerSlotReport1215",
    "triggerSlotReport1415",
    "triggerSlotReport1715",
    "sendAttendanceSlotReport"
  ];
  let deletedCount = 0;
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      const fn = triggers[i].getHandlerFunction();
      if (handlerNames.indexOf(fn) !== -1) {
        ScriptApp.deleteTrigger(triggers[i]);
        deletedCount++;
      }
    }
    Logger.log("✅ Đã xóa sạch " + deletedCount + " triggers báo cáo hình ảnh điểm danh 4 khung giờ.");
  } catch(e) {
    Logger.log("⚠️ Lỗi xóa triggers: " + e.message);
  }
  return deletedCount;
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
  deleteAttendanceReportTriggers();
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
  if (/(?:team\s*0?[1-4]|t[1-4]|office|van\s*phong)(?:\s*s[1-9])?.*attendan[ce]+.*report/i.test(t)) return true;
  if (/^[^:\n]+:\s*take\s*leave/i.test(t)) return true;
  return false;
}

/**
 * Tự động dò tìm cột của từng Team trong tab Template Attendance theo Header dòng 1 (Dynamic Column Detection)
 * Không hardcode chỉ số cột để chống lệch khi người dùng chèn/xóa/dịch chuyển cột trên Sheet.
 */
function getAttendanceTemplateColumns_(tplSheet) {
  const maxCol = tplSheet.getLastColumn();
  const headers = tplSheet.getRange(1, 1, 1, maxCol).getValues()[0];
  const map = {
    office: [],
    t1_main: [],
    t1_s1: [],
    t2_main: [],
    t2_s1: [],
    t3_main: [],
    t3_s1: [],
    t4: []
  };

  for (let c = 0; c < headers.length; c++) {
    const colIdx = c + 1;
    const h = String(headers[c] || "").trim().toUpperCase();
    if (!h) continue;
    if (h.indexOf("REPORT") === -1 && h.indexOf("ATTENDAN") === -1) continue;

    if (h.indexOf("OFFICE") !== -1 || h.indexOf("VAN PHONG") !== -1) {
      map.office.push(colIdx);
    } else if (/T1\s*S1|TEAM\s*0?1\s*S1/i.test(h)) {
      map.t1_s1.push(colIdx);
    } else if (/T1\b|TEAM\s*0?1/i.test(h)) {
      map.t1_main.push(colIdx);
    } else if (/T2\s*S1|TEAM\s*0?2\s*S1/i.test(h)) {
      map.t2_s1.push(colIdx);
    } else if (/T2\b|TEAM\s*0?2/i.test(h)) {
      map.t2_main.push(colIdx);
    } else if (/T3\s*S1|TEAM\s*0?3\s*S1/i.test(h)) {
      map.t3_s1.push(colIdx);
    } else if (/T3\b|TEAM\s*0?3/i.test(h)) {
      map.t3_main.push(colIdx);
    } else if (/T4\b|TEAM\s*0?4/i.test(h)) {
      map.t4.push(colIdx);
    }
  }

  // Fallback an toàn nếu chưa quét được
  if (map.office.length === 0) map.office = [5];
  if (map.t1_main.length === 0) map.t1_main = [6];
  if (map.t1_s1.length === 0) map.t1_s1 = [7];
  if (map.t2_main.length === 0) map.t2_main = [10];
  if (map.t2_s1.length === 0) map.t2_s1 = [11];
  if (map.t3_main.length === 0) map.t3_main = [12];
  if (map.t3_s1.length === 0) map.t3_s1 = [13];
  if (map.t4.length === 0) map.t4 = [14];

  map.t1_all = map.t1_main.concat(map.t1_s1);
  map.t2_all = map.t2_main.concat(map.t2_s1);
  map.t3_all = map.t3_main.concat(map.t3_s1);

  return map;
}

function handleAttendanceTemplateQuery_(ssId, queryText) {
  try {
    const ss = SpreadsheetApp.openById(ssId);
    const tplSheet = ss.getSheetByName("Template Attendance");
    if (!tplSheet || tplSheet.getLastRow() < 1) return null;

    const q = queryText.toLowerCase().trim();

    // 0. Menu / Help Commands — 100% English & prefixed with /template_
    if (q === "/menu" || q === "menu" || q === "/help" || q === "help" || q === "/huongdan") {
      return "📋 *TNI ATTENDANCE BOT — TEMPLATE MENU*\n" +
             "──────────────────────────────\n" +
             "🔹 `/template_office` — Office attendance report template\n" +
             "🔹 `/template_t1` — Team 1 Main attendance report template\n" +
             "🔹 `/template_t1_s1` — Team 1 S1 attendance report template\n" +
             "🔹 `/template_t2` — Team 2 Main attendance report template\n" +
             "🔹 `/template_t2_s1` — Team 2 S1 attendance report template\n" +
             "🔹 `/template_t3` — Team 3 Main attendance report template\n" +
             "🔹 `/template_t3_s1` — Team 3 S1 attendance report template\n" +
             "🔹 `/template_t4` — Team 4 Main attendance report template\n" +
             "🔹 `/template_header` — Quick attendance header template\n" +
             "🔹 `/take_leave` — Take leave full day template\n" +
             "🔹 `/half_leave` — Take leave half day template\n" +
             "──────────────────────────────\n" +
             "📸 *Automatic Attendance:* Send selfie photo with location to group!";
    }

    const isLeave = q.indexOf("leave") !== -1 || q.indexOf("nghi") !== -1 || q.indexOf("phep") !== -1;
    const isHeaderOnly = q.indexOf("header") !== -1 || q.indexOf("title") !== -1 || q.indexOf("short") !== -1;

    // 1. Leave templates (Cols A & B)
    if (isLeave) {
      const isHalf = q.indexOf("half") !== -1 || q.indexOf("nuangay") !== -1 || q.indexOf("1/2") !== -1;
      const isFull = q.indexOf("full") !== -1 || q.indexOf("cangay") !== -1 || q.indexOf("take_leave") !== -1 || q.indexOf("takeleave") !== -1;
      const isAll = (q.indexOf("all") !== -1 || q.indexOf("both") !== -1 || q === "/leave" || q === "leave") && !isHalf && !isFull;
      
      const tplHalf = "📋 *TAKE LEAVE HALF DAY TEMPLATE:*\n" +
                      "──────────────────────────────\n" +
                      "`Full Name: take leave half day\nReason: `\n" +
                      "──────────────────────────────\n" +
                      "💡 *Instruction:* Tap text in box to copy, replace *Full Name* with your name, specify reason, and send to group.";

      const tplFull = "📋 *TAKE LEAVE FULL DAY TEMPLATE:*\n" +
                      "──────────────────────────────\n" +
                      "`Full Name: Take leave\nReason: `\n" +
                      "──────────────────────────────\n" +
                      "💡 *Instruction:* Tap text in box to copy, replace *Full Name* with your name, specify reason, and send to group.";

      if (isAll) {
        return "📋 *TAKE LEAVE TEMPLATES:*\n" +
               "──────────────────────────────\n" +
               "*1. Full Day Leave:*\n" +
               "`Full Name: Take leave\nReason: `\n\n" +
               "*2. Half Day Leave:*\n" +
               "`Full Name: take leave half day\nReason: `\n" +
               "──────────────────────────────\n" +
               "💡 *Instruction:* Tap text in box to copy, replace *Full Name* with your name, specify reason, and send to group.";
      }
      if (isHalf) return tplHalf;
      return tplFull;
    }

    // 2. Team & Sub-team Attendance templates via Dynamic Column Detection
    const subTeamColMap = getAttendanceTemplateColumns_(tplSheet);

    let targetCols = null;
    const isS1 = q.indexOf("s1") !== -1 || q.indexOf("sub") !== -1 || q.indexOf("nhom1") !== -1;
    const isAll = q.indexOf("all") !== -1 || q.indexOf("both") !== -1;

    if (/office|van\s*phong|\bvp\b|template_office|template\s*office/i.test(q)) {
      targetCols = subTeamColMap.office;
    } else if (/t1_s1|t1s1|template_t1_s1|template\s*t1\s*s1/i.test(q)) {
      targetCols = subTeamColMap.t1_s1;
    } else if (/t2_s1|t2s1|template_t2_s1|template\s*t2\s*s1/i.test(q)) {
      targetCols = subTeamColMap.t2_s1;
    } else if (/t3_s1|t3s1|template_t3_s1|template\s*t3\s*s1/i.test(q)) {
      targetCols = subTeamColMap.t3_s1;
    } else if (/team\s*0?1|\bt1\b|_team1\b|team_1\b|template_t1\b|template\s*t1\b|template_team1\b/i.test(q)) {
      if (isS1) targetCols = subTeamColMap.t1_s1;
      else if (isAll) targetCols = subTeamColMap.t1_all;
      else targetCols = subTeamColMap.t1_main;
    } else if (/team\s*0?2|\bt2\b|_team2\b|team_2\b|template_t2\b|template\s*t2\b|template_team2\b/i.test(q)) {
      if (isS1) targetCols = subTeamColMap.t2_s1;
      else if (isAll) targetCols = subTeamColMap.t2_all;
      else targetCols = subTeamColMap.t2_main;
    } else if (/team\s*0?3|\bt3\b|_team3\b|team_3\b|template_t3\b|template\s*t3\b|template_team3\b/i.test(q)) {
      if (isS1) targetCols = subTeamColMap.t3_s1;
      else if (isAll) targetCols = subTeamColMap.t3_all;
      else targetCols = subTeamColMap.t3_main;
    } else if (/team\s*0?4|\bt4\b|_team4\b|team_4\b|template_t4\b|template\s*t4\b|template_team4\b/i.test(q)) {
      targetCols = subTeamColMap.t4;
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

    if (targetCols && targetCols.length > 0) {
      const blocks = [];
      for (let c = 0; c < targetCols.length; c++) {
        const lines = getColumnLines(targetCols[c]);
        if (lines.length > 0) blocks.push(lines.join("\n"));
      }
      return blocks.join("\n\n");
    } else if (isHeaderOnly) {
      const allCols = [].concat(
        subTeamColMap.office,
        subTeamColMap.t1_main, subTeamColMap.t1_s1,
        subTeamColMap.t2_main, subTeamColMap.t2_s1,
        subTeamColMap.t3_main, subTeamColMap.t3_s1,
        subTeamColMap.t4
      );
      const allHeaders = [];
      for (let c = 0; c < allCols.length; c++) {
        const lines = getColumnLines(allCols[c]);
        if (lines.length > 0) allHeaders.push(lines[0]);
      }
      return allHeaders.join("\n");
    } else {
      // Default: Return Menu to prompt user to choose specific team
      return "📋 *TNI ATTENDANCE BOT — PLEASE CHOOSE YOUR TEAM:*\n" +
             "──────────────────────────────\n" +
             "🔹 `/template_office` — Office attendance report template\n" +
             "🔹 `/template_t1` — Team 1 Main attendance report template\n" +
             "🔹 `/template_t1_s1` — Team 1 S1 attendance report template\n" +
             "🔹 `/template_t2` — Team 2 Main attendance report template\n" +
             "🔹 `/template_t2_s1` — Team 2 S1 attendance report template\n" +
             "🔹 `/template_t3` — Team 3 Main attendance report template\n" +
             "🔹 `/template_t3_s1` — Team 3 S1 attendance report template\n" +
             "🔹 `/template_t4` — Team 4 Main attendance report template\n" +
             "🔹 `/template_header` — Quick attendance header template\n" +
             "🔹 `/template_leave` — Take leave full day template\n" +
             "🔹 `/template_leave_half` — Take leave half day template";
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
    const mTeam = lines[0].match(/(?:team\s*0?([1-4])|t([1-4])|office|van\s*phong)(?:\s*s[1-9])?.*attendan[ce]+.*report[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);

    if (mTeam) {
      const dateStr = mTeam[3]; // FIX: mTeam[3] = date (group 3). mTeam[1]=team# via "team\s*0?([1-4])", mTeam[2]=team# via "t([1-4])" — date is ALWAYS group 3.
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
  const url = "https://api.telegram.org/bot" + token + "/setMyCommands";
  const delUrl = "https://api.telegram.org/bot" + token + "/deleteMyCommands";

  // ── Chỉ giữ 2 lệnh: take_leave và half_leave (các template khác bot tự gửi lúc 8:45) ──
  var leaveCmds = [
    { command: "take_leave",  description: "Get template: Take leave full day" },
    { command: "half_leave",  description: "Get template: Take leave half day" }
  ];

  // ── Xóa TOÀN BỘ lệnh cũ trên tất cả scope ──
  try { UrlFetchApp.fetch(delUrl, { method: "post" }); } catch (e) {}
  try { UrlFetchApp.fetch(delUrl, { method: "post", contentType: "application/json", payload: JSON.stringify({ scope: { type: "all_group_chats" } }) }); } catch (e) {}
  try { UrlFetchApp.fetch(delUrl, { method: "post", contentType: "application/json", payload: JSON.stringify({ scope: { type: "all_private_chats" } }) }); } catch (e) {}
  try { UrlFetchApp.fetch(delUrl, { method: "post", contentType: "application/json", payload: JSON.stringify({ scope: { type: "all_chat_administrators" } }) }); } catch (e) {}

  // Xóa trên 4 nhóm Team riêng
  var allGroupIds = [
    "-1004215695747", "-1004480845549", "-1004369170658", "-1004293741999"
  ];
  for (var g = 0; g < allGroupIds.length; g++) {
    try {
      UrlFetchApp.fetch(delUrl, { method: "post", contentType: "application/json",
        payload: JSON.stringify({ scope: { type: "chat", chat_id: allGroupIds[g] } }) });
    } catch (e) {}
  }

  // Đặt 2 lệnh mới trên tất cả scope
  UrlFetchApp.fetch(url, { method: "post", contentType: "application/json",
    payload: JSON.stringify({ commands: leaveCmds }) });
  UrlFetchApp.fetch(url, { method: "post", contentType: "application/json",
    payload: JSON.stringify({ commands: leaveCmds, scope: { type: "all_group_chats" } }) });
  UrlFetchApp.fetch(url, { method: "post", contentType: "application/json",
    payload: JSON.stringify({ commands: leaveCmds, scope: { type: "all_private_chats" } }) });
  UrlFetchApp.fetch(url, { method: "post", contentType: "application/json",
    payload: JSON.stringify({ commands: leaveCmds, scope: { type: "all_chat_administrators" } }) });

  // ETA commands chỉ trên 4 nhóm Team
  var etaCmds = [
    { command: "eta",       description: "ETA Site Down - All Teams" },
    { command: "eta_t1",    description: "ETA Site Down - Team 1" },
    { command: "eta_t1_s1", description: "ETA Site Down - Team 1 S1" },
    { command: "eta_t2",    description: "ETA Site Down - Team 2" },
    { command: "eta_t2_s1", description: "ETA Site Down - Team 2 S1" },
    { command: "eta_t3",    description: "ETA Site Down - Team 3" },
    { command: "eta_t3_s1", description: "ETA Site Down - Team 3 S1" },
    { command: "eta_t4",    description: "ETA Site Down - Team 4" }
  ];
  var teamGroupCmds = leaveCmds.concat(etaCmds);
  for (var tg = 0; tg < allGroupIds.length; tg++) {
    try {
      UrlFetchApp.fetch(url, { method: "post", contentType: "application/json",
        payload: JSON.stringify({ commands: teamGroupCmds, scope: { type: "chat", chat_id: allGroupIds[tg] } }) });
    } catch (e) {
      Logger.log("setMyCommands for " + allGroupIds[tg] + " error: " + e.message);
    }
  }

  Logger.log("✅ Bot commands updated: only take_leave + half_leave remain. All /template_* commands removed.");
}

/**
 * Gửi live status điểm danh vào nhóm "10. TNI DAILY ADDTENDANCE" lúc 6:15 MMT
 * Đọc từ: List Attendance (photo trước 8:40 = Working) + Sum report (leave rõ ràng)
 * Thứ tự: Office → T1 Main → T1 S1 → T2 Main → T2 S1 → T3 Main → T3 S1 → T4
 * Tự xóa tin cũ trước khi gửi mới.
 */
function sendDailyAttendanceTemplates() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SEND_BOT_TOKEN") || "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw";
  const ssId  = props.getProperty("ATTENDANCE_SS_ID") || "18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54";
  const DAILY_ATT_CHAT = props.getProperty("DAILY_ATT_CHAT_ID") || "-5465634644";

  const tz = "Asia/Rangoon";
  const ss  = SpreadsheetApp.openById(ssId);
  const now = new Date();
  const todayDisp = Utilities.formatDate(now, tz, "dd/MM/yyyy (EEE)");
  const todayStr  = Utilities.formatDate(now, tz, "dd/MM/yyyy");
  const CUTOFF_H  = 8, CUTOFF_M = 40; // Before 08:40 MMT = Working

  // ── Helper: normalize date cell → "dd/MM/yyyy" ──
  function parseCellDate(raw) {
    if (raw instanceof Date) return Utilities.formatDate(raw, tz, "dd/MM/yyyy");
    var s = String(raw || "").trim().split(" ")[0];
    var p = s.split(/[\/\-\.]/);
    if (p.length < 3) return "";
    var yr = parseInt(p[2]); if (yr < 100) yr += 2000;
    return ("0"+p[0]).slice(-2) + "/" + ("0"+p[1]).slice(-2) + "/" + yr;
  }

  // ── Helper: parse time cell → {h, m, str} or null ──
  function parseCellTime(raw) {
    if (raw instanceof Date) {
      var h = raw.getHours(), m = raw.getMinutes();
      return { h: h, m: m, str: ("0"+h).slice(-2)+":"+("0"+m).slice(-2) };
    }
    var tp = String(raw || "").match(/(\d{1,2}):(\d{2})/);
    if (!tp) return null;
    var h = parseInt(tp[1]), m = parseInt(tp[2]);
    return { h: h, m: m, str: ("0"+h).slice(-2)+":"+("0"+m).slice(-2) };
  }

  // ── 1. statusMap from List Attendance: photo sent before 8:40 = work ──
  // key = name.toLowerCase(), value = { status: 'work'|'late'|'leave'|'half', time }
  var statusMap = {};
  var listSheet = ss.getSheetByName("List Attendance");
  if (listSheet && listSheet.getLastRow() >= 2) {
    var lVals = listSheet.getRange(2, 1, listSheet.getLastRow() - 1, 7).getValues();
    for (var i = 0; i < lVals.length; i++) {
      var lr = lVals[i];
      if (parseCellDate(lr[1]) !== todayStr) continue;      // col B = date
      var photoUrl = String(lr[6] || "").trim();             // col G = photo URL
      if (!photoUrl) continue;
      var fname = String(lr[5] || lr[4] || "").trim();       // col F = FullName, col E = TgName
      if (!fname) continue;
      var key = fname.toLowerCase();
      var tm  = parseCellTime(lr[2]);                        // col C = time
      if (!tm) continue;
      var beforeCutoff = (tm.h < CUTOFF_H) || (tm.h === CUTOFF_H && tm.m <= CUTOFF_M);
      if (!statusMap[key] || (beforeCutoff && statusMap[key].status === 'late')) {
        statusMap[key] = { status: beforeCutoff ? 'work' : 'late', time: tm.str };
      }
    }
  }

  // ── 2. Override with explicit leave from Sum report morning attendance ──
  var sumSheet = ss.getSheetByName("Sum report morning attendance");
  if (sumSheet && sumSheet.getLastRow() >= 2) {
    var sVals = sumSheet.getRange(2, 1, sumSheet.getLastRow() - 1, 6).getValues();
    for (var si = 0; si < sVals.length; si++) {
      var sr = sVals[si];
      if (parseCellDate(sr[1]) !== todayStr) continue;
      var sName = String(sr[2] || "").trim().toLowerCase();
      if (!sName) continue;
      var isHalf  = String(sr[5] || "").toLowerCase().indexOf("half") !== -1;
      var isLeave = String(sr[4] || "").toLowerCase() === "take leave";
      if (isHalf)       statusMap[sName] = { status: 'half',  time: '' };
      else if (isLeave) statusMap[sName] = { status: 'leave', time: '' };
    }
  }

  // ── 3. Template groups (roster from Template Attendance keeps S1/Main split) ──
  var tplSheet = ss.getSheetByName("Template Attendance");
  if (!tplSheet) { Logger.log("Template Attendance sheet not found"); return; }
  var colMap = getAttendanceTemplateColumns_(tplSheet);
  var maxRow = Math.min(tplSheet.getLastRow(), 35);

  var TEMPLATE_ORDER = [
    { key: "office",  label: "🏢 OFFICE / BACKOFFICE", cols: colMap.office  },
    { key: "t1_main", label: "🟠 TEAM 1 MAIN",          cols: colMap.t1_main },
    { key: "t1_s1",   label: "🟠 TEAM 1 S1",            cols: colMap.t1_s1  },
    { key: "t2_main", label: "🔵 TEAM 2 MAIN",          cols: colMap.t2_main },
    { key: "t2_s1",   label: "🔵 TEAM 2 S1",            cols: colMap.t2_s1  },
    { key: "t3_main", label: "🟢 TEAM 3 MAIN",          cols: colMap.t3_main },
    { key: "t3_s1",   label: "🟢 TEAM 3 S1",            cols: colMap.t3_s1  },
    { key: "t4",      label: "🟡 TEAM 4",               cols: colMap.t4     }
  ];

  // ── 4. Xóa tin cũ ──
  for (var di = 0; di < TEMPLATE_ORDER.length; di++) {
    var oldKey = "daily_tpl_" + TEMPLATE_ORDER[di].key + "_mid";
    var oldMid = props.getProperty(oldKey);
    if (oldMid) { deleteTgMessage_(token, DAILY_ATT_CHAT, oldMid); props.deleteProperty(oldKey); }
    Utilities.sleep(200);
  }

  // ── 5. Gửi từng nhóm với live status ──
  for (var ti = 0; ti < TEMPLATE_ORDER.length; ti++) {
    var tpl = TEMPLATE_ORDER[ti];
    if (!tpl.cols || tpl.cols.length === 0) continue;

    // Đọc từ Row 2 để bỏ dòng tiêu đề cột (ví dụ: "T4 Attendane report: 16/09/26:")
    var rosterVals = maxRow >= 2 ? tplSheet.getRange(2, tpl.cols[0], maxRow - 1, 1).getValues() : [];
    var roster = [];
    for (var ri = 0; ri < rosterVals.length; ri++) {
      var rv = String(rosterVals[ri][0] || "").trim();
      if (!rv) continue;
      if (rv.toLowerCase().indexOf("total:") === 0) continue;
      if (rv.toLowerCase().indexOf("report") !== -1 && rv.toLowerCase().indexOf("attendan") !== -1) continue;

      // Chuẩn hóa tên: bỏ số thứ tự ở đầu (vd: "1. ", "2. ") và dấu 2 chấm ở cuối (vd: ":")
      var cleanName = rv.replace(/^\d+[\.\:\-\s]+/, '').replace(/[\:\-]+$/, '').trim();
      if (!cleanName) continue;
      roster.push({ cleanName: cleanName, rawName: rv });
    }
    if (roster.length === 0) continue;

    var wCnt = 0, lateCnt = 0, hCnt = 0, leaveCnt = 0, noRptCnt = 0;
    var lines = [];
    for (var ni = 0; ni < roster.length; ni++) {
      var item = roster[ni];
      var pName = item.cleanName;
      var pSt   = statusMap[pName.toLowerCase()] || statusMap[item.rawName.toLowerCase()];
      var line  = (ni + 1) + ". " + pName + ": ";
      if (!pSt) {
        noRptCnt++; line += "❌ Take leave Not report";
      } else if (pSt.status === "work") {
        wCnt++;     line += "✅ Working" + (pSt.time ? " (" + pSt.time + ")" : "");
      } else if (pSt.status === "late") {
        lateCnt++;  line += "⚠️ Late" + (pSt.time ? " (" + pSt.time + ")" : "");
      } else if (pSt.status === "half") {
        hCnt++;     line += "🟡 Half Day";
      } else {
        leaveCnt++; line += "🟡 Take Leave";
      }
      lines.push(line);
    }

    var summary = [];
    summary.push("✅ Working: "      + wCnt);
    if (lateCnt  > 0) summary.push("⚠️ Late: "         + lateCnt);
    if (hCnt     > 0) summary.push("🟡 Half Day: "     + hCnt);
    if (leaveCnt > 0) summary.push("🟡 Take Leave: "   + leaveCnt);
    summary.push("❌ Take leave Not report: " + noRptCnt);

    var msgText = "📋 <b>" + tpl.label + "</b>\n" +
                  "📅 " + todayDisp + "\n" +
                  "──────────────────────\n" +
                  summary.join("\n") + "\n" +
                  "──────────────────────\n" +
                  lines.join("\n");

    var newMid = sendTgMsgGetId_(token, DAILY_ATT_CHAT, msgText);
    if (newMid) props.setProperty("daily_tpl_" + tpl.key + "_mid", String(newMid));
    Utilities.sleep(500);
  }

  // ── 6. Tin tổng hợp thành viên Group 10 (Not yet joined + No ID + Should remove) ──
  sendGroup10MembershipSummary(DAILY_ATT_CHAT);

  Logger.log("✅ sendDailyAttendanceTemplates (live status) done: " +
    Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm"));
}

/**
 * Tin nhắn tổng hợp thành viên Group 10 (TNI DAILY ADDTENDANCE):
 * 1. Ai có Telegram ID trong Staff attendance nhưng CHƯA tham gia Group 10
 * 2. Ai trong Staff attendance nhưng CHƯA CÓ Telegram ID trong Sheet (cần bổ sung)
 * 3. Ai đã gửi điểm danh hôm nay nhưng KHÔNG CÓ trong Staff attendance (cần xem xét xóa/thêm)
 */
function sendGroup10MembershipSummary(targetChatId) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SEND_BOT_TOKEN") || "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw";
  const ssId  = props.getProperty("ATTENDANCE_SS_ID") || "18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54";
  const DAILY_ATT_CHAT = targetChatId || props.getProperty("DAILY_ATT_CHAT_ID") || "-5465634644";

  const tz = "Asia/Rangoon";
  const ss  = SpreadsheetApp.openById(ssId);
  const now = new Date();
  const todayDisp = Utilities.formatDate(now, tz, "dd/MM/yyyy (EEE)");
  const todayStr  = Utilities.formatDate(now, tz, "dd/MM/yyyy");

  function parseCellDate_(raw) {
    if (raw instanceof Date) return Utilities.formatDate(raw, tz, "dd/MM/yyyy");
    var s = String(raw || "").trim().split(" ")[0];
    var p = s.split(/[\/\-\.]/);
    if (p.length < 3) return "";
    var yr = parseInt(p[2]); if (yr < 100) yr += 2000;
    return ("0"+p[0]).slice(-2) + "/" + ("0"+p[1]).slice(-2) + "/" + yr;
  }

  // Xóa tin cũ nếu gửi vào group 10 mặc định
  if (!targetChatId || targetChatId === DAILY_ATT_CHAT) {
    var oldSumMid = props.getProperty("daily_tpl_summary_mid");
    if (oldSumMid) { deleteTgMessage_(token, DAILY_ATT_CHAT, oldSumMid); props.deleteProperty("daily_tpl_summary_mid"); }
  }

  // Đọc toàn bộ staff từ Staff attendance (Col A=TgId, F=FullName, C=TgName, M=Team, N=Probation/Status)
  var staffSheet2 = ss.getSheetByName("Staff attendance");
  var staffAll = [], noIdList = [], noIdListRaw = [], staffTgMap = {};
  if (staffSheet2 && staffSheet2.getLastRow() >= 2) {
    var saV = staffSheet2.getRange(2, 1, staffSheet2.getLastRow() - 1, 14).getValues();
    for (var si2 = 0; si2 < saV.length; si2++) {
      var sr2 = saV[si2];
      var sTgId   = String(sr2[0] || "").trim();
      var sName   = String(sr2[5] || sr2[2] || "").trim();
      var sTeam   = String(sr2[12] || sr2[10] || "").trim();
      var sStatus = String(sr2[13] || "").toLowerCase();

      // Bỏ qua nhân viên đã nghỉ việc
      if (sStatus.indexOf("resign") !== -1 || sStatus.indexOf("nghỉ") !== -1 || sStatus.indexOf("quit") !== -1 || sStatus.indexOf("off") !== -1) continue;
      if (!sName || sName.toLowerCase().indexOf("nyi nyi") !== -1 || sName.toLowerCase() === "vcm") continue;

      var label = sName + (sTeam ? " (" + sTeam + ")" : "");
      if (!sTgId) {
        noIdList.push(label);
        noIdListRaw.push({ name: sName, team: sTeam, label: label });
        continue;
      }
      staffAll.push({ name: sName, team: sTeam, tgId: sTgId, label: label });
      staffTgMap[sTgId] = true;
    }
  }

  // getChatMember — ai có TG ID nhưng chưa vào group 10
  var notYetJoined = [];
  var inGroupCount = 0;
  var checkJointRecords = [];
  var apiBase = "https://api.telegram.org/bot" + token;
  for (var ci = 0; ci < staffAll.length; ci++) {
    var uHandle = "";
    var isJoined = false;
    var st = "";
    try {
      var cmResp = UrlFetchApp.fetch(apiBase + "/getChatMember", {
        method: "post", contentType: "application/json",
        payload: JSON.stringify({ chat_id: Number(DAILY_ATT_CHAT), user_id: Number(staffAll[ci].tgId) }),
        muteHttpExceptions: true
      });
      var cmData = JSON.parse(cmResp.getContentText());
      st = cmData.ok ? cmData.result.status : "";
      if (cmData.ok && cmData.result && cmData.result.user) {
        uHandle = cmData.result.user.username || "";
      }
      if (cmData.ok && (st === "creator" || st === "administrator" || st === "member" || st === "restricted")) {
        isJoined = true;
        inGroupCount++;
      } else {
        notYetJoined.push(staffAll[ci].label);
      }
    } catch(e2) {
      st = "error";
      notYetJoined.push(staffAll[ci].label + " [?]");
    }

    checkJointRecords.push({
      team: staffAll[ci].team,
      name: staffAll[ci].name,
      tgId: staffAll[ci].tgId,
      status: isJoined ? "joined" : "not_joined",
      role: st || "not_in_group",
      username: uHandle,
      note: isJoined ? "" : "Not in Group 10"
    });

    Utilities.sleep(150);
  }

  // Thêm nhân viên thiếu Telegram ID vào checkJointRecords
  for (var mi2 = 0; mi2 < noIdListRaw.length; mi2++) {
    checkJointRecords.push({
      team: noIdListRaw[mi2].team,
      name: noIdListRaw[mi2].name,
      tgId: "",
      status: "no_id",
      role: "missing_id",
      username: "",
      note: "No Telegram ID in Sheet"
    });
  }

  // Ai gởi điểm danh hôm nay nhưng KHÔNG có trong Staff attendance → cần xem xét xóa/thêm
  var listSheet = ss.getSheetByName("List Attendance");
  var shouldRemove = [];
  var unknownRecords = [];
  var seenUnknown = {};
  if (listSheet && listSheet.getLastRow() >= 2) {
    var lrV2 = listSheet.getRange(2, 1, listSheet.getLastRow() - 1, 6).getValues();
    for (var li2 = 0; li2 < lrV2.length; li2++) {
      var lr2 = lrV2[li2];
      if (parseCellDate_(lr2[1]) !== todayStr) continue;
      var uid = String(lr2[3] || "").trim();
      var uname = String(lr2[5] || lr2[4] || "").trim();
      // Bỏ qua nếu trống, đã có trong staff list, đã duyệt, hoặc là tài khoản Owner/Admin 6859790680
      if (!uid || staffTgMap[uid] || seenUnknown[uid] || uid === "6859790680") continue;
      seenUnknown[uid] = true;

      var displayName = uname;
      var isOwnerOrAdmin = false;
      var uRole = "";
      var uHandleUnknown = "";
      try {
        var uResp = UrlFetchApp.fetch(apiBase + "/getChatMember", {
          method: "post", contentType: "application/json",
          payload: JSON.stringify({ chat_id: Number(DAILY_ATT_CHAT), user_id: Number(uid) }),
          muteHttpExceptions: true
        });
        var uData = JSON.parse(uResp.getContentText());
        if (uData.ok && uData.result) {
          uRole = uData.result.status;
          if (uRole === "creator" || uRole === "administrator") isOwnerOrAdmin = true;
          if (uData.result.user) {
            var uUser = uData.result.user;
            if (uUser.is_bot) isOwnerOrAdmin = true;
            uHandleUnknown = uUser.username || "";
            if (!displayName) {
              var uFullName = [uUser.first_name, uUser.last_name].filter(Boolean).join(" ");
              var uHandle = uUser.username ? "@" + uUser.username : "";
              if (uFullName && uHandle) displayName = uFullName + " (" + uHandle + ")";
              else displayName = uFullName || uHandle || ("ID:" + uid);
            }
          }
        }
      } catch(eName) {
        if (!displayName) displayName = "ID:" + uid;
      }

      if (isOwnerOrAdmin) continue;
      shouldRemove.push(displayName || ("ID:" + uid));
      unknownRecords.push({
        tgId: uid,
        displayName: displayName || ("ID:" + uid),
        role: uRole || "",
        username: uHandleUnknown
      });
    }
  }

  // Soạn tin tổng hợp 100% tiếng Anh chuẩn
  var totalActive = staffAll.length + noIdList.length;
  var sumLines = [
    "👥 <b>Group 10 Membership Check</b>",
    "📅 " + todayDisp,
    "──────────────────────",
    "📊 <b>Summary:</b> " + inGroupCount + "/" + totalActive + " active staff joined"
  ];

  if (notYetJoined.length > 0) {
    sumLines.push("──────────────────────");
    sumLines.push("⚠️ <b>Not yet joined group (" + notYetJoined.length + "):</b>");
    for (var ni = 0; ni < notYetJoined.length; ni++) {
      sumLines.push((ni + 1) + ". " + notYetJoined[ni]);
    }
  } else {
    sumLines.push("✅ All registered staff are in this group");
  }

  if (noIdList.length > 0) {
    sumLines.push("──────────────────────");
    sumLines.push("❓ <b>No Telegram ID in sheet (" + noIdList.length + "):</b>");
    for (var mi = 0; mi < noIdList.length; mi++) {
      sumLines.push((mi + 1) + ". " + noIdList[mi]);
    }
  }

  if (shouldRemove.length > 0) {
    sumLines.push("──────────────────────");
    sumLines.push("🚫 <b>Not in staff list — consider removing (" + shouldRemove.length + "):</b>");
    for (var ri = 0; ri < shouldRemove.length; ri++) {
      sumLines.push((ri + 1) + ". " + shouldRemove[ri]);
    }
  }

  // ── Cập nhật kết quả vào tab CheckJoint trong Google Sheet ──
  try {
    updateCheckJointSheet_(ss, checkJointRecords, unknownRecords, {
      joinedCount: inGroupCount,
      totalActive: totalActive,
      noIdCount: noIdList.length
    });
  } catch (errCheckJoint) {
    Logger.log("❌ Lỗi updateCheckJointSheet_: " + errCheckJoint.message + "\n" + errCheckJoint.stack);
  }

  var fullMsg = sumLines.join("\n");
  var newMid = sendTgMsgGetId_(token, DAILY_ATT_CHAT, fullMsg);
  if (newMid && (!targetChatId || targetChatId === DAILY_ATT_CHAT)) {
    props.setProperty("daily_tpl_summary_mid", String(newMid));
  }

  Logger.log("✅ sendGroup10MembershipSummary done. Mid: " + newMid);
  return fullMsg;
}

/**
 * Ghi kết quả kiểm tra thành viên Group 10 vào tab CheckJoint
 * Sheet ID: 18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54
 */
function updateCheckJointSheet_(ss, records, unknownRecords, stats) {
  var sheet = ss.getSheetByName("CheckJoint");
  if (!sheet) {
    sheet = ss.insertSheet("CheckJoint");
  }

  var tz = "Asia/Rangoon";
  var nowStr = Utilities.formatDate(new Date(), tz, "dd/MM/yyyy HH:mm:ss");

  var headers = [
    "STT",
    "Team / Dept",
    "Full Name",
    "Telegram ID",
    "Group 10 Status",
    "Telegram Role",
    "Telegram Username",
    "Last Checked (MMT)",
    "Notes"
  ];

  var rows = [];
  var bgColors = [];

  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    var stt = i + 1;
    var statusText = "";
    var statusBg = "#ffffff";

    if (r.status === "joined") {
      statusText = "✅ Joined";
      statusBg = "#D4EDDA"; // light green
    } else if (r.status === "not_joined") {
      statusText = "❌ Not Joined";
      statusBg = "#F8D7DA"; // light red
    } else if (r.status === "no_id") {
      statusText = "❓ Missing TG ID";
      statusBg = "#FFF3CD"; // light yellow
    } else {
      statusText = r.status || "";
    }

    rows.push([
      stt,
      r.team || "",
      r.name || "",
      r.tgId ? ("'" + r.tgId) : "",
      statusText,
      r.role || "",
      r.username ? ("@" + r.username) : "",
      nowStr,
      r.note || ""
    ]);

    var colorRow = [];
    for (var c = 0; c < headers.length; c++) {
      if (c === 4) colorRow.push(statusBg);
      else colorRow.push("#ffffff");
    }
    bgColors.push(colorRow);
  }

  // Thêm các tài khoản không có trong Staff attendance nhưng trong group/điểm danh
  if (unknownRecords && unknownRecords.length > 0) {
    for (var u = 0; u < unknownRecords.length; u++) {
      var ur = unknownRecords[u];
      rows.push([
        rows.length + 1,
        "Unknown",
        ur.displayName || ("ID:" + ur.tgId),
        ur.tgId ? ("'" + ur.tgId) : "",
        "🚫 Not in Staff List",
        ur.role || "",
        ur.username ? ("@" + ur.username) : "",
        nowStr,
        "Consider removing from Group 10"
      ]);
      var uColorRow = [];
      for (var uc = 0; uc < headers.length; uc++) {
        if (uc === 4) uColorRow.push("#FFE8D6"); // light orange
        else uColorRow.push("#FFF8F0");
      }
      bgColors.push(uColorRow);
    }
  }

  // Xóa toàn bộ sheet và ghi dữ liệu mới chuẩn
  sheet.clear();

  // Banner tóm tắt tại Dòng 1
  var pct = stats.totalActive > 0 ? Math.round((stats.joinedCount / stats.totalActive) * 100) : 0;
  var summaryText = "📊 Group 10 Membership: " + stats.joinedCount + "/" + stats.totalActive + " Joined (" + pct + "%) | Missing ID: " + stats.noIdCount + " | Unknown: " + (unknownRecords ? unknownRecords.length : 0) + " | Last Checked: " + nowStr + " MMT";
  sheet.getRange(1, 1, 1, headers.length).merge().setValue(summaryText)
    .setFontWeight("bold").setFontSize(11).setBackground("#1A237E").setFontColor("#ffffff")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setRowHeight(1, 34);

  // Header tại Dòng 2
  var headerRange = sheet.getRange(2, 1, 1, headers.length);
  headerRange.setValues([headers])
    .setFontWeight("bold").setFontSize(10).setBackground("#283593").setFontColor("#ffffff")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setRowHeight(2, 28);

  // Data từ Dòng 3
  if (rows.length > 0) {
    var dataRange = sheet.getRange(3, 1, rows.length, headers.length);
    dataRange.setValues(rows).setFontSize(9).setVerticalAlignment("middle");
    dataRange.setBackgrounds(bgColors);

    // Căn giữa các cột STT, Team, ID, Status, Role, Username, Last Checked
    sheet.getRange(3, 1, rows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(3, 2, rows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(3, 4, rows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(3, 5, rows.length, 1).setHorizontalAlignment("center").setFontWeight("bold");
    sheet.getRange(3, 6, rows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(3, 7, rows.length, 1).setHorizontalAlignment("center");
    sheet.getRange(3, 8, rows.length, 1).setHorizontalAlignment("center");
  }

  sheet.setFrozenRows(2);
  sheet.autoResizeColumns(1, headers.length);
  Logger.log("✅ CheckJoint sheet updated successfully: " + rows.length + " rows.");
}

/**
 * Cài đặt trigger 8:45 và 9:15 MMT cho sendDailyAttendanceTemplates
 * - 08:45 MMT: Cập nhật đợt 1 sau cutoff 8:40 (Working < 8:40, ai gửi sau 8:40 là Late ⚠️)
 * - 09:15 MMT: Chốt đợt 2 (ai gửi từ 8:40-9:15 là Late ⚠️, ai không gửi chuyển thành Take leave Not report ❌)
 */
function setupDailyTemplatesTrigger() {
  var HANDLER = "sendDailyAttendanceTemplates";
  // Xóa trigger cũ nếu có
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === HANDLER) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Tạo trigger 1: lúc 08:45 MMT (Asia/Rangoon)
  ScriptApp.newTrigger(HANDLER)
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .nearMinute(45)
    .inTimezone("Asia/Rangoon")
    .create();

  // Tạo trigger 2: lúc 09:15 MMT (Asia/Rangoon)
  ScriptApp.newTrigger(HANDLER)
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .nearMinute(15)
    .inTimezone("Asia/Rangoon")
    .create();

  Logger.log("✅ Daily templates triggers set for 08:45 and 09:15 MMT → sendDailyAttendanceTemplates");
}

// ── BẢNG TỔNG HỢP CÔNG THEO THÁNG — TAB SUM WORK (GID: 1895020121) ──
function buildSumWorkTab() {
  const ss = SpreadsheetApp.openById("18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
  let sumWorkSheet = ss.getSheetByName("Sum work");
  if (!sumWorkSheet) {
    sumWorkSheet = ss.insertSheet("Sum work");
  }

  // 1. Xác định tháng được chọn ở ô C1
  let selectedMonth = "";
  try {
    selectedMonth = String(sumWorkSheet.getRange("C1").getValue() || "").trim();
  } catch(e) {}

  const nowMM = new Date();
  const currentMonthStr = Utilities.formatDate(nowMM, "Asia/Rangoon", "MM/yyyy");
  if (!selectedMonth || !/^\d{2}\/\d{4}$/.test(selectedMonth)) {
    selectedMonth = currentMonthStr;
  }

  // 2. Các mốc ngày trọng yếu
  const todayStr = Utilities.formatDate(nowMM, "Asia/Rangoon", "dd/MM/yyyy");
  const d1 = new Date(nowMM.getTime() - 24 * 3600 * 1000);
  const yestStr = Utilities.formatDate(d1, "Asia/Rangoon", "dd/MM/yyyy");
  const d2 = new Date(nowMM.getTime() - 2 * 24 * 3600 * 1000);
  const day2BeforeStr = Utilities.formatDate(d2, "Asia/Rangoon", "dd/MM/yyyy");
  const d7 = new Date(nowMM.getTime() - 7 * 24 * 3600 * 1000);
  const d30 = new Date(nowMM.getTime() - 30 * 24 * 3600 * 1000);

  // Phân tích tháng & năm được chọn
  const mParts = selectedMonth.split("/");
  const selM = parseInt(mParts[0], 10);
  const selY = parseInt(mParts[1], 10);
  const daysInMonth = new Date(selY, selM, 0).getDate();

  // Xác định tháng hiện tại vs tháng trước vs tháng tương lai
  const curY = nowMM.getFullYear();
  const curM = nowMM.getMonth() + 1;
  const todayDay = nowMM.getDate();

  const isCurrentMonth = (selY === curY && selM === curM);
  const isPastMonth = (selY < curY) || (selY === curY && selM < curM);

  let elapsedDays = daysInMonth;
  let colEHeader = "";

  if (isCurrentMonth) {
    elapsedDays = todayDay;
    colEHeader = "Số Ngày Đến Nay (Đến " + todayStr.substring(0, 5) + ")";
  } else if (isPastMonth) {
    elapsedDays = daysInMonth;
    colEHeader = "Tổng Ngày (" + selectedMonth + " - Nguyên Tháng)";
  } else {
    elapsedDays = 0;
    colEHeader = "Số Ngày (" + selectedMonth + ")";
  }

  // 3. Tổng hợp danh sách nhân sự đầy đủ (Field Teams + Office)
  const staffSheet = ss.getSheetByName("Staff attendance");
  const tplSheet = ss.getSheetByName("Template Attendance");
  
  const staffList = [];
  const staffSet = new Set();

  // A. Nạp từ Template Attendance (Field Teams) qua dynamic column map
  if (tplSheet && tplSheet.getLastRow() >= 1) {
    const dynColMap = getAttendanceTemplateColumns_(tplSheet);
    const teamConfigs = [
      { name: "Team 1", col: (dynColMap.t1_main && dynColMap.t1_main[0]) || 6 },
      { name: "Team 1 S1", col: (dynColMap.t1_s1 && dynColMap.t1_s1[0]) || 7 },
      { name: "Team 2", col: (dynColMap.t2_main && dynColMap.t2_main[0]) || 10 },
      { name: "Team 2 S1", col: (dynColMap.t2_s1 && dynColMap.t2_s1[0]) || 11 },
      { name: "Team 3", col: (dynColMap.t3_main && dynColMap.t3_main[0]) || 12 },
      { name: "Team 3 S1", col: (dynColMap.t3_s1 && dynColMap.t3_s1[0]) || 13 },
      { name: "Team 4", col: (dynColMap.t4 && dynColMap.t4[0]) || 14 },
      { name: "Office", col: (dynColMap.office && dynColMap.office[0]) || 5 }
    ];
    const maxR = Math.min(tplSheet.getLastRow(), 35);
    for (let tc = 0; tc < teamConfigs.length; tc++) {
      const cfg = teamConfigs[tc];
      if (cfg.col <= tplSheet.getLastColumn()) {
        const vals = tplSheet.getRange(1, cfg.col, maxR, 1).getValues();
        for (let r = 1; r < vals.length; r++) {
          const line = String(vals[r][0] || "").trim();
          if (line) {
            const m = line.match(/^(?:\d+[\.\)]\s*)?([^:]+)/);
            if (m) {
              const name = m[1].trim();
              if (name && name.toLowerCase().indexOf("nyi nyi") === -1 && !staffSet.has(name.toLowerCase())) {
                staffSet.add(name.toLowerCase());
                staffList.push({ name: name, team: cfg.name, id: "" });
              }
            }
          }
        }
      }
    }
  }

  // B. Nạp từ Staff Attendance (Office & Bổ sung Telegram ID)
  if (staffSheet && staffSheet.getLastRow() >= 2) {
    const staffVals = staffSheet.getRange(2, 1, staffSheet.getLastRow() - 1, 14).getValues();
    for (let i = 0; i < staffVals.length; i++) {
      const row = staffVals[i];
      const tgId = String(row[0] || "").trim();
      const name = String(row[5] || row[2] || "").trim();
      const dep = String(row[10] || "").trim();
      const teamResp = String(row[12] || "").trim();
      const teamName = dep ? dep : (teamResp || "Office");

      if (name && name.toLowerCase().indexOf("nyi nyi") === -1) {
        const key = name.toLowerCase();
        const existing = staffList.find(s => s.name.toLowerCase() === key);
        if (existing) {
          if (tgId) existing.id = tgId;
        } else {
          staffSet.add(key);
          staffList.push({ name: name, team: teamName, id: tgId });
        }
      }
    }
  }

  // 4. Đọc toàn bộ lịch sử điểm danh từ 'Sum report morning attendance'
  const sumReportSheet = ss.getSheetByName("Sum report morning attendance");
  const records = [];
  if (sumReportSheet && sumReportSheet.getLastRow() >= 2) {
    const rVals = sumReportSheet.getRange(2, 1, sumReportSheet.getLastRow() - 1, 8).getValues();
    for (let i = 0; i < rVals.length; i++) {
      const row = rVals[i];
      const dateRaw = row[1];
      const name = String(row[2] || "").trim();
      const isWork = String(row[3] || "").trim().toLowerCase() === "work";
      const isTakeLeave = String(row[4] || "").trim().toLowerCase() === "take leave";
      const isHalf = String(row[5] || "").trim().toLowerCase().indexOf("half") !== -1;
      const tgId = String(row[7] || "").trim();

      let dObj = null;
      let dStr = "";
      if (dateRaw instanceof Date) {
        dObj = dateRaw;
        dStr = Utilities.formatDate(dateRaw, "Asia/Rangoon", "dd/MM/yyyy");
      } else {
        const rawS = String(dateRaw || "").trim().split(" ")[0];
        const p = rawS.split(/[\/\-\.]/);
        if (p.length === 3) {
          let day = parseInt(p[0], 10);
          let month = parseInt(p[1], 10);
          let yr = parseInt(p[2], 10);
          if (yr < 100) yr += 2000;
          dObj = new Date(yr, month - 1, day);
          dStr = (day < 10 ? "0" + day : day) + "/" + (month < 10 ? "0" + month : month) + "/" + yr;
        }
      }

      if (name && dObj) {
        const mStr = (dObj.getMonth() + 1 < 10 ? "0" + (dObj.getMonth() + 1) : (dObj.getMonth() + 1)) + "/" + dObj.getFullYear();
        records.push({
          dateObj: dObj,
          dateStr: dStr,
          monthStr: mStr,
          name: name.toLowerCase(),
          id: tgId,
          work: isWork,
          takeLeave: isTakeLeave,
          halfDay: isHalf
        });
      }
    }
  }

  // 5. Thống kê số liệu chi tiết cho từng nhân viên
  const summaryRows = [];
  for (let s = 0; s < staffList.length; s++) {
    const staff = staffList[s];
    const key = staff.name.toLowerCase();

    let countWorkMonth = 0;
    let countLeaveMonth = 0;
    let countHalfMonth = 0;

    let todayStatus = "❌ Chưa báo";
    let yestStatus = "❌ Chưa báo";
    let day2BeforeStatus = "❌ Chưa báo";

    let count7DWork = 0;
    let count30DWork = 0;

    for (let r = 0; r < records.length; r++) {
      const rec = records[r];
      const match = (rec.name === key) || (staff.id && rec.id && rec.id === staff.id);
      if (!match) continue;

      if (rec.monthStr === selectedMonth) {
        if (rec.work) countWorkMonth++;
        if (rec.takeLeave) countLeaveMonth++;
        if (rec.halfDay) countHalfMonth++;
      }

      if (rec.dateStr === todayStr) {
        if (rec.work) todayStatus = "✅ Work";
        else if (rec.halfDay) todayStatus = "🌓 Half Day";
        else if (rec.takeLeave) todayStatus = "🏖️ Take Leave";
      }
      if (rec.dateStr === yestStr) {
        if (rec.work) yestStatus = "✅ Work";
        else if (rec.halfDay) yestStatus = "🌓 Half Day";
        else if (rec.takeLeave) yestStatus = "🏖️ Take Leave";
      }
      if (rec.dateStr === day2BeforeStr) {
        if (rec.work) day2BeforeStatus = "✅ Work";
        else if (rec.halfDay) day2BeforeStatus = "🌓 Half Day";
        else if (rec.takeLeave) day2BeforeStatus = "🏖️ Take Leave";
      }

      if (rec.dateObj >= d7) {
        if (rec.work) count7DWork += 1;
        else if (rec.halfDay) count7DWork += 0.5;
      }
      if (rec.dateObj >= d30) {
        if (rec.work) count30DWork += 1;
        else if (rec.halfDay) count30DWork += 0.5;
      }
    }

    const totalCong = countWorkMonth + (countHalfMonth * 0.5);
    const pctWork = elapsedDays > 0 ? (Math.round((countWorkMonth / elapsedDays) * 100) + "%") : "0%";

    summaryRows.push([
      s + 1,                                            // Col A (1): STT
      staff.name,                                       // Col B (2): Họ & Tên Nhân Viên
      staff.team,                                       // Col C (3): Bộ Phận / Team
      staff.id || "Chưa gán",                           // Col D (4): Telegram ID
      elapsedDays,                                      // Col E (5): Số Ngày Đến Hôm Nay / Nguyên Tháng
      pctWork,                                          // Col F (6) [MỚI]: % Work / Số Ngày Tháng
      countWorkMonth,                                   // Col G (7): Tổng Work (Ngày)
      countLeaveMonth,                                  // Col H (8): Tổng Take Leave
      countHalfMonth,                                   // Col I (9): Tổng Half Leave
      totalCong,                                        // Col J (10): Tổng Ngày Công
      todayStatus,                                      // Col K (11): Hôm Nay
      yestStatus,                                       // Col L (12): Hôm Qua
      day2BeforeStatus,                                 // Col M (13): Hôm Kia
      count7DWork + "/7 ngày (" + Math.round((count7DWork / 7) * 100) + "%)",   // Col N (14): Thống Kê 7 Ngày
      count30DWork + "/30 ngày (" + Math.round((count30DWork / 30) * 100) + "%)" // Col O (15): Thống Kê 1 Tháng
    ]);
  }

  // 6. Ghi dữ liệu & Định dạng bảng 'Sum work' (15 Cột: A -> O)
  sumWorkSheet.getRange("A1:B1").merge().setValue("📅 THÁNG XEM BÁO CÁO:").setFontWeight("bold").setBackground("#E8F0FE").setFontColor("#1A73E8").setHorizontalAlignment("right").setVerticalAlignment("middle");
  
  const cellC1 = sumWorkSheet.getRange("C1");
  cellC1.setValue(selectedMonth).setFontWeight("bold").setFontSize(12).setHorizontalAlignment("center").setBackground("#FFFFFF").setBorder(true, true, true, true, false, false, "#1A73E8", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  const monthList = [
    "08/2026", "07/2026", "06/2026", "05/2026", "04/2026", "03/2026", "02/2026", "01/2026",
    "09/2026", "10/2026", "11/2026", "12/2026"
  ];
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(monthList, true).setAllowInvalid(true).build();
  cellC1.setDataValidation(rule);

  sumWorkSheet.getRange("D1:G1").merge().setValue("💡 Bấm vào ô C1 để chọn tháng cần xem báo cáo tổng hợp").setFontStyle("italic").setFontColor("#5F6368").setVerticalAlignment("middle");
  sumWorkSheet.getRange("H1:O1").merge().setValue("🕒 Cập nhật lúc: " + Utilities.formatDate(nowMM, "Asia/Rangoon", "dd/MM/yyyy HH:mm:ss") + " MMT").setFontColor("#70757A").setFontSize(9).setHorizontalAlignment("right").setVerticalAlignment("middle");

  const tableHeaders = [
    "STT",
    "Họ & Tên Nhân Viên",
    "Bộ Phận / Team",
    "Telegram ID",
    colEHeader,
    "% Work / Số Ngày",
    "Tổng Work (Ngày)",
    "Tổng Take Leave",
    "Tổng Half Leave",
    "Tổng Ngày Công",
    "Hôm Nay (" + todayStr + ")",
    "Hôm Qua (" + yestStr + ")",
    "Hôm Kia (" + day2BeforeStr + ")",
    "Thống Kê 7 Ngày",
    "Thống Kê 1 Tháng (30N)"
  ];

  sumWorkSheet.getRange("A3:O3").setValues([tableHeaders])
    .setBackground("#1A73E8")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);
  sumWorkSheet.setRowHeight(3, 36);

  const oldLastRow = sumWorkSheet.getLastRow();
  if (oldLastRow > 3) {
    sumWorkSheet.getRange(4, 1, oldLastRow - 3, 15).clearContent().clearFormat();
  }

  if (summaryRows.length > 0) {
    const dataRange = sumWorkSheet.getRange(4, 1, summaryRows.length, 15);
    dataRange.setValues(summaryRows)
      .setVerticalAlignment("middle")
      .setFontSize(10);

    sumWorkSheet.getRange(4, 1, summaryRows.length, 1).setHorizontalAlignment("center");
    sumWorkSheet.getRange(4, 2, summaryRows.length, 1).setHorizontalAlignment("left").setFontWeight("bold");
    sumWorkSheet.getRange(4, 3, summaryRows.length, 1).setHorizontalAlignment("center");
    sumWorkSheet.getRange(4, 4, summaryRows.length, 1).setHorizontalAlignment("center");
    sumWorkSheet.getRange(4, 5, summaryRows.length, 1).setHorizontalAlignment("center");
    sumWorkSheet.getRange(4, 6, summaryRows.length, 1).setHorizontalAlignment("center").setFontWeight("bold").setFontColor("#1A73E8");
    sumWorkSheet.getRange(4, 7, summaryRows.length, 4).setHorizontalAlignment("center");
    sumWorkSheet.getRange(4, 11, summaryRows.length, 3).setHorizontalAlignment("center");
    sumWorkSheet.getRange(4, 14, summaryRows.length, 2).setHorizontalAlignment("center");

    for (let r = 0; r < summaryRows.length; r++) {
      const rowNum = 4 + r;
      if (r % 2 === 1) {
        sumWorkSheet.getRange(rowNum, 1, 1, 15).setBackground("#F8F9FA");
      }
    }
    dataRange.setBorder(true, true, true, true, true, true, "#DADCE0", SpreadsheetApp.BorderStyle.SOLID);
  }

  sumWorkSheet.setColumnWidth(1, 55);   // STT
  sumWorkSheet.setColumnWidth(2, 200);  // Họ Tên
  sumWorkSheet.setColumnWidth(3, 140);  // Team
  sumWorkSheet.setColumnWidth(4, 120);  // Telegram ID
  sumWorkSheet.setColumnWidth(5, 140);  // Số ngày tháng
  sumWorkSheet.setColumnWidth(6, 130);  // % Work / Số Ngày
  sumWorkSheet.setColumnWidth(7, 110);  // Tổng Work
  sumWorkSheet.setColumnWidth(8, 120);  // Tổng Take Leave
  sumWorkSheet.setColumnWidth(9, 120);  // Tổng Half Leave
  sumWorkSheet.setColumnWidth(10, 120); // Tổng Ngày Công
  sumWorkSheet.setColumnWidth(11, 160); // Hôm Nay
  sumWorkSheet.setColumnWidth(12, 160); // Hôm Qua
  sumWorkSheet.setColumnWidth(13, 160); // Hôm Kia
  sumWorkSheet.setColumnWidth(14, 150); // 7 Ngày
  sumWorkSheet.setColumnWidth(15, 160); // 1 Tháng

  Logger.log("✅ Bảng 'Sum work' đã cập nhật thành công cho tháng " + selectedMonth + " với " + summaryRows.length + " nhân sự!");
}

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (sheet.getName() === "Sum work" && e.range.getA1Notation() === "C1") {
      buildSumWorkTab();
    }
  } catch(err) {
    Logger.log("onEdit error: " + err);
  }
}

/**
 * Xây dựng nội dung tin nhắn báo cáo tổng hợp chuyên cần tháng
 */
function getMonthlyAttendanceSummaryText() {
  try {
    const ss = SpreadsheetApp.openById("18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
    let sumWorkSheet = ss.getSheetByName("Sum work");
    if (!sumWorkSheet || sumWorkSheet.getLastRow() < 4) {
      buildSumWorkTab();
      sumWorkSheet = ss.getSheetByName("Sum work");
    }
    if (!sumWorkSheet || sumWorkSheet.getLastRow() < 4) return null;

    const selectedMonth = String(sumWorkSheet.getRange("C1").getValue() || "").trim();
    const lastRow = sumWorkSheet.getLastRow();
    const dataVals = sumWorkSheet.getRange(4, 1, lastRow - 3, 15).getValues();

    const teams = {};
    let daysPassed = "";

    for (let i = 0; i < dataVals.length; i++) {
      const r = dataVals[i];
      const name = String(r[1] || "").trim();
      let team = String(r[2] || "").trim();
      const dVal = String(r[4] || "").trim();
      const pct = String(r[5] || "").trim();
      const work = r[6];
      const leave = r[7];
      const half = r[8];
      const cong = r[9];

      if (!name || name === "0" || name.length < 2 || name.toLowerCase().indexOf("nyi nyi") !== -1) continue;
      if (!daysPassed && dVal) daysPassed = dVal;
      if (!team) team = "Khác";

      if (!teams[team]) teams[team] = [];
      teams[team].push({
        name: name,
        days: dVal,
        pct: pct,
        work: work,
        leave: leave,
        half: half,
        cong: cong
      });
    }

    const teamIcons = {
      "Team 1": "🟠", "Team 1 S1": "🟠",
      "Team 2": "🔵", "Team 2 S1": "🔵",
      "Team 3": "🟢", "Team 3 S1": "🟢",
      "Team 4": "🟡", "Office": "🏢"
    };

    const msgLines = [
      "📊 *MONTHLY ATTENDANCE SUMMARY — " + selectedMonth + "*",
      "🏢 *TNI OPERATIONS — ALL UNITS & STAFF*",
      "──────────────────────────────",
      "📅 *Reporting days up to today:* " + (daysPassed || "23") + " days",
      ""
    ];

    let totalStaff = 0;
    let totWork = 0;
    let totLeave = 0;

    for (const tName in teams) {
      const members = teams[tName];
      totalStaff += members.length;
      const icon = teamIcons[tName] || "🔹";
      msgLines.push(icon + " *" + tName.toUpperCase() + "* (" + members.length + " staff)");

      for (let m = 0; m < members.length; m++) {
        const it = members[m];
        totWork += Number(it.work) || 0;
        totLeave += Number(it.leave) || 0;
        const halfVal = Number(it.half) || 0;
        const hStr = halfVal > 0 ? " (🌓" + halfVal + ")" : "";
        msgLines.push((m + 1) + ". " + it.name + ": *" + it.work + "/" + it.days + " (" + it.pct + ")* | 🏖️ Leave: " + it.leave + hStr);
      }
      msgLines.push("");
    }

    msgLines.push("──────────────────────────────");
    msgLines.push("👥 *Total Staff:* " + totalStaff + " | 💼 *Total Work:* " + totWork + " | 🏖️ *Total Leave:* " + totLeave);

    return msgLines.join("\n");
  } catch (e) {
    Logger.log("getMonthlyAttendanceSummaryText error: " + e.message);
    return null;
  }
}

/**
 * Gửi báo cáo tổng hợp chuyên cần tháng sang Group Control (-5251698940)
 */
function sendMonthlyAttendanceSummaryToControl(targetChatId) {
  try {
    const reportText = getMonthlyAttendanceSummaryText();
    if (!reportText) return false;

    const chatId = targetChatId || "-5251698940";
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty("CONTROL_BOT_TOKEN") || "8897800070:AAHcG2eHlPsE0KpZAGjcFTe7ndn8gjpQi-A";

    const url = "https://api.telegram.org/bot" + token + "/sendMessage";
    const resp = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        chat_id: chatId,
        text: reportText,
        parse_mode: "Markdown"
      }),
      muteHttpExceptions: true
    });

    Logger.log("Send control summary response: " + resp.getResponseCode() + " " + resp.getContentText());
    return resp.getResponseCode() === 200;
  } catch (err) {
    Logger.log("sendMonthlyAttendanceSummaryToControl error: " + err.message);
    return false;
  }
}

/**
 * Đọc dữ liệu Site Down từ bảng 10_TNI_SITE_DOWN (GID=0) — chỉ hiển thị Site ID + ETA gọn.
 * Cột E = ngày giờ cập nhật, Cột F = Site ID, Cột G = Team, Cột N = ETA.
 * @param {string} teamFilter - "T1", "T1 S1", "T2", "T2 S1", "T3", "T3 S1", "T4", hoặc "ALL"
 */
function getEtaSiteDownByTeam_(teamFilter) {
  try {
    const sdSs = SpreadsheetApp.openById("1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow");
    const sdSheet = sdSs.getSheetByName("Input Site down Telegram");
    if (!sdSheet) return null;

    // Đọc Cột E dòng 5 để lấy ngày giờ cập nhật
    const eVal = sdSheet.getRange("E5").getValue();
    var updateTs = "";
    if (eVal instanceof Date) {
      updateTs = Utilities.formatDate(eVal, "Asia/Rangoon", "dd/MM/yy HH:mm");
    } else {
      updateTs = String(eVal || "").trim();
    }
    if (!updateTs) {
      const f5 = sdSheet.getRange("F5").getValue();
      updateTs = f5 instanceof Date ? Utilities.formatDate(f5, "Asia/Rangoon", "dd/MM/yy HH:mm") : String(f5 || "").trim();
    }

    const lastRow = sdSheet.getLastRow();
    if (lastRow < 7) return "📡 *ETA " + teamFilter + "*\n_No sites down._";

    // Đọc Cột F, G, N (cột 6,7,14) từ dòng 6
    const colFG = sdSheet.getRange(6, 6, lastRow - 5, 2).getValues();  // F,G
    const colN  = sdSheet.getRange(6, 14, lastRow - 5, 1).getValues(); // N

    var sites = {};
    var teamOrder = ["T1", "T1 S1", "T2", "T2 S1", "T3", "T3 S1", "T4"];

    for (var i = 0; i < colFG.length; i++) {
      var siteId = String(colFG[i][0] || "").trim();
      var team   = String(colFG[i][1] || "").trim();
      var etaRaw = String(colN[i][0] || "").trim();

      if (!siteId || !siteId.match(/^TNI\d{3,5}$/i)) continue;
      if (!team || !team.match(/^T\d/i)) continue;
      if (teamFilter !== "ALL" && team !== teamFilter) continue;

      if (!sites[team]) sites[team] = [];
      var eta = etaRaw;
      if (eta.indexOf("ETA:") === 0) eta = eta.substring(4).trim();
      sites[team].push({ siteId: siteId, eta: eta });
    }

    var hasData = false;
    for (var t in sites) { if (sites[t].length > 0) { hasData = true; break; } }
    if (!hasData) return updateTs + "\nNo sites down.";

    var lines = [];
    lines.push(updateTs);

    var displayOrder = teamFilter === "ALL" ? teamOrder : [teamFilter];
    for (var d = 0; d < displayOrder.length; d++) {
      var tName = displayOrder[d];
      if (!sites[tName] || sites[tName].length === 0) continue;
      lines.push("");
      lines.push(tName);
      for (var s = 0; s < sites[tName].length; s++) {
        var st = sites[tName][s];
        lines.push(st.siteId + " ETA: " + (st.eta || ""));
      }
    }

    return lines.join("\n");
  } catch (err) {
    Logger.log("getEtaSiteDownByTeam_ error: " + err.message);
    return "⚠️ Error: " + err.message;
  }
}

/**
 * Trigger tự động gửi báo cáo tổng hợp chuyên cần buổi sáng vào nhóm CONTROL đúng lúc 09:00 MMT
 */
function setupMorningAttendanceSummaryTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "sendMonthlyAttendanceSummaryToControl") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("sendMonthlyAttendanceSummaryToControl")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .inTimezone("Asia/Rangoon")
    .create();
  Logger.log("✅ Đã thiết lập trigger tự động gửi báo cáo buổi sáng lúc 09:00 MMT sang nhóm CONTROL.");
}


// ═══════════════════════════════════════════════════════════════════
// ── DAILY ATTENDANCE REPORT 09:00 MMT — DELETE OLD → SEND NEW ──
// ═══════════════════════════════════════════════════════════════════

/**
 * Builds formatted attendance report text (4 lines per person):
 *   ✅ Work / 🏖️ Leave / 🌓 Half Day / 📷 Photo — each as Today/Yest/Day-3/Week/Month
 * @param {string} targetTeam - "ALL" for CONTROL, or "Team 1"/"Team 2"/etc. for team groups
 */
function buildDailyAttendanceText_(targetTeam) {
  const ss  = SpreadsheetApp.openById("18zQB4i0Fu4QfKKkkUZUd6SKWIEbdWDiwdpgNSaL9v54");
  const tz  = "Asia/Rangoon";
  const now = new Date();

  const todayStr  = Utilities.formatDate(now, tz, "dd/MM/yyyy");
  const dateShort = Utilities.formatDate(now, tz, "dd/MM/yy");
  const yestDate  = new Date(now.getTime() - 86400000);
  const day2Date  = new Date(now.getTime() - 2 * 86400000);
  const yestStr   = Utilities.formatDate(yestDate, tz, "dd/MM/yyyy");
  const day2Str   = Utilities.formatDate(day2Date, tz, "dd/MM/yyyy");
  const curMonthStr = Utilities.formatDate(now, tz, "MM/yyyy");

  // Week start = Monday of current week
  const dow = now.getDay(); // 0=Sun
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  const weekStart = new Date(now.getTime() - daysSinceMon * 86400000);
  weekStart.setHours(0, 0, 0, 0);

  // ── Helper: parse date string dd/MM/yy or dd/MM/yyyy ──
  function parseDateStr(raw) {
    if (raw instanceof Date) return raw;
    const s = String(raw || "").trim().split(" ")[0];
    const p = s.split(/[\/\-\.]/);
    if (p.length < 3) return null;
    let day = parseInt(p[0], 10), mon = parseInt(p[1], 10), yr = parseInt(p[2], 10);
    if (yr < 100) yr += 2000;
    return new Date(yr, mon - 1, day);
  }

  function toDateStr(d) {
    if (!d) return "";
    return Utilities.formatDate(d, tz, "dd/MM/yyyy");
  }

  function toMonthStr(d) {
    if (!d) return "";
    return Utilities.formatDate(d, tz, "MM/yyyy");
  }

  // ── 1. Load staff from Staff attendance (col A=TgId, F=FullName, C=TgName, K=Dep, M=TeamNo) ──
  const staffSheet = ss.getSheetByName("Staff attendance");
  const staffList  = [];
  const notJoined  = [];

  if (staffSheet && staffSheet.getLastRow() >= 2) {
    const vals = staffSheet.getRange(2, 1, staffSheet.getLastRow() - 1, 13).getValues();
    for (let i = 0; i < vals.length; i++) {
      const row   = vals[i];
      const tgId  = String(row[0] || "").trim();
      const name  = String(row[5] || row[2] || "").trim();   // F=FullName or C=TgName
      const dep   = String(row[10] || "").trim();            // K=Dep
      const teamM = String(row[12] || "").trim();            // M=TeamNo (Team 01, Team 02, HR and Finance...)
      if (!name || name.toLowerCase().indexOf("nyi nyi") !== -1) continue;

      const team = teamM || dep || "Office";

      // Filter by target team
      if (targetTeam !== "ALL") {
        const teamLow = team.toLowerCase().replace(/\s+/g, "");
        const tgtLow  = targetTeam.toLowerCase().replace(/\s+/g, "");
        if (teamLow !== tgtLow && team !== targetTeam) continue;
      }

      if (!tgId) notJoined.push(name + " (" + team + ")");
      staffList.push({ name: name, team: team, tgId: tgId });
    }
  }

  // ── 2. Load attendance from "Sum report morning attendance" ──
  function initAtt() {
    return { tW: 0, tL: 0, tH: 0, tLt: 0, tNR: 0,
             yW: 0, yL: 0, yH: 0, yLt: 0, yNR: 0,
             d2W: 0, d2L: 0, d2H: 0, d2Lt: 0, d2NR: 0,
             wkW: 0, wkL: 0, wkH: 0, moW: 0, moL: 0, moH: 0 };
    // tLt = Late (photo 08:40-09:00), tNR = Take Leave Not Report (no photo before 09:00, no leave text)
  }
  const attMap = {};
  const sumSheet = ss.getSheetByName("Sum report morning attendance");
  if (sumSheet && sumSheet.getLastRow() >= 2) {
    const rVals = sumSheet.getRange(2, 1, sumSheet.getLastRow() - 1, 8).getValues();
    for (let i = 0; i < rVals.length; i++) {
      const r     = rVals[i];
      const name  = String(r[2] || "").trim().toLowerCase();
      if (!name) continue;
      const isW   = String(r[3] || "").trim().toLowerCase() === "work";
      const isL   = String(r[4] || "").trim().toLowerCase() === "take leave";
      const isH   = String(r[5] || "").trim().toLowerCase().indexOf("half") !== -1;
      const dObj  = parseDateStr(r[1]);
      if (!dObj) continue;
      const dStr  = toDateStr(dObj);
      const mStr  = toMonthStr(dObj);

      if (!attMap[name]) attMap[name] = initAtt();
      const a = attMap[name];
      if (dStr === todayStr) { if (isW) a.tW++; if (isL) a.tL++; if (isH) a.tH++; }
      if (dStr === yestStr)  { if (isW) a.yW++; if (isL) a.yL++; if (isH) a.yH++; }
      if (dStr === day2Str)  { if (isW) a.d2W++; if (isL) a.d2L++; if (isH) a.d2H++; }
      if (dObj >= weekStart) { if (isW) a.wkW++; if (isL) a.wkL++; if (isH) a.wkH++; }
      if (mStr === curMonthStr) { if (isW) a.moW++; if (isL) a.moL++; if (isH) a.moH++; }
    }
  }

  // ── 3. Load photo counts + Auto-inject Work / Late / Not Report from List Attendance ──
  // Rule PM-ATT-01: Photo trước 08:40 sáng → Work (✅)
  // Rule PM-ATT-02: Photo 08:40-09:00 sáng → Late (⏰ Working Late), tính là có mặt nhưng muộn
  // Rule PM-ATT-03: Không có photo trước 09:00 VÀ không có text Take Leave → Not Report (❌ Leave Not Report)
  //   - Nếu đã có "Take Leave" / "Half Day" text → ưu tiên Leave, KHÔNG tính Not Report
  function initPh() {
    return { tP: 0, yP: 0, d2P: 0, wkP: 0, moP: 0 };
  }
  const photoMap = {};
  // Track first-best photo per (nameLow|dateStr): "early" (<08:40) > "late" (08:40-09:00) > "after"
  var bestPhotoSlot = {};  // value: "early" | "late" | "after"

  const listSheet = ss.getSheetByName("List Attendance");
  if (listSheet && listSheet.getLastRow() >= 2) {
    const lVals = listSheet.getRange(2, 1, listSheet.getLastRow() - 1, 7).getValues();
    for (let i = 0; i < lVals.length; i++) {
      const r        = lVals[i];
      const tgId     = String(r[3] || "").trim();
      const nameLow  = String(r[5] || r[4] || "").trim().toLowerCase();
      const photoUrl = String(r[6] || "").trim();
      if (!photoUrl) continue;
      const phKey = tgId || nameLow;
      if (!phKey) continue;
      const dObj = parseDateStr(r[1]);
      if (!dObj) continue;
      const dStr = toDateStr(dObj);
      const mStr = toMonthStr(dObj);

      // ── Photo count (all times) for 📷 Photo row ──
      if (!photoMap[phKey]) photoMap[phKey] = initPh();
      const p = photoMap[phKey];
      if (dStr === todayStr) p.tP++;
      if (dStr === yestStr)  p.yP++;
      if (dStr === day2Str)  p.d2P++;
      if (dObj >= weekStart) p.wkP++;
      if (mStr === curMonthStr) p.moP++;

      // ── Classify photo time slot ──
      var timeRaw   = String(r[2] || "").trim();   // Col C: "HH:mm"
      var tParts    = timeRaw.match(/^(\d{1,2}):(\d{2})/);
      var photoHour = tParts ? parseInt(tParts[1], 10) : 99;
      var photoMin  = tParts ? parseInt(tParts[2], 10) : 99;
      // Slot: "early" = before 08:40 | "late" = 08:40-08:59 | "after" = 09:00+
      var slot = (photoHour < 8 || (photoHour === 8 && photoMin < 40)) ? "early"
               : (photoHour === 8 && photoMin >= 40) ? "late"
               : "after";

      var attKey = nameLow;
      if (!attKey) continue;
      var dayKey = attKey + "|" + dStr;

      // Keep best slot per person per day (early > late > after)
      var prevSlot = bestPhotoSlot[dayKey];
      if (prevSlot === "early") continue;  // Already have best slot, skip
      if (prevSlot === "late" && slot !== "early") continue;
      bestPhotoSlot[dayKey] = slot;

      if (!attMap[attKey]) attMap[attKey] = initAtt();
      var a = attMap[attKey];

      if (slot === "early") {
        // ── Work: inject only if NO Leave/Half text report ──
        if (dStr === todayStr && a.tL === 0 && a.tH === 0 && a.tW === 0) { a.tW = 1; a.tLt = 0; }
        if (dStr === yestStr  && a.yL === 0 && a.yH === 0 && a.yW === 0) { a.yW = 1; a.yLt = 0; }
        if (dStr === day2Str  && a.d2L === 0 && a.d2H === 0 && a.d2W === 0) { a.d2W = 1; a.d2Lt = 0; }
        if (dObj >= weekStart && a.wkL === 0 && a.wkH === 0) a.wkW++;
        if (mStr === curMonthStr && a.moL === 0 && a.moH === 0) a.moW++;

      } else if (slot === "late") {
        // ── Late (Working Late 08:40-08:59): only if NO Leave/Half text, and no early Work yet ──
        if (dStr === todayStr && a.tL === 0 && a.tH === 0 && a.tW === 0) a.tLt = 1;
        if (dStr === yestStr  && a.yL === 0 && a.yH === 0 && a.yW === 0) a.yLt = 1;
        if (dStr === day2Str  && a.d2L === 0 && a.d2H === 0 && a.d2W === 0) a.d2Lt = 1;
        // Late also counts toward week/month work (present but late)
        if (dObj >= weekStart && a.wkL === 0 && a.wkH === 0) a.wkW++;
        if (mStr === curMonthStr && a.moL === 0 && a.moH === 0) a.moW++;
      }
      // slot === "after": photo after 09:00 = not counted as Work or Late
    }
  }

  // ── 3b. Inject "Not Report" for staff with NO photo before 09:00 and NO Leave/Half text ──
  // Loop runs AFTER photoMap + attMap are fully populated above
  // "Not Report" = today: no early/late photo, no Leave text → tNR = 1
  // Only applies to TODAY (todayStr) since for past days we cannot determine staff presence
  for (var si = 0; si < staffList.length; si++) {
    var st    = staffList[si];
    var sKey  = st.name.toLowerCase();
    var phKey2 = st.tgId || sKey;
    var sAtt  = attMap[sKey];
    var sBest = bestPhotoSlot[sKey + "|" + todayStr];

    // Today Not Report: no early/late photo AND no Work/Leave/Half text
    if (!sBest || sBest === "after") {
      if (!sAtt) { attMap[sKey] = initAtt(); sAtt = attMap[sKey]; }
      if (sAtt.tW === 0 && sAtt.tL === 0 && sAtt.tH === 0 && sAtt.tLt === 0) sAtt.tNR = 1;
    }
    // Yesterday Not Report
    var sBestY = bestPhotoSlot[sKey + "|" + yestStr];
    if (!sBestY || sBestY === "after") {
      if (!sAtt) { attMap[sKey] = initAtt(); sAtt = attMap[sKey]; }
      if (sAtt.yW === 0 && sAtt.yL === 0 && sAtt.yH === 0 && sAtt.yLt === 0) sAtt.yNR = 1;
    }
    // Day-3 Not Report
    var sBestD2 = bestPhotoSlot[sKey + "|" + day2Str];
    if (!sBestD2 || sBestD2 === "after") {
      if (!sAtt) { attMap[sKey] = initAtt(); sAtt = attMap[sKey]; }
      if (sAtt.d2W === 0 && sAtt.d2L === 0 && sAtt.d2H === 0 && sAtt.d2Lt === 0) sAtt.d2NR = 1;
    }
  }

  // ── 4. Build message — Compact summary format ──
  const isAll = targetTeam === "ALL";
  const header = isAll
    ? "<b>📋 Attendance Report — " + dateShort + "</b>"
    : "<b>📋 Attendance Report — " + targetTeam + " — " + dateShort + "</b>";

  const lines = [
    header,
    "<i>Today / Yest / Day-3</i>",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  ];

  // Group by team
  const teamGroups = {};
  const teamOrder  = [];
  for (let s = 0; s < staffList.length; s++) {
    const t = staffList[s].team;
    if (!teamGroups[t]) { teamGroups[t] = []; teamOrder.push(t); }
    teamGroups[t].push(staffList[s]);
  }

  const teamIcons = {
    "Team 1": "🟠", "Team 01": "🟠",
    "Team 2": "🔵", "Team 02": "🔵",
    "Team 3": "🟢", "Team 03": "🟢",
    "Team 4": "🟡", "Team 04": "🟡",
    "Office": "🏢", "HR and Finance": "🏢", "Infrastructure": "🏢",
    "CM Engineer": "🏢", "PM Engineer": "🏢", "M&E Engineer": "🏢"
  };

  for (let ti = 0; ti < teamOrder.length; ti++) {
    const tName   = teamOrder[ti];
    const icon    = teamIcons[tName] || "🔹";
    const members = teamGroups[tName];

    // ── Classify each member by TODAY's status ──
    const grpWork  = [];  // ✅ Work (on time)
    const grpLate  = [];  // ⏰ Late (08:40–09:00)
    const grpLeave = [];  // 🏖️ Take Leave
    const grpHalf  = [];  // 🌓 Half Day
    const grpNR    = [];  // ❌ Not Report (Leave Not Report)

    for (let m = 0; m < members.length; m++) {
      const st  = members[m];
      const key = st.name.toLowerCase();
      const att = attMap[key] || initAtt();

      if      (att.tL  > 0) grpLeave.push(st.name);
      else if (att.tH  > 0) grpHalf.push(st.name);
      else if (att.tW  > 0) grpWork.push(st.name);
      else if (att.tLt > 0) grpLate.push(st.name);
      else                   grpNR.push(st.name);
    }

    const total = members.length;
    lines.push(icon + " <b>" + tName.toUpperCase() + "</b> (" + total + " members)");

    if (grpWork.length  > 0) lines.push("   ✅ Work (" + grpWork.length + "): "  + grpWork.join(", "));
    if (grpLate.length  > 0) lines.push("   ⏰ Late (" + grpLate.length + "): "  + grpLate.join(", "));
    if (grpHalf.length  > 0) lines.push("   🌓 Half Day (" + grpHalf.length + "): " + grpHalf.join(", "));
    if (grpLeave.length > 0) lines.push("   🏖️ Take Leave (" + grpLeave.length + "): " + grpLeave.join(", "));
    if (grpNR.length    > 0) lines.push("   ❌ Not Report (" + grpNR.length + "): " + grpNR.join(", "));

    // ── Yest / Day-3 summary per member (compact: name: W/L/NR) ──
    const yestLines  = [];
    const day2Lines  = [];
    for (let m = 0; m < members.length; m++) {
      const st  = members[m];
      const key = st.name.toLowerCase();
      const att = attMap[key] || initAtt();
      const phKey = st.tgId || key;
      const ph  = photoMap[phKey] || initPh();

      // Yest status
      const yStatus = att.yL > 0 ? "🏖️" : att.yH > 0 ? "🌓" : att.yW > 0 ? "✅" : att.yLt > 0 ? "⏰" : att.yNR > 0 ? "❌" : "—";
      // Day-3 status
      const d2Status = att.d2L > 0 ? "🏖️" : att.d2H > 0 ? "🌓" : att.d2W > 0 ? "✅" : att.d2Lt > 0 ? "⏰" : att.d2NR > 0 ? "❌" : "—";

      yestLines.push(st.name + ":" + yStatus);
      day2Lines.push(st.name + ":" + d2Status);
    }
    lines.push("   <i>Yest: " + yestLines.join(" | ") + "</i>");
    lines.push("   <i>Day-3: " + day2Lines.join(" | ") + "</i>");
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Not joined (CONTROL only, bottom)
  if (isAll && notJoined.length > 0) {
    lines.push("⚠️ <b>Not yet joined (" + notJoined.length + "):</b>");
    for (let n = 0; n < notJoined.length; n++) {
      lines.push("  " + (n + 1) + ". " + notJoined[n]);
    }
  }

  return lines.join("\n");
}

/** Delete a Telegram message silently */
function deleteTgMessage_(token, chatId, messageId) {
  if (!messageId) return;
  try {
    UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/deleteMessage", {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, message_id: Number(messageId) }),
      muteHttpExceptions: true
    });
  } catch(e) { Logger.log("deleteTgMessage_ error: " + e.message); }
}

/** Send HTML message and return message_id */
function sendTgMsgGetId_(token, chatId, text) {
  try {
    const resp = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "HTML", disable_web_page_preview: true }),
      muteHttpExceptions: true
    });
    const data = JSON.parse(resp.getContentText());
    if (data.ok && data.result) return data.result.message_id;
    Logger.log("sendTgMsgGetId_ failed: " + resp.getContentText());
  } catch(e) { Logger.log("sendTgMsgGetId_ error: " + e.message); }
  return null;
}

/**
 * 09:00 MMT — Delete old attendance report → send new one to CONTROL + all team groups
 */
function sendDailyAttendanceReport() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SEND_BOT_TOKEN") || "8628370628:AAE43wwogCzuFDKc0izu5DEuqlkud7ID7Sw";

  const TARGETS = [
    { key: "att09_control", chatId: "-5251698940",    team: "ALL"     },
    { key: "att09_team1",   chatId: "-1004215695747", team: "Team 01" },
    { key: "att09_team2",   chatId: "-1004480845549", team: "Team 02" },
    { key: "att09_team3",   chatId: "-1004369170658", team: "Team 03" },
    { key: "att09_team4",   chatId: "-1004293741999", team: "Team 04" }
  ];

  for (let t = 0; t < TARGETS.length; t++) {
    const tgt = TARGETS[t];
    try {
      // 1. Delete old message
      const oldId = props.getProperty(tgt.key + "_mid");
      if (oldId) { deleteTgMessage_(token, tgt.chatId, oldId); }

      // 2. Build & send
      const text = buildDailyAttendanceText_(tgt.team);
      if (!text) continue;
      const newId = sendTgMsgGetId_(token, tgt.chatId, text);
      if (newId) {
        props.setProperty(tgt.key + "_mid", String(newId));
      }
      Utilities.sleep(600); // Rate limit buffer
    } catch(e) {
      Logger.log("sendDailyAttendanceReport [" + tgt.chatId + "] error: " + e.message);
    }
  }
  Logger.log("✅ sendDailyAttendanceReport completed at " +
    Utilities.formatDate(new Date(), "Asia/Rangoon", "dd/MM/yyyy HH:mm"));
}

/**
 * Cài đặt trigger 09:00 MMT cho sendDailyAttendanceReport
 * Xóa trigger cũ sendMonthlyAttendanceSummaryToControl
 */
function setupDailyAttendanceReportTrigger() {
  const OLD_HANDLER = "sendMonthlyAttendanceSummaryToControl";
  const NEW_HANDLER = "sendDailyAttendanceReport";
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    const fn = triggers[i].getHandlerFunction();
    if (fn === OLD_HANDLER || fn === NEW_HANDLER) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger(NEW_HANDLER)
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .nearMinute(0)
    .inTimezone("Asia/Rangoon")
    .create();
  Logger.log("✅ Daily attendance report trigger set for 09:00 MMT → sendDailyAttendanceReport");
}
