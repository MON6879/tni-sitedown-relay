// ============================================================
// 10-MINUTE SCANNER FOR BOD ASSIGN CHECKS
// ============================================================

function checkBodAssign() {
  try {
    const ss = SpreadsheetApp.openById("1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8");
    const sheet = ss.getSheetByName("BOD assign");
    if (!sheet) {
      Logger.log("❌ Không tìm thấy sheet 'BOD assign'");
      return;
    }
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty("SEND_BOT_TOKEN") || "8897800070:AAHcG2eHlPsE0KpZAGjcFTe7ndn8gjpQi-A";
    const controlChatId = "-5251698940";

    const todayStr = Utilities.formatDate(new Date(), "Asia/Rangoon", "dd/MM/yyyy");
    const sentControlKey = "BOD_INDIV_CONTROL_SENT_" + todayStr;
    const sentTeamKey = "BOD_INDIV_TEAM_SENT_" + todayStr;

    let sentControlRows = [];
    let sentTeamRows = [];
    try { sentControlRows = JSON.parse(props.getProperty(sentControlKey) || "[]"); } catch(e) {}
    try { sentTeamRows = JSON.parse(props.getProperty(sentTeamKey) || "[]"); } catch(e) {}

    // Đọc từ dòng 2 đến lastRow, các cột từ A đến V (22 cột)
    const range = sheet.getRange(2, 1, lastRow - 1, 22);
    const values = range.getValues();

    let newControlSent = false;
    let newTeamSent = false;

    for (let i = 0; i < values.length; i++) {
      const rowNum = i + 2;
      const row = values[i];
      
      const dateVal = row[3]; // Cột D: Date Assign (index 3)
      let dateStr = "";
      if (dateVal instanceof Date) {
        dateStr = Utilities.formatDate(dateVal, "Asia/Rangoon", "dd/MM/yyyy");
      } else {
        dateStr = String(dateVal || "").trim();
      }
      
      // Chuẩn hóa ngày để so sánh linh hoạt (hỗ trợ dd/mm/yyyy, d/m/yyyy, dd.mm.yyyy, yyyy-mm-dd)
      let isToday = false;
      if (dateVal instanceof Date) {
        isToday = (Utilities.formatDate(dateVal, "Asia/Rangoon", "dd/MM/yyyy") === todayStr);
      } else if (dateStr) {
        const m = dateStr.match(/(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})/);
        if (m) {
          const d = m[1].padStart(2, "0");
          const mo = m[2].padStart(2, "0");
          const y = m[3].length === 2 ? "20" + m[3] : m[3];
          isToday = (`${d}/${mo}/${y}` === todayStr);
        } else {
          isToday = (dateStr.indexOf(todayStr) !== -1);
        }
      }
      // Nếu có nội dung task mà ngày trống -> mặc định coi là công việc hôm nay
      if (!dateStr && (row[0] || row[1] || row[2])) {
        isToday = true;
      }
      if (!isToday) {
        continue;
      }

      const colA = String(row[0] || "").trim(); // Cột A (Role/Dep)
      const colB = String(row[1] || "").trim(); // Cột B (PIC)
      const colC = String(row[2] || "").trim(); // Cột C (Task Content)
      const colR = String(row[17] || "").trim(); // Cột R (index 17)
      const colT = String(row[19] || "").trim(); // Cột T (index 19)
      const colU = String(row[20] || "").trim(); // Cột U (index 20)

      const notifyContent = colR || (`${colA} - ${colB}: ${colC}`.trim());

      // 1. Quét gửi Control
      if (notifyContent && sentControlRows.indexOf(rowNum) === -1) {
        const msgText = "📋 BOD assign New task: " + notifyContent;
        
        // Tự động tìm và xóa tin cũ cùng nội dung trên Control
        const oldMsgKey = "BOD_MSG_ID_CONTROL_" + colR.toUpperCase().replace(/\s+/g, "");
        const oldMsgId = props.getProperty(oldMsgKey);
        if (oldMsgId) {
          try {
            UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/deleteMessage", {
              method: "post",
              contentType: "application/json",
              payload: JSON.stringify({ chat_id: controlChatId, message_id: parseInt(oldMsgId, 10) }),
              muteHttpExceptions: true
            });
          } catch (eDel) {
            Logger.log("⚠️ Lỗi xóa tin cũ Control: " + eDel.message);
          }
        }

        const payload = {
          chat_id: controlChatId,
          text: msgText,
          reply_markup: {
            inline_keyboard: [[
              { text: "✔️ Receive Task", callback_data: "ack_bod_task_" + rowNum }
            ]]
          }
        };
        
        const newMsgId = sendTelegramMessage_(token, payload);
        if (newMsgId) {
          props.setProperty(oldMsgKey, String(newMsgId));
          sentControlRows.push(rowNum);
          newControlSent = true;
        }
      }

      // 2. Quét gửi Team
      if (colT && sentTeamRows.indexOf(rowNum) === -1) {
        const msgText = "New assing task: " + colT;
        
        // --- Gửi cho Control ---
        const oldControlMsgKey = "BOD_MSG_ID_CONTROL_TEAM_" + colU.toUpperCase().replace(/\s+/g, "") + "_" + colT.toUpperCase().replace(/\s+/g, "");
        const oldControlMsgId = props.getProperty(oldControlMsgKey);
        if (oldControlMsgId) {
          try {
            UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/deleteMessage", {
              method: "post",
              contentType: "application/json",
              payload: JSON.stringify({ chat_id: controlChatId, message_id: parseInt(oldControlMsgId, 10) }),
              muteHttpExceptions: true
            });
          } catch (eDel) {
            Logger.log("⚠️ Lỗi xóa tin cũ Team-on-Control: " + eDel.message);
          }
        }

        const controlPayload = {
          chat_id: controlChatId,
          text: msgText + (colU ? " (" + colU + ")" : ""),
          reply_markup: {
            inline_keyboard: [[
              { text: "✔️ Receive Task", callback_data: "ack_bod_task_" + rowNum }
            ]]
          }
        };

        const newControlMsgId = sendTelegramMessage_(token, controlPayload);
        if (newControlMsgId) {
          props.setProperty(oldControlMsgKey, String(newControlMsgId));
        }

        // --- Gửi cho Team ---
        const chatId = getTeamChatId_(colU);
        if (chatId) {
          // Tự động tìm và xóa tin cũ cùng nội dung trên Team
          const oldMsgKey = "BOD_MSG_ID_TEAM_" + colU.toUpperCase().replace(/\s+/g, "") + "_" + colT.toUpperCase().replace(/\s+/g, "");
          const oldMsgId = props.getProperty(oldMsgKey);
          if (oldMsgId) {
            try {
              UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/deleteMessage", {
                method: "post",
                contentType: "application/json",
                payload: JSON.stringify({ chat_id: chatId, message_id: parseInt(oldMsgId, 10) }),
                muteHttpExceptions: true
              });
            } catch (eDel) {
              Logger.log("⚠️ Lỗi xóa tin cũ Team: " + eDel.message);
            }
          }

          const payload = {
            chat_id: chatId,
            text: msgText,
            reply_markup: {
              inline_keyboard: [[
                { text: "✔️ Receive Task", callback_data: "ack_bod_task_" + rowNum }
              ]]
            }
          };
          
          const newMsgId = sendTelegramMessage_(token, payload);
          if (newMsgId) {
            props.setProperty(oldMsgKey, String(newMsgId));
            sentTeamRows.push(rowNum);
            newTeamSent = true;
          }
        } else {
          Logger.log("⚠️ Không tìm thấy chat ID cho team: " + colU);
          sentTeamRows.push(rowNum);
          newTeamSent = true;
        }
      }
    }

    if (newControlSent) {
      props.setProperty(sentControlKey, JSON.stringify(sentControlRows));
    }
    if (newTeamSent) {
      props.setProperty(sentTeamKey, JSON.stringify(sentTeamRows));
    }
  } catch (e) {
    Logger.log("❌ Lỗi checkBodAssign: " + e.message);
  }
}

function getTeamChatId_(teamStr) {
  if (!teamStr) return null;
  const ts = teamStr.toUpperCase().replace(/\s+/g, "");
  // Cập nhật ID theo nhóm Supergroup thực tế (có tiền tố -100...)
  if (ts.indexOf("TEAM01") !== -1 || ts.indexOf("TEAM1") !== -1) return "-1004215695747";
  if (ts.indexOf("TEAM02") !== -1 || ts.indexOf("TEAM2") !== -1 || ts.indexOf("TEAM05") !== -1 || ts.indexOf("TEAM5") !== -1) return "-1004480845549";
  if (ts.indexOf("TEAM03") !== -1 || ts.indexOf("TEAM3") !== -1) return "-1004369170658";
  if (ts.indexOf("TEAM04") !== -1 || ts.indexOf("TEAM4") !== -1) return "-1004293741999";
  return null;
}

function sendTelegramMessage_(token, payload) {
  try {
    const url = "https://api.telegram.org/bot" + token + "/sendMessage";
    const resp = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const res = JSON.parse(resp.getContentText());
    if (res.ok) {
      return res.result.message_id;
    } else {
      Logger.log("❌ Telegram API Error: " + res.description + " | Chat ID: " + payload.chat_id);
      return null;
    }
  } catch (e) {
    Logger.log("❌ Lỗi gửi Telegram: " + e.message);
    return null;
  }
}

function setupBodAssignTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === "checkBodAssign") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("checkBodAssign").timeBased().everyMinutes(1).create();
  Logger.log("✅ Đã cài trigger checkBodAssign chạy mỗi 1 phút.");
}

function debugBodAssign() {
  const ss = SpreadsheetApp.openById("1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8");
  const sheet = ss.getSheetByName("BOD assign");
  if (!sheet) {
    Logger.log("❌ Không tìm thấy sheet 'BOD assign'");
    return;
  }
  const lastRow = sheet.getLastRow();
  Logger.log("Dòng cuối cùng phát hiện: " + lastRow);
  if (lastRow < 2) return;

  const range = sheet.getRange(2, 1, lastRow - 1, 22);
  const values = range.getValues();
  Logger.log("Số dòng quét được: " + values.length);
  
  for (let i = 0; i < values.length; i++) {
    const rowNum = i + 2;
    const row = values[i];
    
    const colR = String(row[17] || "").trim(); 
    const colS = String(row[18] || "").trim(); 
    const colT = String(row[19] || "").trim(); 
    const colU = String(row[20] || "").trim(); 
    const colV = String(row[21] || "").trim(); 
    
    if (colR || colT) {
      Logger.log("Dòng " + rowNum + ": R='" + colR + "', S='" + colS + "', T='" + colT + "', U='" + colU + "', V='" + colV + "'");
    }
  }
}
