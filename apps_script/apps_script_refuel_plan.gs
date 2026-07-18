// ============================================================
// SYSTEM: TNI Refuel Plan Collector & Reporter — Updated 10/07/2026 v2
// BotState: get_msg_id / set_msg_id → xóa tin cũ trước khi gửi mới
// Spreadsheet: https://docs.google.com/spreadsheets/d/1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM/edit
// Tabs: Refueled, Plan refuel, Team request, Telegram ID, Template
// Deploy: New deployment → Web App → Execute as Me → Anyone
// ============================================================

const PLAN_GROUP_ID    = "5469544739";   // ID group 9 TNI REQUEST REFUEL (đúng)
const PLAN_BOT_TOKEN   = "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME";
const PLAN_CHAT_ID     = "-5469544739";

// ── Web App Entry Points ───────────────────────────────────────────────────

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";
    if (action === "get_refuel_data") return getRefuelData();
    return jsonResp({ status: "ok", message: "TNI Refuel GAS running" });
  } catch (err) {
    return jsonResp({ status: "error", message: err.message });
  }
}

function doPostRefuelPlan_(e) {
  let body;
  try {
    body = (e.postData && e.postData.contents)
      ? JSON.parse(e.postData.contents)
      : (e.parameter || {});
  } catch (err) {
    return jsonResp({ status: "error", message: "Invalid JSON: " + err.message });
  }
  const action = body.action || "";
  try {
    if (action === "collect_message") return collectMessage(body);
    if (action === "collect_photo")   return collectPhoto(body);   // ← NEW: thu thập ảnh refuel
    if (action === "get_msg_id")      return getMsgId(body.key || "");
    if (action === "set_msg_id")      return setMsgId(body.key || "", body.msg_id || "");
    return jsonResp({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return jsonResp({ status: "error", message: err.message });
  }
}

// ── BotState: lưu/đọc message_id trong tab BotState ───────────────────────

function getBotStateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("BotState");
  if (!sh) {
    sh = ss.insertSheet("BotState");
    sh.getRange(1, 1, 1, 2).setValues([["key", "msg_id"]]);
  }
  return sh;
}

function getMsgId(key) {
  const sh = getBotStateSheet();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      return jsonResp({ status: "ok", key: key, msg_id: String(data[i][1]) });
    }
  }
  return jsonResp({ status: "ok", key: key, msg_id: "" });
}

function setMsgId(key, msgId) {
  const sh = getBotStateSheet();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      sh.getRange(i + 1, 2).setValue(msgId);
      return jsonResp({ status: "ok", key: key, msg_id: msgId });
    }
  }
  // Thêm dòng mới nếu chưa có key
  sh.appendRow([key, msgId]);
  return jsonResp({ status: "ok", key: key, msg_id: msgId });
}


// ── Helper: generate next sequential DEF ID ────────────────────────────────

function nextDefId(sheet) {
  // Đếm số dòng dữ liệu (trừ header row 1)
  const lastRow = sheet.getLastRow();
  const count = lastRow < 1 ? 1 : lastRow; // count bao gồm header
  return "#" + String(count).padStart(5, "0");
}

// ── Helper: insert row at TOP (row 2, after header) ────────────────────────

function insertAtTop(sheet, rowData) {
  sheet.insertRowBefore(2);
  sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
}

// ── Lettel Progress Tracker ────────────────────────────────────────────────

/**
 * Ghi ngày vào cột B (Plan) hoặc C (Refueled) của sheet 'Lettel Progress'
 * khi sender_id khớp với cột J trong sheet đó.
 * @param {string} senderId  Telegram ID của người gửi
 * @param {string} dateStr   Ngày dạng dd/MM/yyyy
 * @param {string} category  "PLAN" → ghi col B | "REFUELED" → ghi col C
 */
function updateLettelProgress(senderId, dateStr, category) {
  try {
    const ss        = SpreadsheetApp.getActiveSpreadsheet();
    const tmplSheet = ss.getSheetByName("Template");
    const lpSheet   = ss.getSheetByName("Lettel Progress");
    if (!tmplSheet || !lpSheet) return "";

    const lastRow = tmplSheet.getLastRow();
    if (lastRow < 2) return "";

    const colJ     = tmplSheet.getRange(2, 10, lastRow - 1, 1).getValues();
    const writeCol = (category === "PLAN" || category === "LETTER_SUBMIT") ? 2 : 3;

    for (let i = 0; i < colJ.length; i++) {
      const cellId = String(colJ[i][0]).trim();
      if (cellId === String(senderId).trim()) {
        const targetRow = i + 2;

        // Tự sinh DEF vào cột A nếu chưa có
        let defId = String(lpSheet.getRange(targetRow, 1).getValue()).trim();
        if (!defId) {
          defId = nextDefId(lpSheet);
          lpSheet.getRange(targetRow, 1).setValue(defId);
          Logger.log("[LettelProgress] Auto DEF=" + defId + " → row=" + targetRow);
        }

        lpSheet.getRange(targetRow, writeCol).setValue(dateStr);
        Logger.log("[LettelProgress] row=" + targetRow + " col=" + writeCol + " = " + dateStr + " (sender=" + senderId + ")");
        return defId;  // trả về DEF để caller đưa vào response
      }
    }
  } catch(e) {
    Logger.log("[LettelProgress] Error: " + e.message);
  }
  return "";
}


// ── Message Collection & Parsing ───────────────────────────────────────────

function collectMessage(body) {
  const groupId  = String(body.group_id  || "").trim();
  const text     = String(body.text      || "").trim();
  const sender   = String(body.sender    || "Unknown").trim();
  const senderId = String(body.sender_id || "").trim();

  if (groupId !== PLAN_GROUP_ID && groupId !== "-" + PLAN_GROUP_ID) {
    return jsonResp({ status: "skip", message: "Group ID not matched: " + groupId });
  }
  if (!text) return jsonResp({ status: "skip", message: "Empty message" });

  const textLower = text.toLowerCase();
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date();
  const today   = Utilities.formatDate(now, "Asia/Rangoon", "dd/MM/yyyy");
  const timeStr = Utilities.formatDate(now, "Asia/Rangoon", "HH:mm");

  // ==================== 1. REFUELED (DG Type) ====================
  if (textLower.includes("dg type")) {
    const sheet = ss.getSheetByName("Refueled");
    if (!sheet) return jsonResp({ status: "error", message: "Sheet 'Refueled' not found" });

    const p = parseRefueledText(text);
    const filledNum = parseFloat(p.filled) || 0;
    const priceNum  = parseFloat(p.price)  || 0;
    const totalVal  = filledNum && priceNum ? filledNum * priceNum : "";
    const defId     = nextDefId(sheet);

    const row = [
      defId,            // A: DEF (#00001)
      p.date || today,  // B: Date
      p.dgId,           // C: DG ID
      p.siteId,         // D: Site ID
      p.team,           // E: Team
      p.rh,             // F: DG Running Hour
      p.kwh,            // G: DG KWH Hour
      p.beforeLvl,      // H: Before Fuel Level %
      p.beforeCsu,      // I: Before CSU Reading(L)
      p.beforeCm,       // J: Before Fuel Liter/cm (cm reading)
      p.afterLvl,       // K: After Fuel Level %
      p.afterCsu,       // L: After CSU Reading(L)
      p.afterCm,        // M: After Fuel Liter/cm (cm reading)
      p.filled,         // N: Actual Filled Qty(L)
      p.price,          // O: Partner Price per Liter (MMK)
      totalVal,         // P: Total Amount (MMK)
      now,              // Q: Timestamp (metadata)
      sender,           // R: Sender Name (metadata)
      senderId          // S: Sender ID (metadata)
    ];

    insertAtTop(sheet, row);
    Logger.log("[Collect] REFUELED → Refueled sheet, DEF=" + defId);

    // Cập nhật Lettel Progress col C (Date Letter approved)
    updateLettelProgress(senderId, today, "REFUELED");

    return jsonResp({ status: "ok", category: "REFUELED", site: p.siteId, qty: p.filled, def: defId, time: today + " " + timeStr });
  }

  // ==================== 2. PLAN ====================
  if (textLower.includes("plan")) {
    const sheet = ss.getSheetByName("Plan refuel");
    if (!sheet) return jsonResp({ status: "error", message: "Sheet 'Plan refuel' not found" });

    const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const dateVal   = dateMatch ? dateMatch[1] : today;
    const teamMatch = text.match(/Team\s*(\d+)/i);
    const teamVal   = teamMatch ? "Team " + parseInt(teamMatch[1], 10) : "";

    const entries = parseSitesAndQty(text, true);
    if (entries.length === 0) return jsonResp({ status: "skip", message: "No sites parsed in Plan" });

    // Ghi từng dòng lên đầu (mỗi site 1 dòng, site đầu tiên sẽ ở row 2 sau khi xong)
    const firstDefId = "#" + String(sheet.getLastRow() + entries.length - 1).padStart(5, "0");
    entries.reverse().forEach(function(en) {
      const defId = nextDefId(sheet);
      const row = [
        defId,    // A: DEF
        dateVal,  // B: Date Plan
        teamVal,  // C: Name Team Plan
        en.site,  // D: Name Site
        en.qty,   // E: Plan will refuel
        now,      // F: Timestamp (metadata)
        sender,   // G: Sender Name (metadata)
        senderId  // H: Sender ID (metadata)
      ];
      insertAtTop(sheet, row);
    });

    Logger.log("[Collect] PLAN → Plan refuel sheet, " + entries.length + " sites, first DEF=" + firstDefId);

    // Cập nhật Lettel Progress col B (Date Letter Submit)
    updateLettelProgress(senderId, today, "PLAN");

    return jsonResp({ status: "ok", category: "PLAN", sites: entries.length, def: firstDefId, time: today + " " + timeStr });
  }

  // ==================== 3. REQUEST ====================
  if (textLower.includes("request")) {
    const sheet = ss.getSheetByName("Team request");
    if (!sheet) return jsonResp({ status: "error", message: "Sheet 'Team request' not found" });

    const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const dateVal   = dateMatch ? dateMatch[1] : today;
    const teamMatch = text.match(/Team\s*(\d+)/i);
    const teamVal   = teamMatch ? "Team " + parseInt(teamMatch[1], 10) : "";

    const entries = parseSitesAndQty(text, false);
    if (entries.length === 0) return jsonResp({ status: "skip", message: "No sites parsed in Request" });

    const firstDefId = "#" + String(sheet.getLastRow() + entries.length - 1).padStart(5, "0");
    entries.reverse().forEach(function(en) {
      const defId = nextDefId(sheet);
      const row = [
        defId,    // A: DEF
        dateVal,  // B: Date sent request
        timeStr,  // C: Time
        teamVal,  // D: Name Team
        en.site,  // E: Name Site
        en.qty,   // F: Order litter
        now,      // G: Timestamp (metadata)
        sender,   // H: Sender Name (metadata)
        senderId  // I: Sender ID (metadata)
      ];
      insertAtTop(sheet, row);
    });

    Logger.log("[Collect] REQUEST → Team request sheet, " + entries.length + " sites, first DEF=" + firstDefId);
    return jsonResp({ status: "ok", category: "REQUEST", sites: entries.length, def: firstDefId, time: today + " " + timeStr });
  }

  // ==================== 4. LETTER SUBMIT ====================
  // Keywords: "letter submit" hoặc "submitted to the government" hoặc "submit to gov"
  if (textLower.includes("letter") && (textLower.includes("submit") || textLower.includes("submitted"))) {
    const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const dateVal   = dateMatch ? dateMatch[1] : today;

    const defId = updateLettelProgress(senderId, dateVal, "LETTER_SUBMIT");
    Logger.log("[Collect] LETTER_SUBMIT → Lettel Progress col B, date=" + dateVal + " def=" + defId);
    // Reply do Python (refuel_collector.py) xử lý — GAS không reply để tránh double message
    return jsonResp({ status: "ok", category: "LETTER_SUBMIT", date: dateVal, def: defId, time: today + " " + timeStr });
  }

  // ==================== 5. LETTER APPROVED ====================
  // Keywords: "approved" + "letter"
  if (textLower.includes("approved") && textLower.includes("letter")) {
    const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const dateVal   = dateMatch ? dateMatch[1] : today;

    const defId = updateLettelProgress(senderId, dateVal, "LETTER_APPROVED");
    Logger.log("[Collect] LETTER_APPROVED → Lettel Progress col C, date=" + dateVal + " def=" + defId);
    // Reply do Python (refuel_collector.py) xử lý — GAS không reply để tránh double message
    return jsonResp({ status: "ok", category: "LETTER_APPROVED", date: dateVal, def: defId, time: today + " " + timeStr });
  }

  return jsonResp({ status: "skip", message: "No matching keyword" });
}

// ── Text Parsers ───────────────────────────────────────────────────────────

function parseRefueledText(text) {
  function search(pat, defaultVal) {
    const m = text.match(pat);
    return m ? m[1].trim() : (defaultVal || "");
  }

  // Parse ngày DD/MM/YYYY → JavaScript Date (tránh parse kiểu MM/DD/YYYY)
  let dateVal = "";
  const dateRaw = search(/Date\s*[=:]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (dateRaw) {
    const parts = dateRaw.split("/");
    if (parts.length === 3) {
      // Chuyển DD/MM/YYYY → Date object đúng
      dateVal = new Date(parseInt(parts[2],10), parseInt(parts[1],10)-1, parseInt(parts[0],10));
    } else {
      dateVal = dateRaw;
    }
  }

  const dgId    = search(/(?:DG\s*ID|site\s*ID)\s+([^\r\n]+)/i);
  let siteId = "";
  if (dgId) {
    const sm = dgId.match(/TNI\d{4}/i);
    if (sm) siteId = sm[0].toUpperCase();
  }

  let teamVal = search(/Team\s*(\d+)/i);
  if (teamVal) teamVal = "Team " + parseInt(teamVal, 10);

  const rh  = search(/Running\s*Hour[s]?\s*-?\s*(\d+)/i);
  const kwh = search(/KWH?\s*Hour[s]?\s*-?\s*(\d+)/i);

  const bm = text.match(/Before([\s\S]*?)(?:After|$)/i);
  const beforePart = bm ? bm[1] : "";
  let beforeCsu = (beforePart.match(/CSU\s*Reading\s*\(L\)\s*-?\s*(\d+)/i) || [])[1] || "";
  let beforeLvl = (beforePart.match(/Level\s*%\s*-?\s*(\d+)/i) || [])[1] || "";
  // Lấy số cm trong ngoặc: -(10)44L → 10
  let beforeCm  = (beforePart.match(/Liter\/cm[\s\S]*?-\s*\((\d+)\)/i) || [])[1] || "";

  const am = text.match(/After([\s\S]*?)(?:Emergency|Note|Mention|$)/i);
  const afterPart = am ? am[1] : "";
  let afterCsu = (afterPart.match(/CSU\s*Reading\s*\(L\)\s*-?\s*(\d+)/i) || [])[1] || "";
  let afterLvl = (afterPart.match(/Level\s*%\s*-?\s*(\d+)/i) || [])[1] || "";
  // Lấy số cm trong ngoặc: -(28)235L → 28
  let afterCm  = (afterPart.match(/Liter\/cm[\s\S]*?-\s*\((\d+)\)/i) || [])[1] || "";

  const filled = search(/Actual\s*Filled\s*Qty\s*\(L\)\s*-?\s*(\d+)/i);
  let price = search(/1Liter\s*price\s*=\s*(\d+)/i);
  if (!price) price = search(/Partner\s*price\s*[=:]\s*(\d+)/i);

  return { date: dateVal, dgId: dgId, siteId: siteId, team: teamVal,
           rh: rh, kwh: kwh,
           beforeCsu: beforeCsu, beforeLvl: beforeLvl, beforeCm: beforeCm,
           afterCsu: afterCsu, afterLvl: afterLvl, afterCm: afterCm,
           filled: filled, price: price };
}

function parseSitesAndQty(text, isPlan) {
  const results = [];
  // pat1: matches TNIxxxx or TNIxxxx_01 followed by separator (space, colon, comma, plus) and quantity (optional L)
  // Utilizes \b after optional [Ll] to avoid matching dates (e.g., 14/7/2026) as quantities
  const pat1 = /TNI(\d{4}(?:_\d+)?)(?:\([^)]*\))?[\s:,+]+(\d+)\s*[Ll]?\b(?!\s*\/)/gi;
  let m;
  const matchedSites = {};

  while ((m = pat1.exec(text)) !== null) {
    const siteCode = "TNI" + m[1];
    const qty = parseInt(m[2], 10);
    results.push({ site: siteCode, qty: qty });
    matchedSites[siteCode.toUpperCase()] = true;
  }

  if (isPlan) {
    // pat2: matches any remaining TNIxxxx or TNIxxxx_01 (defaults to 440)
    const pat2 = /TNI(\d{4}(?:_\d+)?)/gi;
    while ((m = pat2.exec(text)) !== null) {
      const siteCode = "TNI" + m[1];
      if (!matchedSites[siteCode.toUpperCase()]) {
        results.push({ site: siteCode, qty: 440 });
        matchedSites[siteCode.toUpperCase()] = true;
      }
    }
  }

  // Dedup theo site
  const seen = {};
  results.forEach(function(r) {
    const s = r.site.toUpperCase();
    if (!seen[s] || r.qty > seen[s]) seen[s] = r.qty;
  });
  return Object.keys(seen).sort().map(function(s) { return { site: s, qty: seen[s] }; });
}

// ── JSON Helper ────────────────────────────────────────────────────────────

function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ── Need Refuel: đọc cột R của sheet Refueled ──────────────────────────────

function getRefuelData() {
  const ss    = SpreadsheetApp.openById("1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM");
  const sheet = ss.getSheetByName("Need Refuel");
  if (!sheet) return jsonResp({ status: "error", message: "Sheet 'Need Refuel' not found" });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResp({ status: "ok", data: [] });

  const values = sheet.getRange(2, 18, lastRow - 1, 1).getValues();  // Cột R = 18
  const data   = [];
  for (let i = 0; i < values.length; i++) {
    const val = String(values[i][0] || "").trim();
    if (val) data.push(val);
  }
  return jsonResp({ status: "ok", data: data });
}


// ============================================================
// PHOTO COLLECTION — Cột T, U, V, W, X, Y, Z, AA
// ============================================================
//
// Layout cột trong sheet Refueled (1-indexed):
//   T  = 20  : QI4 Code      — 3 ký tự cuối KeyPhoto ngày hôm nay
//   U  = 21  : QI4 Match     — MATCH / NEAR / NO
//   V  = 22  : Lng (Photo)   — GPS longitude từ EXIF ảnh
//   W  = 23  : Lat (Photo)   — GPS latitude từ EXIF ảnh
//   X  = 24  : Lng (Real)    — User tự điền thủ công
//   Y  = 25  : Lat (Real)    — User tự điền thủ công
//   Z  = 26  : Distance (m)  — Haversine tự tính khi user điền X/Y
//   AA = 27  : Photo Auth    — ORIGINAL / EDITED / SUSPECT

const COL_T  = 20;
const COL_U  = 21;
const COL_V  = 22;
const COL_W  = 23;
const COL_X  = 24;
const COL_Y  = 25;
const COL_Z  = 26;
const COL_AA = 27;


/**
 * collectPhoto: nhận payload từ Python bot (refuel_photo_collector.py),
 * tìm row trong sheet Refueled khớp sender_id + ngày hôm nay,
 * rồi ghi các cột T, U, V, W, AA.
 */
function collectPhoto(body) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Refueled");
  if (!sheet) return jsonResp({ status: "error", message: "Sheet 'Refueled' not found" });

  const senderId   = String(body.sender_id   || "").trim();
  const senderName = String(body.sender_name || "").trim();
  const dateStr    = String(body.date        || "").trim();   // dd/MM/yyyy
  const siteCode   = String(body.site_code   || "").trim().toUpperCase(); // TNIxxxx hoặc TNIxxxx_01
  const fileId     = String(body.file_id     || "").trim();
  const caption    = String(body.caption     || "").trim();
  const latPhoto   = (body.lat_photo !== undefined && body.lat_photo !== null)
                     ? Number(body.lat_photo) : null;
  const lngPhoto   = (body.lng_photo !== undefined && body.lng_photo !== null)
                     ? Number(body.lng_photo) : null;
  const auth       = String(body.auth || "SUSPECT").trim().toUpperCase();

  if (!senderId) return jsonResp({ status: "error", message: "Missing sender_id" });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResp({ status: "skip", message: "Refueled sheet empty" });

  const numRows   = lastRow - 1;
  const dateCol   = sheet.getRange(2, 2,  numRows, 1).getValues();  // col B: Date
  const dgIdCol   = sheet.getRange(2, 3,  numRows, 1).getValues();  // col C: DG ID
  const senderCol = sheet.getRange(2, 19, numRows, 1).getValues();  // col S: sender_id

  let targetRow = -1;
  let dgId      = "";

  // 1. Ưu tiên: Tìm theo siteCode và ngày hôm nay
  if (siteCode) {
    const cleanSiteCode = siteCode.replace(/_01$/, "").replace(/_1$/, "");
    for (let i = 0; i < numRows; i++) {
      const rowDate = String(dateCol[i][0] || "").trim();
      const rowDg   = String(dgIdCol[i][0] || "").trim().toUpperCase();
      const cleanRowDg = rowDg.replace(/_01$/, "").replace(/_1$/, "");
      
      if (rowDate === dateStr && cleanRowDg === cleanSiteCode) {
        targetRow = i + 2;
        dgId      = rowDg;
        break;
      }
    }
  }

  // 2. Thử tìm theo sender_id + ngày hôm nay (nếu không khớp siteCode)
  if (targetRow === -1) {
    for (let i = 0; i < numRows; i++) {
      const rowDate   = String(dateCol[i][0]   || "").trim();
      const rowSender = String(senderCol[i][0] || "").trim();
      if (rowSender === senderId && rowDate === dateStr) {
        targetRow = i + 2;
        dgId      = String(dgIdCol[i][0] || "").trim().toUpperCase();
        break;
      }
    }
  }

  // 3. Fallback: tìm row đầu tiên có ngày hôm nay mà cột Lng (Photo) chưa điền
  if (targetRow === -1) {
    for (let i = 0; i < numRows; i++) {
      const rowDate = String(dateCol[i][0] || "").trim();
      const rowV    = sheet.getRange(i + 2, COL_V).getValue();
      if (rowDate === dateStr && !rowV) {
        targetRow = i + 2;
        dgId      = String(dgIdCol[i][0] || "").trim().toUpperCase();
        break;
      }
    }
  }

  // Nếu vẫn không tìm thấy → thêm dòng mới
  if (targetRow === -1) {
    const now     = new Date();
    const defId   = nextDefId(sheet);
    const newRow  = [
      defId, dateStr, siteCode, "", "", "", "", "", "", "",  // A–J (Cột C ghi siteCode)
      "", "", "", "", "", "", now, senderName, senderId // K–S
    ];
    insertAtTop(sheet, newRow);
    targetRow = 2;
    dgId      = siteCode;
    Logger.log("[collectPhoto] New row inserted: DEF=" + defId);
  }

  // ── Ghi các cột V, W, AA (Bỏ qua cột T, U) ──
  sheet.getRange(targetRow, COL_V).setValue(lngPhoto !== null ? lngPhoto : "");
  sheet.getRange(targetRow, COL_W).setValue(latPhoto !== null ? latPhoto : "");
  sheet.getRange(targetRow, COL_AA).setValue(auth);

  // Lưu file_id vào note của cell AA để tra cứu sau
  if (fileId) {
    const note = sheet.getRange(targetRow, COL_AA).getNote() || "";
    if (!note.includes(fileId)) {
      sheet.getRange(targetRow, COL_AA).setNote((note ? note + "\n" : "") + fileId);
    }
  }

  Logger.log("[collectPhoto] row=" + targetRow + " DG=" + dgId +
             " V=" + lngPhoto + " W=" + latPhoto + " AA=" + auth);

  return jsonResp({
    status: "ok",
    row:    targetRow,
    dg_id:  dgId,
    auth:   auth,
    lat:    latPhoto,
    lng:    lngPhoto
  });
}


/**
 * haversineMeters: tính khoảng cách Haversine giữa 2 điểm GPS, đơn vị mét.
 * @param {number} lat1  Vĩ độ điểm 1 (Photo)
 * @param {number} lon1  Kinh độ điểm 1 (Photo)
 * @param {number} lat2  Vĩ độ điểm 2 (Real)
 * @param {number} lon2  Kinh độ điểm 2 (Real)
 * @returns {number} Khoảng cách tính bằng mét
 */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R  = 6371000;  // Bán kính Trái Đất (mét)
  const f1 = lat1 * Math.PI / 180;
  const f2 = lat2 * Math.PI / 180;
  const df = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(df / 2) * Math.sin(df / 2)
             + Math.cos(f1) * Math.cos(f2)
             * Math.sin(dl / 2) * Math.sin(dl / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


/**
 * onEditRefuelPhoto: trigger tự động tính cột Z (khoảng cách mét)
 * khi user điền cột X (Lng Real) hoặc Y (Lat Real).
 * Cần cài bằng setupOnEditTrigger().
 */
function onEditRefuelPhoto(e) {
  if (!e) return;
  const sheet = e.source.getActiveSheet();
  if (!sheet || sheet.getName() !== "Refueled") return;

  const col = e.range.getColumn();
  const row = e.range.getRow();

  if (row < 2) return;
  if (col !== COL_X && col !== COL_Y) return;

  const lngPhoto = parseFloat(sheet.getRange(row, COL_V).getValue());
  const latPhoto = parseFloat(sheet.getRange(row, COL_W).getValue());
  const lngReal  = parseFloat(sheet.getRange(row, COL_X).getValue());
  const latReal  = parseFloat(sheet.getRange(row, COL_Y).getValue());

  // Cần cả 4 giá trị hợp lệ mới tính
  if (isNaN(lngPhoto) || isNaN(latPhoto) || isNaN(lngReal) || isNaN(latReal)) {
    sheet.getRange(row, COL_Z).setValue("");
    return;
  }

  const dist = haversineMeters(latPhoto, lngPhoto, latReal, lngReal);
  sheet.getRange(row, COL_Z).setValue(Math.round(dist));  // làm tròn tới mét
  Logger.log("[onEditRefuelPhoto] row=" + row + " dist=" + Math.round(dist) + "m");
}


/**
 * setupRefuelPhotoHeaders: thiết lập tiêu đề cột T → AA trong sheet Refueled.
 * Chạy 1 lần từ Apps Script Editor để khởi tạo.
 */
function setupRefuelPhotoHeaders() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Refueled");
  if (!sheet) { Logger.log("❌ Sheet 'Refueled' not found"); return; }

  const headers = [[
    "QI4 Code",    // T
    "QI4 Match",   // U
    "Lng (Photo)", // V
    "Lat (Photo)", // W
    "Lng (Real)",  // X  ← user điền
    "Lat (Real)",  // Y  ← user điền
    "Distance (m)",// Z  ← auto Haversine
    "Photo Auth"   // AA
  ]];
  sheet.getRange(1, COL_T, 1, 8).setValues(headers);

  // Header màu xanh
  const hdr = sheet.getRange(1, COL_T, 1, 8);
  hdr.setBackground("#1a73e8");
  hdr.setFontColor("#ffffff");
  hdr.setFontWeight("bold");

  // Cột X, Y (user fill) → nền vàng nhạt
  const maxR = sheet.getMaxRows();
  sheet.getRange(2, COL_X, maxR - 1, 2).setBackground("#fff9c4");

  // Cột Z, AA (auto) → nền xanh lá nhạt
  sheet.getRange(2, COL_Z, maxR - 1, 2).setBackground("#e8f5e9");

  Logger.log("✅ Headers T→AA đã thiết lập trong sheet Refueled.");
}


/**
 * setupOnEditTrigger: cài trigger onEdit cho onEditRefuelPhoto.
 * Chạy 1 lần từ Apps Script Editor.
 */
function setupOnEditTrigger() {
  const existing = ScriptApp.getProjectTriggers();
  for (let i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === "onEditRefuelPhoto") {
      ScriptApp.deleteTrigger(existing[i]);
    }
  }
  ScriptApp.newTrigger("onEditRefuelPhoto")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  Logger.log("✅ onEditRefuelPhoto trigger installed.");
}

