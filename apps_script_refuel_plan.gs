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

function doPost(e) {
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

    const entries = parseSitesAndQty(text);
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

    const entries = parseSitesAndQty(text);
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

function parseSitesAndQty(text) {
  const results = [];
  const pat1 = /TNI(\d{4})(?:\([^)]*\))?[\s:,]+(\d+)\s*[Ll]/gi;
  let m;
  while ((m = pat1.exec(text)) !== null) {
    results.push({ site: "TNI" + m[1], qty: parseInt(m[2], 10) });
  }
  if (results.length === 0) {
    const pat2 = /TNI(\d{4})(?:\([^)]*\))?\s+(\d+)/gi;
    while ((m = pat2.exec(text)) !== null) {
      results.push({ site: "TNI" + m[1], qty: parseInt(m[2], 10) });
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
