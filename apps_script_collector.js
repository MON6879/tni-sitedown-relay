// ================================================================
// Google Apps Script — TNI Asset Collector
// ================================================================
// HOW TO DEPLOY:
//  1. Open script.google.com → paste this entire file
//  2. Deploy → New deployment → Web App
//     - Execute as: Me
//     - Who has access: Anyone
//  3. Copy the Web App URL → set as APPS_SCRIPT_URL in Vercel
// ================================================================

const SHEET_ID      = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8";
const COLLECTOR_GID = "199426270";            // gid of the data tab
const COLLECTOR_TAB = "Asset order and request"; // Tab name (must match gid above)
const CONFIG_TAB    = "Config";               // Tab listing allowed Telegram IDs

// ================================================================
// COLUMN LAYOUT (fixed — do not change order)
//  A : Date Sent       → datetime when user sent the command
//  B : Telegram ID     → numeric chat_id of sender
//  C : Content         → full message text
//  D : Asset action done → filled only by authorised IDs via "Done: #N"
// ================================================================
const HEADERS = ["Date Sent", "Telegram ID", "Content", "Asset action done"];

// ================================================================
// READ AUTHORISED TELEGRAM IDs FROM Config TAB
// Config tab layout (gid=1236389870):
//   Row 1: header → Col A: "Field Name", Col B: "Name", Col C: "Telegram ID"
//   Row 2+: Col A = keyword/field, Col B = display name, Col C = Telegram numeric ID
// Returns a Set of strings (Telegram IDs) for fast lookup.
// ================================================================
function getAllowedIds(ss) {
  let cfg = ss.getSheetByName(CONFIG_TAB);
  if (!cfg) {
    // Try by GID 1236389870
    for (const s of ss.getSheets()) {
      if (s.getSheetId().toString() === "1236389870") {
        cfg = s;
        break;
      }
    }
  }

  if (!cfg) return new Set(); // Config tab not found

  const lastRow = cfg.getLastRow();
  if (lastRow < 2) return new Set();

  // Read all 3 columns: A=Field Name, B=Name, C=Telegram ID
  const values = cfg.getRange(2, 1, lastRow - 1, 3).getValues();

  return new Set(
    values
      .map(r => r[2].toString().trim())   // Column C = Telegram ID
      .filter(v => v !== "" && /^\d+$/.test(v))  // only numeric IDs
  );
}

// ================================================================
// ADD HEADER COLUMNS B and C TO EXISTING CONFIG TAB IF MISSING
// Call this once to update an existing Config tab
// ================================================================
function ensureConfigHeaders(ss) {
  let cfg = ss.getSheetByName(CONFIG_TAB);
  if (!cfg) return;

  const lastCol = cfg.getLastColumn();
  const headers = cfg.getRange(1, 1, 1, Math.max(lastCol, 3)).getValues()[0];

  // Add col B header "Name" if missing
  if (!headers[1] || headers[1].toString().trim() === "") {
    cfg.getRange(1, 2).setValue("Name")
       .setFontWeight("bold")
       .setBackground("#4472C4")
       .setFontColor("#FFFFFF")
       .setHorizontalAlignment("center");
    cfg.setColumnWidth(2, 200);
  }

  // Add col C header "Telegram ID" if missing
  if (!headers[2] || headers[2].toString().trim() === "") {
    cfg.getRange(1, 3).setValue("Telegram ID")
       .setFontWeight("bold")
       .setBackground("#4472C4")
       .setFontColor("#FFFFFF")
       .setHorizontalAlignment("center");
    cfg.setColumnWidth(3, 160);
  }

  SpreadsheetApp.flush();
}

// ================================================================
// ENSURE HEADER ROW + FORMATTING
// ================================================================
function ensureHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    const hr = sheet.getRange(1, 1, 1, HEADERS.length);
    hr.setFontWeight("bold")
      .setBackground("#4472C4")
      .setFontColor("#FFFFFF")
      .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 170);  // A: Date Sent
    sheet.setColumnWidth(2, 150);  // B: Telegram ID
    sheet.setColumnWidth(3, 420);  // C: Content
    sheet.setColumnWidth(4, 200);  // D: Asset action done
    SpreadsheetApp.flush();
  }
}

// ================================================================
// GET COLLECTOR SHEET (create tab if missing)
// ================================================================
function getCollectorSheet(ss) {
  // Try by name
  let sheet = ss.getSheetByName(COLLECTOR_TAB);

  // Try by GID if name not found
  if (!sheet) {
    for (const s of ss.getSheets()) {
      if (s.getSheetId().toString() === COLLECTOR_GID) {
        sheet = s;
        break;
      }
    }
  }

  // Create new tab if still not found
  if (!sheet) {
    sheet = ss.insertSheet(COLLECTOR_TAB);
  }

  ensureHeader(sheet);
  return sheet;
}

// ================================================================
// POST HANDLER — Telegram bot calls this
//
// Payload for "add":
//   { "action":"add", "date":"03/06/2026 21:30", "chat_id":"123", "msg":"Order: ..." }
//
// Payload for "done":
//   { "action":"done", "ref_id":"5", "done_date":"03/06/2026", "done_time":"21:45",
//     "chat_id":"123" }  ← chat_id of the person pressing Done
// ================================================================
function doPost(e) {
  try {
    const data  = JSON.parse(e.postData.contents);
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getCollectorSheet(ss);

    if (data.action === "add")  return handleAdd(sheet, data);
    if (data.action === "done") return handleDone(sheet, ss, data);

    return respond("error", "Unknown action: " + data.action);
  } catch (err) {
    return respond("error", err.message);
  }
}

// ================================================================
// GET HANDLER — health check, also ensures Config headers exist
// ================================================================
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    ensureConfigHeaders(ss);          // auto-add col B & C headers to Config
    getCollectorSheet(ss);            // ensure collector tab exists
    const allowed = getAllowedIds(ss);
    return respond("ok", "TNI Collector running", { allowed_count: allowed.size });
  } catch (err) {
    return respond("error", err.message);
  }
}

// ================================================================
// ADD A NEW ROW
// Returns { status:"ok", row: N }  where N is the sequential ID
// ================================================================
function handleAdd(sheet, data) {
  const rowNum  = sheet.getLastRow() + 1;
  const seqId   = rowNum - 1;   // sequential ID (1, 2, 3, ...)

  const dateTime = data.date || "";
  const chatId   = data.chat_id || "";
  const msg      = data.msg || "";

  const row = [dateTime, chatId, msg, ""];   // D empty until Done
  sheet.appendRow(row);

  // Zebra striping
  const color = seqId % 2 === 0 ? "#EBF3FB" : "#FFFFFF";
  sheet.getRange(rowNum, 1, 1, HEADERS.length).setBackground(color);

  return respond("ok", "Row added", { row: seqId });
}

// ================================================================
// MARK ROW AS DONE — only allowed Telegram IDs can do this
// ================================================================
function handleDone(sheet, ss, data) {
  const refId    = parseInt(data.ref_id);
  const doerId   = (data.chat_id || "").toString().trim();  // who pressed Done

  // Validate ref_id
  if (!refId || isNaN(refId)) {
    return respond("error", "Invalid ref_id: " + data.ref_id);
  }

  // ── AUTHORISATION CHECK ──────────────────────────────────────
  const allowed = getAllowedIds(ss);
  if (allowed.size > 0 && !allowed.has(doerId)) {
    return respond("denied",
      "Your Telegram ID (" + doerId + ") is not authorised to mark requests as done.");
  }

  // ── UPDATE COLUMN D ──────────────────────────────────────────
  const lastRow   = sheet.getLastRow();
  const doneCol   = 4;           // Column D
  const targetRow = refId + 1;   // +1 because row 1 is header

  if (targetRow < 2 || targetRow > lastRow) {
    return respond("error",
      "Request #" + refId + " not found. Last request is #" + (lastRow - 1) + ".");
  }

  const doneDate = data.done_date || "";
  const doneTime = data.done_time || "";
  const byId     = doerId ? " (ID: " + doerId + ")" : "";
  const doneText = "✅ Done — " + doneDate + " " + doneTime + byId;

  sheet.getRange(targetRow, doneCol)
       .setValue(doneText)
       .setBackground("#D9EAD3")
       .setFontColor("#137333")
       .setFontWeight("bold");

  return respond("ok", "Done updated", { row: refId });
}

// ================================================================
// RESPONSE HELPER
// ================================================================
function respond(status, message, extra) {
  const payload = Object.assign({ status, message }, extra || {});
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
