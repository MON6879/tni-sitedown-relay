// ============================================================
// SYSTEM: TNI Refuel Plan Collector & Reporter — Updated 10/07/2026
// Spreadsheet: https://docs.google.com/spreadsheets/d/1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM/edit
// Tabs: Refueled, Plan refuel, Team request, Telegram ID, Template
// Deploy: New deployment → Web App → Execute as Me → Anyone
// ============================================================

const PLAN_GROUP_ID    = "6859790680";
const PLAN_BOT_TOKEN   = "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME";
const PLAN_CHAT_ID     = "-5469544739";

// ── Web App Entry Points ───────────────────────────────────────────────────

function doGet(e) {
  return jsonResp({ status: "ok", message: "TNI Refuel GAS running" });
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
    return jsonResp({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return jsonResp({ status: "error", message: err.message });
  }
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
      "",               // B: No
      "",               // C: Branch
      p.date || today,  // D: Date
      p.dgId,           // E: DG ID
      p.siteId,         // F: Site ID
      p.team,           // G: Team
      p.rh,             // H: DG Running Hour
      p.kwh,            // I: DG KWH Hour
      p.beforeLvl,      // J: Before Fuel Level %
      p.beforeCsu,      // K: Before CSU Reading(L)
      p.beforeCm,       // L: Before Fuel Liter/cm (cm reading)
      p.afterLvl,       // M: After Fuel Level %
      p.afterCsu,       // N: After CSU Reading(L)
      p.afterCm,        // O: After Fuel Liter/cm (cm reading)
      p.filled,         // P: Actual Filled Qty(L)
      p.price,          // Q: Partner Price per Liter (MMK)
      totalVal,         // R: Total Amount (MMK)
      now,              // S: Timestamp (metadata)
      sender,           // T: Sender Name (metadata)
      senderId          // U: Sender ID (metadata)
    ];

    insertAtTop(sheet, row);
    Logger.log("[Collect] REFUELED → Refueled sheet, DEF=" + defId);
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

  return jsonResp({ status: "skip", message: "No matching keyword" });
}

// ── Text Parsers ───────────────────────────────────────────────────────────

function parseRefueledText(text) {
  function search(pat, defaultVal) {
    const m = text.match(pat);
    return m ? m[1].trim() : (defaultVal || "");
  }

  const dateVal = search(/Date\s*[=:]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
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
  let beforeCm  = (beforePart.match(/Liter\/cm[\s\S]*?-\s*\(\d+\)\s*(\d+)\s*[Ll]?/i) || [])[1] || "";

  const am = text.match(/After([\s\S]*?)(?:Emergency|Note|Mention|$)/i);
  const afterPart = am ? am[1] : "";
  let afterCsu = (afterPart.match(/CSU\s*Reading\s*\(L\)\s*-?\s*(\d+)/i) || [])[1] || "";
  let afterLvl = (afterPart.match(/Level\s*%\s*-?\s*(\d+)/i) || [])[1] || "";
  let afterCm  = (afterPart.match(/Liter\/cm[\s\S]*?-\s*\(\d+\)\s*(\d+)\s*[Ll]?/i) || [])[1] || "";

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
