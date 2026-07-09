// ============================================================
// SYSTEM: Refuel Apps Script Collector
// Spreadsheet: https://docs.google.com/spreadsheets/d/1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM/edit
// Description: Đọc cột G của sheet Refuel và lưu trữ message_ids để xóa tin cũ.
// ============================================================

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";
    
    // 1. Đọc cột G của sheet Refuel
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
 * Đọc cột G (cột thứ 7), từ dòng thứ 2 đến cuối cùng của tab "Refuel"
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
  
  // Cột G là cột 7, đọc từ dòng 2 đến hết
  const values = sheet.getRange(2, 7, lastRow - 1, 1).getValues();
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
