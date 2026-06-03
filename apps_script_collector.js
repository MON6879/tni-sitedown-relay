// ============================================================
// TNI Asset Collector — Google Apps Script
// ============================================================
// Deploy as Web App:
//   Execute as: Me | Who has access: Anyone
// ============================================================

const SHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8";

// Tab where collected data is stored (gid = 199426270)
const DATA_TAB  = "Asset order and request";

// Tab where authorised users are listed (gid = 1236389870)
// Layout: Col A = Field Name (existing)  |  Col B = Name  |  Col C = Telegram ID
const CFG_TAB   = "Config";

// ============================================================
// ENTRY POINTS
// ============================================================

function doPost(e) {
  try {
    const body  = JSON.parse(e.postData.contents);
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getDataSheet(ss);

    if (body.action === "add")  return handleAdd(sheet, body);
    if (body.action === "done") return handleDone(sheet, ss, body);

    return json({ status: "error", message: "Unknown action: " + body.action });
  } catch (err) {
    return json({ status: "error", message: err.message });
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    getDataSheet(ss);           // ensure data tab exists
    setupConfigHeaders(ss);     // ensure Config has B & C headers
    const ids = getAllowedIds(ss);
    return json({ status: "ok", message: "TNI Collector running", allowed: ids.size });
  } catch (err) {
    return json({ status: "error", message: err.message });
  }
}

// ============================================================
// ACTION: ADD — write new row to data sheet
// Payload: { action, date, chat_id, msg }
// Sheet columns: A=Date Sent  B=Telegram ID  C=Content  D=Asset action done
// ============================================================

function handleAdd(sheet, body) {
  const row = [
    body.date    || "",   // A: Date Sent
    body.chat_id || "",   // B: Telegram ID
    body.msg     || "",   // C: Content
    ""                    // D: Asset action done (empty until Done)
  ];

  sheet.appendRow(row);

  const rowNum = sheet.getLastRow();
  const seqId  = rowNum - 1;   // sequential ID (excludes header row)

  // Zebra striping
  const bg = seqId % 2 === 0 ? "#EBF3FB" : "#FFFFFF";
  sheet.getRange(rowNum, 1, 1, 4).setBackground(bg);

  return json({ status: "ok", message: "Row added", row: seqId });
}

// ============================================================
// ACTION: DONE — fill column D for a specific row
// Payload: { action, ref_id, done_date, done_time, chat_id }
// Only allowed Telegram IDs (from Config col C) can do this.
// ============================================================

function handleDone(sheet, ss, body) {
  const doerId = String(body.chat_id || "").trim();
  const refId  = parseInt(body.ref_id);

  // Validate ref_id
  if (!refId || isNaN(refId)) {
    return json({ status: "error", message: "Invalid ref_id: " + body.ref_id });
  }

  // Authorisation check
  const allowed = getAllowedIds(ss);
  if (allowed.size > 0 && !allowed.has(doerId)) {
    return json({
      status:  "denied",
      message: "Telegram ID " + doerId + " is not authorised."
    });
  }

  // Find the target row (header = row 1, so data row N = row N+1)
  const targetRow = refId + 1;
  const lastRow   = sheet.getLastRow();

  if (targetRow < 2 || targetRow > lastRow) {
    return json({
      status:  "error",
      message: "Request #" + refId + " not found. Last ID is #" + (lastRow - 1) + "."
    });
  }

  // Build done text for column D
  const doneDate = body.done_date || "";
  const doneTime = body.done_time || "";
  const doneText = "✅ Done — " + doneDate + " " + doneTime + (doerId ? " (ID:" + doerId + ")" : "");

  sheet.getRange(targetRow, 4)
       .setValue(doneText)
       .setBackground("#D9EAD3")
       .setFontColor("#137333")
       .setFontWeight("bold");

  return json({ status: "ok", message: "Done updated", row: refId });
}

// ============================================================
// HELPERS
// ============================================================

// Get or create the data sheet
function getDataSheet(ss) {
  let sheet = ss.getSheetByName(DATA_TAB);

  // Try finding by GID if name not found
  if (!sheet) {
    for (const s of ss.getSheets()) {
      if (s.getSheetId().toString() === "199426270") { sheet = s; break; }
    }
  }

  // Create new tab if still not found
  if (!sheet) sheet = ss.insertSheet(DATA_TAB);

  // Add headers if sheet is empty
  if (sheet.getLastRow() === 0) {
    const headers = ["Date Sent", "Telegram ID", "Content", "Asset action done"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, 4)
         .setFontWeight("bold")
         .setBackground("#4472C4")
         .setFontColor("#FFFFFF")
         .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 170);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 420);
    sheet.setColumnWidth(4, 220);
    SpreadsheetApp.flush();
  }

  return sheet;
}

// Read allowed Telegram IDs from Config tab, column C
function getAllowedIds(ss) {
  let cfg = ss.getSheetByName(CFG_TAB);
  if (!cfg) {
    for (const s of ss.getSheets()) {
      if (s.getSheetId().toString() === "1236389870") { cfg = s; break; }
    }
  }
  if (!cfg || cfg.getLastRow() < 2) return new Set();

  const rows = cfg.getRange(2, 1, cfg.getLastRow() - 1, 3).getValues();
  return new Set(
    rows
      .map(r => String(r[2]).trim())          // column C = Telegram ID
      .filter(v => /^\d+$/.test(v))           // only numeric strings
  );
}

// Ensure Config tab has headers in col B and C
function setupConfigHeaders(ss) {
  let cfg = ss.getSheetByName(CFG_TAB);
  if (!cfg) return;

  const maxCol = Math.max(cfg.getLastColumn(), 3);
  const row1   = cfg.getRange(1, 1, 1, maxCol).getValues()[0];

  if (!row1[1] || row1[1].toString().trim() === "") {
    cfg.getRange(1, 2).setValue("Name")
       .setFontWeight("bold").setBackground("#4472C4")
       .setFontColor("#FFFFFF").setHorizontalAlignment("center");
    cfg.setColumnWidth(2, 200);
  }
  if (!row1[2] || row1[2].toString().trim() === "") {
    cfg.getRange(1, 3).setValue("Telegram ID")
       .setFontWeight("bold").setBackground("#4472C4")
       .setFontColor("#FFFFFF").setHorizontalAlignment("center");
    cfg.setColumnWidth(3, 160);
  }
  SpreadsheetApp.flush();
}

// JSON response helper
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
