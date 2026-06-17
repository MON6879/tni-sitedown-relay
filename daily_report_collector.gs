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
const COL_B            = 2;
const COL_DATA_START   = 3;   // C
const NUM_DATA_COLS    = 15;  // C → Q
const COL_TG_ID        = 18;  // R
const COL_EMP_NAME     = 19;  // S
const COL_PHOTO_START  = 20;  // T
const NUM_PHOTO_COLS   = 6;   // T → Y
const TOTAL_COLS       = 25;  // A → Y

// ================================================================
//  ENTRY POINTS
// ================================================================

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === "daily_add")    return handleDailyAdd(body);
    if (body.action === "daily_photo")  return handleDailyPhoto(body);
    if (body.action === "sync_headers") return handleSyncHeaders();
    return jsonOut({ status: "error", message: "Unknown action: " + body.action });
  } catch (err) {
    return jsonOut({ status: "error", message: err.message });
  }
}

function doGet(e) {
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

  // Cột B header
  sheet.getRange(1, COL_B).setValue("Tên nhân viên").setFontWeight("bold").setBackground("#D9E1F2");

  // Cột R = Telegram ID, Cột S = Employee Name
  sheet.getRange(1, COL_TG_ID).setValue("Telegram ID").setFontWeight("bold").setBackground("#FCE4D6");
  sheet.getRange(1, COL_EMP_NAME).setValue("Tên nhân viên").setFontWeight("bold").setBackground("#FCE4D6");

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

  // Lookup tên nhân viên từ tab "ID Telegram"
  const empName = lookupEmployeeName_(ss, tgId);

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
  const row = new Array(TOTAL_COLS).fill("");
  row[COL_B - 1]          = empName;                   // B = Tên NV
  dataRow.forEach((v, i) => { row[COL_DATA_START - 1 + i] = v; }); // C:Q = data
  row[COL_TG_ID - 1]      = tgId;                      // R = Telegram ID
  row[COL_EMP_NAME - 1]   = empName;                   // S = Tên NV

  sheet.appendRow(row);
  const rowNum = sheet.getLastRow();

  // Màu xen kẽ
  const bg = rowNum % 2 === 0 ? "#EBF3FB" : "#FFFFFF";
  sheet.getRange(rowNum, 1, 1, TOTAL_COLS).setBackground(bg);

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

  Logger.log("✅ Daily row added: row=" + rowNum + " tgId=" + tgId + " name=" + empName);
  return jsonOut({ status: "ok", row: rowNum, name: empName });
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
//  Tự động thử cả 2 chiều: (Name|TgID) hoặc (TgID|Name)
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
      const a = String(data[i][0] || "").trim();
      const b = String(data[i][1] || "").trim();
      // Thử col B = Telegram ID, col A = Name
      if (b === telegramId && a) return a;
      // Thử col A = Telegram ID, col B = Name
      if (a === telegramId && b) return b;
    }
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
