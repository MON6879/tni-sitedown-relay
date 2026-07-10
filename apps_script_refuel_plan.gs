// ============================================================
// SYSTEM: TNI Refuel Plan Collector & Reporter
// Spreadsheet: https://docs.google.com/spreadsheets/d/1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM/edit
// Tab: PlanRefuel (tự tạo nếu chưa có)
// Deploy: New deployment → Web App → Execute as Me → Anyone
// ============================================================
// Thu thập tin nhắn từ group 9 TNI REQUEST REFUEL (ID: 6859790680)
// Phân loại:
//   "DG Type"  → REFUELED  (đã đổ thực tế)
//   "Plan"     → PLAN      (kế hoạch đổ)
//   "request"  → REQUEST   (yêu cầu từ trạm)
// ============================================================

const PLAN_GROUP_ID    = "6859790680";  // Group filter (cả dạng + và -)
const PLAN_SHEET_NAME  = "PlanRefuel"; // Tab trong spreadsheet
const PLAN_BOT_TOKEN   = "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME";
const PLAN_CHAT_ID     = "-5469544739"; // Group 9 TNI REQUEST REFUEL

// Cột trong sheet PlanRefuel (1-indexed):
// A(1): Timestamp | B(2): Date | C(3): Category | D(4): Group ID
// E(5): Sender    | F(6): Site | G(7): Qty (L)  | H(8): Raw Message

// ── Authorization ──────────────────────────────────────────────────────────
function authorizeUrlFetch() {
  Logger.log("🔐 Kích hoạt cấp quyền...");
  UrlFetchApp.fetch("https://api.telegram.org");
  Logger.log("✅ Đã cấp quyền!");
}

// ── Web App Entry Points ───────────────────────────────────────────────────

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "";
  try {
    if (action === "get_plan_frequency") return getPlanFrequency(e.parameter);
    if (action === "get_compare_data")   return getCompareData(e.parameter);
    if (action === "get_msgids")         return handleGetMsgIds(e.parameter || {});
    return jsonResp({ status: "ok", message: "TNI Refuel Plan GAS v1.0 running" });
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
    if (action === "save_msgids")     return handleSaveMsgIds(body);
    return jsonResp({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return jsonResp({ status: "error", message: err.message });
  }
}

// ── Sheet Setup ────────────────────────────────────────────────────────────

function getOrCreatePlanSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PLAN_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PLAN_SHEET_NAME);
    const header = [["Timestamp", "Date", "Category", "Group ID", "Sender", "Site ID", "Qty (L)", "Raw Message"]];
    sheet.getRange(1, 1, 1, 8).setValues(header).setFontWeight("bold");
    Logger.log("✅ Tạo sheet mới: " + PLAN_SHEET_NAME);
  }
  return sheet;
}

// ── Message Collection ─────────────────────────────────────────────────────

function collectMessage(body) {
  const groupId = String(body.group_id || "").trim();
  const text    = String(body.text     || "").trim();
  const sender  = String(body.sender   || "Unknown").trim();

  // Filter theo group ID (chấp nhận có hoặc không có dấu -)
  if (groupId !== PLAN_GROUP_ID && groupId !== "-" + PLAN_GROUP_ID) {
    return jsonResp({ status: "skip", message: "Group ID not matched: " + groupId });
  }
  if (!text) return jsonResp({ status: "skip", message: "Empty message" });

  // Phân loại tin nhắn
  const textLower = text.toLowerCase();
  let category;
  if (textLower.includes("dg type")) {
    category = "REFUELED";
  } else if (textLower.includes("plan")) {
    category = "PLAN";
  } else if (textLower.includes("request")) {
    category = "REQUEST";
  } else {
    return jsonResp({ status: "skip", message: "No matching keyword" });
  }

  // Parse site IDs và số lượng xăng
  const entries = parseSitesAndQty(text);
  if (entries.length === 0) {
    // Lưu 1 dòng không có site nếu không parse được
    entries.push({ site: "", qty: 0 });
  }

  const sheet   = getOrCreatePlanSheet();
  const now     = new Date();
  const today   = Utilities.formatDate(now, "Asia/Rangoon", "dd/MM/yyyy");
  const rawText = text.length > 500 ? text.substring(0, 497) + "..." : text;

  // Ghi mỗi site thành 1 dòng
  const rows = entries.map(function(en) {
    return [now, today, category, groupId, sender, en.site, en.qty, rawText];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 8).setValues(rows);

  Logger.log("[Collect] " + category + " | " + entries.length + " sites | sender: " + sender);
  return jsonResp({ status: "ok", category: category, sites: entries.length, rows_added: rows.length });
}

// ── Parse Site IDs + Quantities ────────────────────────────────────────────

function parseSitesAndQty(text) {
  const results = [];
  // Pattern 1: TNI0061: 440L hoặc TNI0061 440L hoặc TNI0061(DG2): 440L
  const pat1 = /TNI(\d{4})(?:\([^)]*\))?[\s:]+(\d+)\s*[Ll]/g;
  let m;
  while ((m = pat1.exec(text)) !== null) {
    results.push({ site: "TNI" + m[1], qty: parseInt(m[2], 10) });
  }
  // Pattern 2 fallback: TNI0061 440 (không có chữ L)
  if (results.length === 0) {
    const pat2 = /TNI(\d{4})(?:\([^)]*\))?\s+(\d+)/g;
    while ((m = pat2.exec(text)) !== null) {
      results.push({ site: "TNI" + m[1], qty: parseInt(m[2], 10) });
    }
  }
  // Dedup theo site (lấy qty lớn nhất nếu trùng)
  const seen = {};
  results.forEach(function(r) {
    if (!seen[r.site] || r.qty > seen[r.site]) seen[r.site] = r.qty;
  });
  return Object.keys(seen).sort().map(function(s) { return { site: s, qty: seen[s] }; });
}

// ── Report 1: Plan Frequency (3day / 7day / 1month) ───────────────────────

function getPlanFrequency(params) {
  const sheet   = getOrCreatePlanSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResp({ status: "ok", data: [] });

  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const now  = new Date();
  const ms3d  = 3  * 86400000;
  const ms7d  = 7  * 86400000;
  const ms30d = 30 * 86400000;

  const freq = {}; // site → { d3, d7, d30 }

  for (let i = 0; i < data.length; i++) {
    const ts   = new Date(data[i][0]);
    const cat  = data[i][2];
    const site = data[i][5];
    if (cat !== "PLAN" || !site) continue;

    const diff = now.getTime() - ts.getTime();
    if (!freq[site]) freq[site] = { d3: 0, d7: 0, d30: 0 };
    if (diff <= ms3d)  freq[site].d3++;
    if (diff <= ms7d)  freq[site].d7++;
    if (diff <= ms30d) freq[site].d30++;
  }

  const result = Object.keys(freq).sort().map(function(site) {
    return { site: site, d3: freq[site].d3, d7: freq[site].d7, d30: freq[site].d30 };
  });
  return jsonResp({ status: "ok", data: result });
}

// ── Report 2 & 3: Compare Today Plan vs Refueled vs Request ───────────────

function getCompareData(params) {
  const sheet   = getOrCreatePlanSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResp({ status: "ok", plan: {}, refueled: {}, request: {}, date: "" });

  const data  = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const now   = new Date();
  const today = Utilities.formatDate(now, "Asia/Rangoon", "dd/MM/yyyy");

  const plan = {}, refueled = {}, request = {};

  for (let i = 0; i < data.length; i++) {
    const dateVal = data[i][1];
    const cat     = data[i][2];
    const site    = data[i][5];
    const qty     = parseInt(data[i][6], 10) || 0;
    if (!site || dateVal !== today) continue;

    if (cat === "PLAN")     plan[site]     = (plan[site]     || 0) + qty;
    if (cat === "REFUELED") refueled[site] = (refueled[site] || 0) + qty;
    if (cat === "REQUEST")  request[site]  = (request[site]  || 0) + qty;
  }

  return jsonResp({ status: "ok", plan: plan, refueled: refueled, request: request, date: today });
}

// ── Message ID Helpers (xóa báo cáo cũ) ───────────────────────────────────

function handleGetMsgIds(params) {
  const key = (params && params.key) ? params.key.toString().trim() : "";
  if (!key) return jsonResp({ status: "error", message: "Missing key" });
  const props = PropertiesService.getScriptProperties();
  const raw   = props.getProperty("PLAN_MSGID_" + key) || "[]";
  try {
    return jsonResp({ status: "ok", key: key, msgids: JSON.parse(raw) });
  } catch (_) {
    return jsonResp({ status: "ok", key: key, msgids: [] });
  }
}

function handleSaveMsgIds(body) {
  const key    = (body && body.key)    ? body.key.toString().trim() : "";
  const msgids = (body && body.msgids) ? body.msgids : [];
  if (!key) return jsonResp({ status: "error", message: "Missing key" });
  PropertiesService.getScriptProperties().setProperty("PLAN_MSGID_" + key, JSON.stringify(msgids));
  return jsonResp({ status: "ok", key: key, count: msgids.length });
}

// ── JSON Helper ────────────────────────────────────────────────────────────

function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
