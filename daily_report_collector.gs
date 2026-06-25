// ================================================================
//  DAILY REPORT COLLECTOR — Google Apps Script
//  Sheet: 1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y
//  Tab:   "Daily report and Bussiness"
//
//  DEPLOY: Apps Script → Deploy → Web App
//    Execute as: Me
//    Who has access: Anyone
//
//  SAU KHI DEPLOY: Chạy setupDailySheet() một lần để tạo header
// ================================================================

// ─── CẤU HÌNH ─────────────────────────────────────────────────
const DAILY_SHEET_ID   = "1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y";
const DAILY_SHEET_NAME = "Daily report and Bussiness";
const ID_TG_TAB        = "ID Telegram";   // Tab chứa Name ↔ Telegram ID
const DRIVE_PARENT     = "1 VCM BRANCH TNI";
const DRIVE_FOLDER     = "2.5 Daily report and Businesstrip Telegram";
const TIMEZONE         = "Asia/Yangon";   // UTC+6:30

// ─── CỘT (1-indexed) ──────────────────────────────────────────
// A=1   → template (giữ nguyên)
// B=2   → Tên nhân viên (auto lookup)
// C-Q   → 15 cột dữ liệu (đồng bộ từ cột A)
// R=18  → Telegram ID người gửi
// S=19  → Tên nhân viên (lookup)
// T-Y   → 6 ảnh Google Drive
const COL_REF          = 2;   // B  → số thứ tự (REF)
const COL_DATA_START   = 3;   // C
const NUM_DATA_COLS    = 15;  // C → Q
const COL_TG_ID        = 18;  // R
const COL_EMP_NAME     = 19;  // S
const COL_PHOTO_START  = 20;  // T
const NUM_PHOTO_COLS   = 6;   // T → Y
const DR_TOTAL_COLS    = 25;  // A → Y
const TEMPLATE_ROWS    = 15;  // số dòng template (A1:A15)

// ================================================================
//  ENTRY POINTS
// ================================================================

function doPostDaily_(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === "daily_add")    return handleDailyAdd(body);
    if (body.action === "daily_photo")  return handleDailyPhoto(body);
    if (body.action === "sync_headers") return handleSyncHeaders();
    // ── Daily Plan ──
    if (body.action === "store_daily_plan")   return handleStoreDailyPlan(body);
    if (body.action === "get_daily_plans")    return handleGetDailyPlans();
    if (body.action === "get_daily_reports")  return handleGetDailyReports(body);
    return jsonOut({ status: "error", message: "Unknown action: " + body.action });
  } catch (err) {
    return jsonOut({ status: "error", message: err.message });
  }
}

function doGetDaily_(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";
    if (action === "get_fields") return handleGetFields();
    return jsonOut({ status: "ok", message: "Daily Report Collector running" });
  } catch (err) {
    return jsonOut({ status: "error", message: err.message });
  }
}

// ================================================================
//  GET_FIELDS — đọc cột A, trả về danh sách tên field
//  Loại bỏ số thứ tự và dấu ":" ở cuối
// ================================================================
function handleGetFields() {
  const ss    = SpreadsheetApp.openById(DAILY_SHEET_ID);
  const sheet = ss.getSheetByName(DAILY_SHEET_NAME);
  if (!sheet) return jsonOut({ status: "error", message: "Sheet not found: " + DAILY_SHEET_NAME });

  const vals = sheet.getRange("A1:A15").getValues().flat();
  const fields = [];

  for (const v of vals) {
    const s = String(v || "").trim();
    if (!s) continue;
    // Lấy phần trước ":" → loại bỏ số dẫn đầu "1. " / "11 " / "Daily report: ..."
    let name = s.indexOf(":") > -1 ? s.substring(0, s.indexOf(":")).trim() : s;
    name = name.replace(/^\d+\.?\s+/, "").trim();
    if (name) fields.push(name);
  }

  return jsonOut({ status: "ok", fields });
}

// ================================================================
//  SYNC_HEADERS — đồng bộ tên field từ cột A → header hàng 1 (C1:Q1)
//  Gọi thủ công khi cột A thay đổi
// ================================================================
function handleSyncHeaders() {
  const ss    = SpreadsheetApp.openById(DAILY_SHEET_ID);
  const sheet = ss.getSheetByName(DAILY_SHEET_NAME);
  if (!sheet) return jsonOut({ status: "error", message: "Sheet not found" });

  const result = getFieldsFromColA_(sheet);

  // Ghi header C1:Q1
  const headerRow = result.slice(0, NUM_DATA_COLS);
  while (headerRow.length < NUM_DATA_COLS) headerRow.push("");
  sheet.getRange(1, COL_DATA_START, 1, NUM_DATA_COLS)
       .setValues([headerRow])
       .setFontWeight("bold")
       .setBackground("#D9E1F2");

  // Cột B header = REF (số thứ tự dòng dữ liệu)
  sheet.getRange(1, COL_REF).setValue("REF").setFontWeight("bold").setBackground("#D9EAD3");

  // Cột R = Telegram ID, Cột S = Tên nhân viên (công thức tự động)
  sheet.getRange(1, COL_TG_ID).setValue("Telegram ID").setFontWeight("bold").setBackground("#FCE4D6");
  sheet.getRange(1, COL_EMP_NAME).setValue("Tên nhân viên").setFontWeight("bold").setBackground("#FCE4D6");

  // ARRAYFORMULA tự động lấy tên từ tab 'ID Telegram' (Cột E = TG ID, Cột B = Tên)
  // Ghi vào S2 — áp dụng cho toàn bộ cột S mãi mãi
  const arrayFormula =
    "=ARRAYFORMULA(IF(R2:R=\"\",,IFERROR(INDEX('ID Telegram'!B:B," +
    "MATCH(TEXT(R2:R,\"0\"),'ID Telegram'!E:E,0)),\"?\")))"; 
  sheet.getRange(2, COL_EMP_NAME).setFormula(arrayFormula);

  // Cột T → Y = Photo 1-6
  const photoHeaders = [["Photo 1","Photo 2","Photo 3","Photo 4","Photo 5","Photo 6"]];
  sheet.getRange(1, COL_PHOTO_START, 1, NUM_PHOTO_COLS)
       .setValues(photoHeaders)
       .setFontWeight("bold")
       .setBackground("#E2EFDA");

  return jsonOut({ status: "ok", synced: headerRow.filter(Boolean).length });
}

// ================================================================
//  DAILY_ADD — thêm dòng báo cáo mới vào sheet
//  Payload: { action, telegram_id, fields:{fieldName:value,...} }
// ================================================================
function handleDailyAdd(body) {
  const ss    = SpreadsheetApp.openById(DAILY_SHEET_ID);
  const sheet = ss.getSheetByName(DAILY_SHEET_NAME);
  if (!sheet) return jsonOut({ status: "error", message: "Sheet not found" });

  const tgId    = String(body.telegram_id || "").trim();
  const fields  = body.fields || {};

  // Không cần lookup tên — Col S đã có ARRAYFORMULA tự điền

  // Lấy header hàng 1 để map đúng cột
  const headers = sheet.getRange(1, COL_DATA_START, 1, NUM_DATA_COLS).getValues()[0];

  // Build dataRow theo thứ tự header
  const dataRow = headers.map(h => {
    const key = String(h || "").trim();
    if (!key) return "";
    // Tìm khớp không phân biệt hoa thường
    for (const [k, v] of Object.entries(fields)) {
      if (k.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(k.toLowerCase())) {
        return v || "";
      }
    }
    return "";
  });

  // Build full row (A→Y = 25 cột)
  const row = new Array(DR_TOTAL_COLS).fill("");
  dataRow.forEach((v, i) => { row[COL_DATA_START - 1 + i] = v; }); // C:Q = data
  row[COL_TG_ID - 1]      = tgId;   // R = Telegram ID
  // Col S (COL_EMP_NAME) được ARRAYFORMULA tự điền — không ghi đè

  // Tính REF: đếm số dòng dữ liệu đã có (bựa qua TEMPLATE_ROWS dòng template)
  const lastRow = sheet.getLastRow();
  const ref     = String(Math.max(0, lastRow - TEMPLATE_ROWS) + 1).padStart(5, "0");

  sheet.appendRow(row);
  const rowNum = sheet.getLastRow();

  // Ghi REF vào cột B
  const refCell = sheet.getRange(rowNum, COL_REF);
  refCell.setValue(ref);
  refCell.setFontWeight("bold").setHorizontalAlignment("center");

  // Màu xen kẽ
  const bg = rowNum % 2 === 0 ? "#EBF3FB" : "#FFFFFF";
  sheet.getRange(rowNum, 1, 1, DR_TOTAL_COLS).setBackground(bg);
  refCell.setBackground("#D9EAD3"); // giữ màu xanh REF

  // Attach ảnh pending (nếu người dùng đã gửi ảnh trước text)
  const props   = PropertiesService.getScriptProperties();
  const pKey    = "DPENDING_" + tgId;
  const pending = JSON.parse(props.getProperty(pKey) || "[]");
  if (pending.length > 0) {
    pending.slice(0, NUM_PHOTO_COLS).forEach((link, idx) => {
      sheet.getRange(rowNum, COL_PHOTO_START + idx).setValue(link);
    });
    props.deleteProperty(pKey);
  }

  Logger.log("✅ Daily row added: REF:" + ref + " row=" + rowNum + " tgId=" + tgId);
  return jsonOut({ status: "ok", row: rowNum, ref: ref, name: tgId });
}

// ================================================================
//  DAILY_PHOTO — tải ảnh từ Telegram → lưu Drive → ghi link vào sheet
//  Payload: { action, telegram_id, tg_url, date }
//  Drive path: 1 VCM BRANCH TNI / 2.5 Daily report... / [telegram_id] /
// ================================================================
function handleDailyPhoto(body) {
  const tgId  = String(body.telegram_id || "").trim();
  const tgUrl = body.tg_url || "";

  if (!tgId || !tgUrl) {
    return jsonOut({ status: "error", message: "Missing telegram_id or tg_url" });
  }

  // 1. Download ảnh từ URL Telegram
  let blob;
  try {
    blob = UrlFetchApp.fetch(tgUrl, { muteHttpExceptions: true }).getBlob();
  } catch (e) {
    return jsonOut({ status: "error", message: "Download failed: " + e.message });
  }

  // 2. Đặt tên file: [tgId]_YYYYMMDD_HHmmss.jpg
  const ts       = Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd_HHmmss");
  const fileName = tgId + "_" + ts + ".jpg";
  blob.setName(fileName);

  // 3. Upload lên Drive folder: 1 VCM BRANCH TNI / 2.5 ... / [tgId] /
  const folder    = getOrCreateDailyFolder_(tgId);
  const file      = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const driveLink = "https://drive.google.com/file/d/" + file.getId() + "/view";

  // 4. Tìm dòng gần nhất của tgId và gắn link vào cột T→Y
  const ss    = SpreadsheetApp.openById(DAILY_SHEET_ID);
  const sheet = ss.getSheetByName(DAILY_SHEET_NAME);
  const data  = sheet.getDataRange().getValues();
  let attached = false;

  // Tìm từ dưới lên — chỉ xét 50 dòng gần nhất
  const startRow = Math.max(1, data.length - 50);
  for (let i = data.length - 1; i >= startRow; i--) {
    const rowTgId = String(data[i][COL_TG_ID - 1] || "").trim();
    if (rowTgId !== tgId) continue;

    // Tìm cột ảnh trống
    for (let c = COL_PHOTO_START - 1; c < COL_PHOTO_START - 1 + NUM_PHOTO_COLS; c++) {
      if (!data[i][c]) {
        sheet.getRange(i + 1, c + 1).setValue(driveLink);
        attached = true;
        break;
      }
    }
    break;
  }

  // 5. Nếu chưa attach được → lưu pending (chờ text gửi sau)
  if (!attached) {
    const props = PropertiesService.getScriptProperties();
    const key   = "DPENDING_" + tgId;
    const arr   = JSON.parse(props.getProperty(key) || "[]");
    if (arr.length < NUM_PHOTO_COLS) {
      arr.push(driveLink);
      props.setProperty(key, JSON.stringify(arr));
    }
  }

  Logger.log("📷 Photo saved: " + fileName + " | attached=" + attached);
  return jsonOut({ status: "ok", attached, link: driveLink, file: fileName });
}

// ================================================================
//  LOOKUP TÊN NHÂN VIÊN từ tab "ID Telegram"
//  Cột E = Telegram ID  |  Cột B = Tên nhân viên
// ================================================================
function lookupEmployeeName_(ss, telegramId) {
  if (!telegramId) return "";
  try {
    const sheet = ss.getSheetByName(ID_TG_TAB);
    if (!sheet) {
      Logger.log("⚠️ Tab '" + ID_TG_TAB + "' không tìm thấy");
      return "";
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      const colE = String(data[i][4] || "").trim();   // Cột E (index 4)
      const colB = String(data[i][1] || "").trim();   // Cột B (index 1)
      if (colE === telegramId && colB) return colB;
    }
    Logger.log("⚠️ Không tìm thấy Telegram ID: " + telegramId);
  } catch (e) {
    Logger.log("❌ lookupEmployeeName: " + e.message);
  }
  return "";
}

// ================================================================
//  DRIVE — tạo/lấy thư mục lưu ảnh
//  Path: 1 VCM BRANCH TNI / 2.5 Daily report and Businesstrip Telegram / [tgId]
// ================================================================
function getOrCreateDailyFolder_(tgId) {
  // Folder cha: "1 VCM BRANCH TNI"
  const parentIt = DriveApp.getFoldersByName(DRIVE_PARENT);
  const parent   = parentIt.hasNext() ? parentIt.next() : DriveApp.getRootFolder();

  // Folder chính
  const mainIt   = parent.getFoldersByName(DRIVE_FOLDER);
  const main     = mainIt.hasNext() ? mainIt.next() : parent.createFolder(DRIVE_FOLDER);

  // Sub-folder theo Telegram ID
  const subIt = main.getFoldersByName(tgId);
  return subIt.hasNext() ? subIt.next() : main.createFolder(tgId);
}

// ================================================================
//  HELPER — đọc cột A và trích xuất danh sách tên field
// ================================================================
function getFieldsFromColA_(sheet) {
  const vals = sheet.getRange("A1:A15").getValues().flat();
  return vals
    .map(v => {
      const s = String(v || "").trim();
      if (!s) return null;
      let name = s.indexOf(":") > -1 ? s.substring(0, s.indexOf(":")).trim() : s;
      name = name.replace(/^\d+\.?\s+/, "").trim();
      return name || null;
    })
    .filter(Boolean);
}

// ================================================================
//  OUTPUT JSON
// ================================================================
function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================================================================
//  SETUP — chạy 1 lần sau khi deploy để khởi tạo header
// ================================================================
function setupDailySheet() {
  const result = handleSyncHeaders();
  Logger.log("✅ Headers synced: " + result.getContent());
}

// ================================================================
//  TEST — kiểm tra không cần deploy
// ================================================================
function testGetFields() {
  Logger.log(JSON.stringify(handleGetFields().getContent()));
}

function testLookup() {
  const ss = SpreadsheetApp.openById(DAILY_SHEET_ID);
  Logger.log("Name: " + lookupEmployeeName_(ss, "6859790680"));
}

// ============================================================
// DAILY PLAN — Team leader assign Plan tab (GID: 853981745)
// ============================================================

const DAILY_PLAN_TAB = "Team leader assign Plan";

/**
 * Store a daily plan entry with comparison data.
 * Payload: { action: "store_daily_plan", date, team, content, daily_report, comparison }
 * Auto-generates REF. Dedup by date+team.
 */
function handleStoreDailyPlan(body) {
  try {
    const ss = SpreadsheetApp.openById(DAILY_SHEET_ID);
    let sheet = ss.getSheetByName(DAILY_PLAN_TAB);
    if (!sheet) {
      sheet = ss.insertSheet(DAILY_PLAN_TAB);
      sheet.getRange(1, 1, 1, 6).setValues(
        [["REF", "Date", "Team", "Daily Plan", "Daily Report", "Comparison"]]
      );
      sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
    }

    const date       = (body.date       || "").toString().trim();
    const team       = (body.team       || "").toString().trim();
    const content    = (body.content    || "").toString().trim();
    const report     = (body.daily_report || "").toString().trim();
    const comparison = (body.comparison || "").toString().trim();

    if (!date || !team) {
      return jsonOut({ status: "error", message: "Missing date or team" });
    }

    // Dedup: same date + team?
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const existing = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
      for (let i = 0; i < existing.length; i++) {
        const exDate = existing[i][0].toString().trim();
        const exTeam = existing[i][1].toString().trim();
        if (exDate === date && exTeam.toLowerCase() === team.toLowerCase()) {
          // Update existing row E and F if new data
          if (report)     sheet.getRange(i + 2, 5).setValue(report);
          if (comparison) sheet.getRange(i + 2, 6).setValue(comparison);
          return jsonOut({ status: "ok", message: "Updated existing", ref: sheet.getRange(i + 2, 1).getValue(), duplicate: true });
        }
      }
    }

    const refNum = lastRow;
    const ref = "DP-" + String(refNum).padStart(3, "0");
    sheet.appendRow([ref, date, team, content, report, comparison]);

    return jsonOut({ status: "ok", ref: ref });
  } catch (err) {
    return jsonOut({ status: "error", message: err.message });
  }
}

/**
 * Get all daily plan entries.
 * Returns array of { ref, date, team, content, daily_report, comparison }
 */
function handleGetDailyPlans() {
  try {
    const ss = SpreadsheetApp.openById(DAILY_SHEET_ID);
    const sheet = ss.getSheetByName(DAILY_PLAN_TAB);
    if (!sheet || sheet.getLastRow() < 2) {
      return jsonOut({ status: "ok", plans: [] });
    }

    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    const plans = [];

    for (let i = 0; i < data.length; i++) {
      const ref        = data[i][0].toString().trim();
      const date       = data[i][1].toString().trim();
      const team       = data[i][2].toString().trim();
      const content    = data[i][3].toString().trim();
      const report     = data[i][4].toString().trim();
      const comparison = data[i][5].toString().trim();
      if (date || team) {
        plans.push({ ref, date, team, content, daily_report: report, comparison });
      }
    }

    return jsonOut({ status: "ok", plans: plans });
  } catch (err) {
    return jsonOut({ status: "error", message: err.message });
  }
}

/**
 * Get daily report entries from "Daily report and Bussiness" tab.
 * Payload: { action: "get_daily_reports", date: "26/06/2026" }
 * Returns data from columns B:S filtered by date in col C (Daily report date).
 */
function handleGetDailyReports(body) {
  try {
    const ss = SpreadsheetApp.openById(DAILY_SHEET_ID);
    const sheet = ss.getSheetByName(DAILY_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) {
      return jsonOut({ status: "ok", reports: [] });
    }

    const filterDate = (body.date || "").toString().trim();
    const lastRow = sheet.getLastRow();
    // Read B:S = columns 2 to 19
    const data = sheet.getRange(2, 2, lastRow - 1, 18).getValues();
    // Read header row for field names
    const headers = sheet.getRange(1, 2, 1, 18).getValues()[0];
    const reports = [];

    for (let i = 0; i < data.length; i++) {
      const empName  = data[i][0].toString().trim();   // B = col 0 in range
      const dateCell = data[i][1].toString().trim();   // C = col 1 in range
      const tgId     = data[i][16].toString().trim();  // R = col 16 in range
      const empName2 = data[i][17].toString().trim();  // S = col 17 in range

      if (!empName && !tgId) continue;

      // Filter by date if provided
      if (filterDate && dateCell && !dateCell.includes(filterDate)) continue;

      // Build fields object from all columns
      const fields = {};
      for (let c = 0; c < headers.length; c++) {
        const hdr = headers[c].toString().trim();
        const val = data[i][c].toString().trim();
        if (hdr && val) fields[hdr] = val;
      }

      reports.push({
        name: empName || empName2,
        telegram_id: tgId,
        date: dateCell,
        fields: fields
      });
    }

    return jsonOut({ status: "ok", reports: reports });
  } catch (err) {
    return jsonOut({ status: "error", message: err.message });
  }
}
