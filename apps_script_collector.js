// ================================================================
// PASTE TOÀN BỘ CODE NÀY VÀO GOOGLE APPS SCRIPT (thay thế cũ)
// ================================================================

const SHEET_ID      = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8";
const COLLECTOR_TAB = "Collector";   // Tab chứa dữ liệu
const CONFIG_TAB    = "Config";      // Tab chứa danh sách keyword

// Cột cố định (luôn có)
const FIXED_COLS    = ["STT", "Ngày", "Giờ", "Tên NV", "Username", "Chat ID"];
const DONE_COLS     = ["Done", "Ngày Done", "Giờ Done"];

// ================================================================
// ĐỌC DANH SÁCH KEYWORD TỪ TAB CONFIG
// ================================================================
function getKeywords(ss) {
  let configSheet = ss.getSheetByName(CONFIG_TAB);

  // Tự tạo tab Config nếu chưa có
  if (!configSheet) {
    configSheet = ss.insertSheet(CONFIG_TAB);
    configSheet.getRange("A1").setValue("Field Name");
    configSheet.getRange("A1").setFontWeight("bold")
               .setBackground("#4472C4").setFontColor("#FFFFFF");
    configSheet.getRange("A2:A5").setValues([
      ["Order"], ["Revoke"], ["Export"], ["Move"]
    ]);
    SpreadsheetApp.flush();
  }

  const lastRow = configSheet.getLastRow();
  if (lastRow < 2) return ["Order", "Revoke", "Export", "Move"];

  const values = configSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  return values
    .map(r => r[0].toString().trim())
    .filter(k => k !== "");
}

// ================================================================
// ĐẢM BẢO HEADER ĐÚNG VỚI CONFIG HIỆN TẠI
// ================================================================
function ensureHeader(sheet, keywords) {
  const headers = [...FIXED_COLS, ...keywords, ...DONE_COLS];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight("bold")
         .setBackground("#4472C4")
         .setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  } else {
    // Cập nhật header nếu có keyword mới
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const currentHeaders = current.map(h => h.toString().trim()).filter(h => h !== "");

    keywords.forEach(kw => {
      if (!currentHeaders.includes(kw)) {
        // Chèn cột mới trước cột Done
        const doneIdx = currentHeaders.indexOf("Done");
        const insertAt = doneIdx >= 0 ? doneIdx + 1 : sheet.getLastColumn() + 1;
        sheet.insertColumnBefore(insertAt);
        sheet.getRange(1, insertAt).setValue(kw)
             .setFontWeight("bold").setBackground("#4472C4").setFontColor("#FFFFFF");
        currentHeaders.splice(insertAt - 1, 0, kw);
      }
    });
  }

  return [...FIXED_COLS, ...keywords, ...DONE_COLS];
}

// ================================================================
// HÀM CHÍNH — nhận POST từ Bot
// ================================================================
function doPost(e) {
  try {
    const data    = JSON.parse(e.postData.contents);
    const ss      = SpreadsheetApp.openById(SHEET_ID);
    const sheet   = ss.getSheetByName(COLLECTOR_TAB) || ss.getSheets()[0];
    const keywords = getKeywords(ss);
    const headers  = ensureHeader(sheet, keywords);

    if (data.action === "config") return respondConfig(keywords);
    if (data.action === "done")   return handleDone(sheet, headers, data);
    if (data.action === "add")    return handleAdd(sheet, headers, keywords, data);

    return respond("error", "Unknown action");
  } catch (err) {
    return respond("error", err.message);
  }
}

// ================================================================
// GET — trả về danh sách keyword (bot gọi để đồng bộ)
// ================================================================
function doGet(e) {
  try {
    const ss       = SpreadsheetApp.openById(SHEET_ID);
    const keywords = getKeywords(ss);
    return respondConfig(keywords);
  } catch (err) {
    return respond("error", err.message);
  }
}

function respondConfig(keywords) {
  return respond("ok", "Config loaded", { keywords: keywords });
}

// ================================================================
// THÊM DÒNG MỚI
// ================================================================
function handleAdd(sheet, headers, keywords, data) {
  const rowNum = sheet.getLastRow() + 1;
  const stt    = rowNum - 1;

  const row = headers.map(h => {
    if (h === "STT")       return stt;
    if (h === "Ngày")      return data.date        || "";
    if (h === "Giờ")       return data.time        || "";
    if (h === "Tên NV")    return data.sender_name || "";
    if (h === "Username")  return data.username    || "";
    if (h === "Chat ID")   return data.chat_id     || "";
    if (DONE_COLS.includes(h)) return "";
    // Keyword động
    return (data.fields && data.fields[h.toLowerCase()]) || "";
  });

  sheet.appendRow(row);

  const color = stt % 2 === 0 ? "#EBF3FB" : "#FFFFFF";
  sheet.getRange(rowNum, 1, 1, headers.length).setBackground(color);

  return respond("ok", "Row added", { row: stt });
}

// ================================================================
// CẬP NHẬT DONE
// ================================================================
function handleDone(sheet, headers, data) {
  const refId   = parseInt(data.ref_id);
  if (!refId) return respond("error", "ref_id không hợp lệ");

  const doneCol     = headers.indexOf("Done")      + 1;
  const doneDateCol = headers.indexOf("Ngày Done")  + 1;
  const doneTimeCol = headers.indexOf("Giờ Done")   + 1;
  const lastRow     = sheet.getLastRow();

  for (let r = 2; r <= lastRow; r++) {
    if (parseInt(sheet.getRange(r, 1).getValue()) === refId) {
      sheet.getRange(r, doneCol).setValue(data.done || "Done");
      sheet.getRange(r, doneDateCol).setValue(data.done_date || "");
      sheet.getRange(r, doneTimeCol).setValue(data.done_time || "");
      sheet.getRange(r, doneCol, 1, 3).setBackground("#D9EAD3");
      return respond("ok", "Done updated", { row: refId });
    }
  }
  return respond("error", "Không tìm thấy dòng #" + refId);
}

// ================================================================
// HELPER
// ================================================================
function respond(status, message, extra) {
  const payload = Object.assign({ status, message }, extra || {});
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
