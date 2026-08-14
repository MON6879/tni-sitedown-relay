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
const DR_SHEET_ID_NEW   = "1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y";
const DAILY_SHEET_NAME = "Daily report and Bussiness";
const ID_TG_TAB        = "ID Telegram";   // Tab chứa Name ↔ Telegram ID
const DRIVE_PARENT     = "1 VCM BRANCH TNI";
const DRIVE_FOLDER     = "2.5 Daily report and Businesstrip Telegram";
const TIMEZONE         = "Asia/Yangon";   // UTC+6:30

// ─── CỘT (1-indexed) sau khi khôi phục cột REF và Tên nhân viên ──────────────────
// A=1   → số thứ tự (REF)
// B=2   → Tên nhân viên (lookup qua ARRAYFORMULA)
// C-P   → 14 cột dữ liệu (bắt đầu từ cột C, tương ứng index 2)
// Q=17  → Telegram ID người gửi
// R=18  → User name người gửi (cũ là tên nhân viên)
// S-X   → 6 ảnh Google Drive (cột 19 đến 24)
const COL_REF          = 1;   // A
const COL_EMP_NAME     = 2;   // B
const COL_DATA_START   = 3;   // C
const NUM_DATA_COLS    = 14;  // C → P
const COL_TG_ID        = 17;  // Q
const COL_USER_NAME    = 18;  // R
const COL_PHOTO_START  = 19;  // S
const NUM_PHOTO_COLS   = 6;   // S → X
const DR_TOTAL_COLS    = 24;  // A → X
const TEMPLATE_ROWS    = 0;

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
    return jsonOut({ status: "error", message: err.message, stack: err.stack });
  }
}

function doGetDaily_(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";
    if (action === "get_fields") return handleGetFields();
    return jsonOut({ status: "ok", message: "Daily Report Collector running" });
  } catch (err) {
    return jsonOut({ status: "error", message: err.message, stack: err.stack });
  }
}

// 🛡️ Webhook Enforcer: Tự động khôi phục 100% Webhook cho @SEARCHTNITASKWOBOT 24/7
function autoEnforceSearchBotWebhook() {
  const token = "8606383435:AAEstcN4Om6_9ZAjs4OoFV2uVlRALgae2Ac";
  const expectedUrl = "https://tni-bot.vercel.app/api/search_bot";
  try {
    const res = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/getWebhookInfo", { muteHttpExceptions: true });
    const json = JSON.parse(res.getContentText());
    if (json.ok && json.result && json.result.url !== expectedUrl) {
      UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/setWebhook?url=" + encodeURIComponent(expectedUrl), { muteHttpExceptions: true });
      Logger.log("🛡️ Search Bot Webhook Auto-Restored to Vercel!");
    }
  } catch(e) {
    Logger.log("Error checking Search Bot webhook: " + e.message);
  }
}

// ================================================================
//  GET_FIELDS — đọc cột A, trả về danh sách tên field
//  Loại bỏ số thứ tự và dấu ":" ở cuối
// ================================================================
function handleGetFields() {
  const ss    = SpreadsheetApp.openById(DR_SHEET_ID_NEW);
  const sheet = ss.getSheetByName(DAILY_SHEET_NAME);
  if (!sheet) return jsonOut({ status: "error", message: "Sheet not found: " + DAILY_SHEET_NAME });

  // Đọc danh sách field trực tiếp từ header hàng 1 (cột B đến P)
  const vals = sheet.getRange(1, COL_DATA_START, 1, NUM_DATA_COLS).getValues()[0];
  const fields = [];

  for (const v of vals) {
    const s = String(v || "").trim();
    if (!s) continue;
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
  const ss    = SpreadsheetApp.openById(DR_SHEET_ID_NEW);
  const sheet = ss.getSheetByName(DAILY_SHEET_NAME);
  if (!sheet) return jsonOut({ status: "error", message: "Sheet not found" });

  // Định dạng hàng 1 cho các cột dữ liệu (C đến Q) mà không ghi đè nội dung
  sheet.getRange(1, COL_DATA_START, 1, NUM_DATA_COLS)
       .setFontWeight("bold")
       .setBackground("#D9E1F2");

  // Cột A header = REF (số thứ tự dòng dữ liệu)
  sheet.getRange(1, COL_REF).setValue("REF").setFontWeight("bold").setBackground("#D9EAD3");

  // Cột B header = Tên nhân viên (công thức tự động)
  sheet.getRange(1, COL_EMP_NAME).setValue("Tên nhân viên").setFontWeight("bold").setBackground("#D9EAD3");

  // Cột R = Telegram ID (cột 18)
  sheet.getRange(1, COL_TG_ID).setValue("Telegram ID").setFontWeight("bold").setBackground("#FCE4D6");

  // ARRAYFORMULA tự động lấy tên từ tab 'ID Telegram' (Cột E = TG ID, Cột B = Tên)
  // Ghi vào B2 — áp dụng cho toàn bộ cột B mãi mãi (dựa vào cột R = Telegram ID)
  const arrayFormula =
    "=ARRAYFORMULA(IF(R2:R=\"\",,IFERROR(INDEX('ID Telegram'!B:B," +
    "MATCH(TEXT(R2:R,\"0\"),'ID Telegram'!E:E,0)),\"?\")))"; 
  sheet.getRange(2, COL_EMP_NAME).setFormula(arrayFormula);

  // Cột S → X = Photo 1-6 (cột 19 đến 24)
  const photoHeaders = [["Photo 1","Photo 2","Photo 3","Photo 4","Photo 5","Photo 6"]];
  sheet.getRange(1, COL_PHOTO_START, 1, NUM_PHOTO_COLS)
       .setValues(photoHeaders)
       .setFontWeight("bold")
       .setBackground("#E2EFDA");

  return jsonOut({ status: "ok", message: "Headers synced and formatted successfully" });
}

// ================================================================
//  DAILY_ADD — thêm dòng báo cáo mới vào sheet
//  Payload: { action, telegram_id, fields:{fieldName:value,...} }
// ================================================================
function handleDailyAdd(body) {
  const ss    = SpreadsheetApp.openById(DR_SHEET_ID_NEW);
  const sheet = ss.getSheetByName(DAILY_SHEET_NAME);
  if (!sheet) return jsonOut({ status: "error", message: "Sheet not found" });

  const tgId    = String(body.telegram_id || "").trim();
  const userName = String(body.user_name || "").trim();
  const fields  = body.fields || {};

  // Lấy header hàng 1 để map đúng cột
  const headers = sheet.getRange(1, COL_DATA_START, 1, NUM_DATA_COLS).getValues()[0];

  // Smart key alias mapping for Daily Report columns C..P (indices 0..13)
  const KEY_ALIASES = [
    ["daily result", "daily report", "date"],                                       // C: Daily Result
    ["full name", "name", "ft name"],                                               // D: Full Name
    ["transportation used", "transportation"],                                      // E: Transportation Used
    ["site down", "site rescue", "rescue site down", "hot task rescue site down"],  // F: I. Hot task rescue Site down >24
    ["cell rescue", "hot task cell rescue"],                                        // G: II Hot task Cell rescue
    ["dg abnormal", "dg abnomal", "site repair alarm", "cable", "rescue cable"],     // H: III. Hot task Repair DG abnomal
    ["dg run", "run>16h", "run >16h", "follow partner refuel"],                    // I: IV. Hot task Repair DG run>16H
    ["other task", "hot task other"],                                               // J: V. Hot task other
    ["detail wo", "wo"],                                                            // K: VII. Detail WO
    ["detail task", "task"],                                                        // L: VII. Detail task
    ["busines trip start", "start go"],                                             // M: Trip start
    ["busines trip end", "end go"],                                                 // N: Trip end
    ["km moto bike start", "km start"],                                             // O: Km start
    ["km moto bike the end", "km end"]                                              // P: Km end
  ];

  // Helper: clean text for key matching (bỏ dấu 1., 2., I., VII. và khoảng trắng)
  const cleanK = str => String(str || "").toLowerCase().replace(/^[\d\w\.\s]+::?/, "").replace(/^[0-9ivx]+\.\s*/i, "").trim();

  // Build dataRow theo thứ tự header C..P
  const dataRow = headers.map((h, idx) => {
    const colHeaderClean = cleanK(h);
    const colAliases     = KEY_ALIASES[idx] || [colHeaderClean];

    // 1. Thử tìm giá trị trong fields khớp với bất kỳ alias nào của cột này
    for (const [k, v] of Object.entries(fields)) {
      const fieldKeyClean = cleanK(k);
      const valStr        = String(v || "").trim();
      if (!valStr) continue;

      // Khớp alias hoăc khớp substring giữa header và field key
      if (colAliases.some(alias => fieldKeyClean.includes(alias) || alias.includes(fieldKeyClean))) {
        return valStr;
      }
    }

    // 2. Fallback: So sánh trực tiếp k vs header
    for (const [k, v] of Object.entries(fields)) {
      const fieldKeyClean = cleanK(k);
      const valStr        = String(v || "").trim();
      if (!valStr) continue;
      if (fieldKeyClean && (fieldKeyClean.includes(colHeaderClean) || colHeaderClean.includes(fieldKeyClean))) {
        return valStr;
      }
    }
    return "";
  });

  // 📅 ÉP NGÀY CHUẨN: Cột C (Daily Result Date) nếu không tìm thấy trong bài sẽ tự động lấy ngày hôm nay (dd/MM/yyyy)
  if (!dataRow[0] || !dataRow[0].trim()) {
    dataRow[0] = Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy");
  }
  // 👤 ÉP TÊN CHUẨN: Cột D (Full Name) nếu rỗng sẽ tự động lấy tên Telegram User Name
  if ((!dataRow[1] || !dataRow[1].trim()) && userName) {
    dataRow[1] = userName;
  }

  // ✅ BẢO VỆ CHỐNG DÒNG RỖNG: Kiểm tra nếu không có dữ liệu nội dung → Bỏ qua không chèn dòng trống
  const hasContent = dataRow.some(val => String(val || "").trim().length > 0);
  if (!hasContent) {
    Logger.log("⚠️ handleDailyAdd: Dữ liệu fields rỗng — Bỏ qua không chèn dòng trống.");
    return jsonOut({ status: "error", message: "Empty report content — skipped creating empty row" });
  }

  // Build full row (A→X = 24 cột)
  const row = new Array(DR_TOTAL_COLS).fill("");
  dataRow.forEach((v, i) => { row[COL_DATA_START - 1 + i] = v; }); // C:P = data
  row[COL_TG_ID - 1]      = tgId;   // Q = Telegram ID
  row[COL_USER_NAME - 1]  = userName; // R = User name

  // Tính REF bằng cách quét giá trị cột A hiện tại để tìm số lớn nhất (tránh lỗi dòng trống hoặc khi bị xóa hàng)
  const lastRow = sheet.getLastRow();
  let maxRef = 0;
  if (lastRow > 1) {
    const refValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < refValues.length; i++) {
      const val = parseInt(refValues[i][0], 10);
      if (!isNaN(val) && val > maxRef) {
        maxRef = val;
      }
    }
  }
  const ref = String(maxRef + 1).padStart(5, "0");
  row[COL_REF - 1] = ref; // Ghi REF vào cột A (index 0)

  // Chèn dòng mới tại dòng 2 (ngay dưới header) để báo cáo mới nhất luôn ở đầu
  sheet.insertRowBefore(2);

  // Ghi dữ liệu vào dòng 2. Để tránh ghi đè làm hỏng ARRAYFORMULA tại cột B (COL_EMP_NAME = 2):
  // 1) Ghi cột A (REF)
  sheet.getRange(2, 1).setValue(ref).setFontWeight("bold").setHorizontalAlignment("center");
  // 2) Ghi cột C->R (cột 3 đến 18). Cột B (index 1) bỏ qua không ghi đè.
  sheet.getRange(2, 3, 1, 16).setValues([row.slice(2, 18)]);

  // Màu nền cho dòng dữ liệu mới
  sheet.getRange(2, 1, 1, DR_TOTAL_COLS).setBackground("#EBF3FB");

  // Attach ảnh pending (nếu người dùng đã gửi ảnh trước text)
  const props   = PropertiesService.getScriptProperties();
  const pKey    = "DPENDING_" + tgId;
  const pending = JSON.parse(props.getProperty(pKey) || "[]");
  if (pending.length > 0) {
    pending.slice(0, NUM_PHOTO_COLS).forEach((link, idx) => {
      sheet.getRange(2, COL_PHOTO_START + idx).setValue(link);
    });
    props.deleteProperty(pKey);
  }

  // 🔄 AUTO-SYNC: Đẩy kết quả Daily Result sang Cột E (Daily Report) & Cột F (Comparison) trong tab "Team leader assign Plan"
  syncResultToPlanTab_(ss, row[2], userName || tgId, row[3]);

  Logger.log("✅ Daily row added to row 2: REF:" + ref + " tgId=" + tgId);
  return jsonOut({ status: "ok", row: 2, ref: ref, name: userName || tgId });
}

/**
 * Tự động đồng bộ Daily Result sang Cột E (Daily Report) & F (Comparison) của tab "Team leader assign Plan".
 */
function syncResultToPlanTab_(ss, dateStr, userNameStr, reportSummary) {
  try {
    const planSheet = ss.getSheetByName(DAILY_PLAN_TAB);
    if (!planSheet || planSheet.getLastRow() < 2) return;
    
    const lastRow = planSheet.getLastRow();
    const data = planSheet.getRange(2, 1, lastRow - 1, 6).getValues();
    const targetDate = parseDateToDDMMYYYY_(dateStr) || parseDateToDDMMYYYY_(Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy"));
    const summaryClean = String(reportSummary || "").trim();
    if (!summaryClean) return;

    for (let i = 0; i < data.length; i++) {
      const rowDate = parseDateToDDMMYYYY_(data[i][1].toString().trim());
      if (rowDate === targetDate) {
        const rowIdx = i + 2;
        const existingRep = planSheet.getRange(rowIdx, 5).getValue().toString().trim();
        const appendText = "• " + (userNameStr || "NV") + ": " + summaryClean.substring(0, 150);
        const newRep = existingRep ? (existingRep + "\n" + appendText) : appendText;
        planSheet.getRange(rowIdx, 5).setValue(newRep); // Ghi Cột E (Daily Report)
        planSheet.getRange(rowIdx, 6).setValue("✅ SYNCED (" + Utilities.formatDate(new Date(), TIMEZONE, "HH:mm") + ")"); // Ghi Cột F (Comparison)
        Logger.log("✅ Auto-synced Result to Plan tab row " + rowIdx);
        break;
      }
    }
  } catch (e) {
    Logger.log("⚠️ syncResultToPlanTab_ error: " + e.message);
  }
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
  const ss    = SpreadsheetApp.openById(DR_SHEET_ID_NEW);
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
  const ss = SpreadsheetApp.openById(DR_SHEET_ID_NEW);
  Logger.log("Name: " + lookupEmployeeName_(ss, "6859790680"));
}

// ============================================================
// DAILY PLAN — Team leader assign Plan tab (GID: 853981745)
// ============================================================

const DAILY_PLAN_TAB = "Team leader assign Plan";

/**
 * Normalize a date value (JS Date object, "Wed Jul 15 2026...", or "15/07/2026") → "DD/MM/YYYY".
 * Used for robust deduplication regardless of how the date was stored.
 */
function parseDateToDDMMYYYY_(rawDate) {
  if (!rawDate) return "";
  const s = rawDate.toString().trim().replace(/\./g, "/");

  // DD/MM/YYYY or D/M/YYYY or YY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    let yr = dmy[3];
    if (yr.length === 2) yr = "20" + yr;
    return dmy[1].padStart(2, "0") + "/" + dmy[2].padStart(2, "0") + "/" + yr;
  }

  // JS Date toString: "Wed Jul 15 2026 00:00:00 GMT+0630 (Myanmar Time)"
  const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
                   jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
  const parts = s.split(/[\s,]+/);
  for (let i = 0; i < parts.length - 2; i++) {
    const mon = parts[i].toLowerCase().substring(0, 3);
    if (months[mon]) {
      const day  = parseInt(parts[i + 1], 10);
      const year = parseInt(parts[i + 2], 10);
      if (!isNaN(day) && !isNaN(year) && year > 2000) {
        return String(day).padStart(2, "0") + "/" +
               String(months[mon]).padStart(2, "0") + "/" + year;
      }
    }
  }

  // Try parsing as JS Date object directly
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      // Convert to Myanmar timezone (UTC+6:30)
      const utcMs = d.getTime() + (6 * 60 + 30) * 60 * 1000;
      const mm = new Date(utcMs);
      return String(mm.getUTCDate()).padStart(2, "0") + "/" +
             String(mm.getUTCMonth() + 1).padStart(2, "0") + "/" +
             mm.getUTCFullYear();
    }
  } catch (e) {}

  return s; // fallback: return as-is
}

/**
 * Store a daily plan entry with comparison data.
 * Payload: { action: "store_daily_plan", date, team, content, daily_report, comparison }
 * Auto-generates REF. Dedup by date+team (date normalized to DD/MM/YYYY).
 */
function handleStoreDailyPlan(body) {
  try {
    const ss = SpreadsheetApp.openById(DR_SHEET_ID_NEW);
    let sheet = ss.getSheetByName(DAILY_PLAN_TAB);
    if (!sheet) {
      sheet = ss.insertSheet(DAILY_PLAN_TAB);
      sheet.getRange(1, 1, 1, 6).setValues(
        [["REF", "Date", "Team", "Daily Plan", "Daily Report", "Comparison"]]
      );
      sheet.getRange(1, 1, 1, 6).setFontWeight("bold");
    }

    const rawDate    = (body.date       || "").toString().trim();
    const team       = (body.team       || "").toString().trim();
    const content    = (body.content    || "").toString().trim();
    const report     = (body.daily_report || "").toString().trim();
    const comparison = (body.comparison || "").toString().trim();

    if (!rawDate || !team) {
      return jsonOut({ status: "error", message: "Missing date or team" });
    }

    // Normalize incoming date to DD/MM/YYYY for consistent storage
    const date = parseDateToDDMMYYYY_(rawDate);

    // Normalize team string to "Team N" canonical form
    const teamNorm = team.replace(/team\s*0?/i, "Team ").trim();

    const lastRow = sheet.getLastRow();

    // Compute max existing REF across the sheet (e.g. DP-164 -> max 164)
    let maxRef = 0;
    if (lastRow >= 2) {
      const refValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < refValues.length; i++) {
        const m = String(refValues[i][0]).match(/(\d+)/);
        if (m) {
          const val = parseInt(m[1], 10);
          if (!isNaN(val) && val > maxRef) maxRef = val;
        }
      }
    }
    const nextRef = "DP-" + String(maxRef + 1).padStart(3, "0");

    // Dedup: same date + team?
    if (lastRow >= 2) {
      const existing = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
      for (let i = 0; i < existing.length; i++) {
        const exDateRaw = existing[i][0].toString().trim();
        const exTeamRaw = existing[i][1].toString().trim();
        const exDate = parseDateToDDMMYYYY_(exDateRaw);
        const exTeam = exTeamRaw.replace(/team\s*0?/i, "Team ").trim();
        if (exDate === date && exTeam.toLowerCase() === teamNorm.toLowerCase()) {
          const rowIdx = i + 2;
          let refVal = sheet.getRange(rowIdx, 1).getValue().toString().trim();
          if (!refVal || refVal === "DP-OK" || refVal === "?") {
            refVal = nextRef;
            sheet.getRange(rowIdx, 1).setValue(refVal).setFontWeight("bold").setHorizontalAlignment("center");
          }
          if (report)     sheet.getRange(rowIdx, 5).setValue(report);
          if (comparison) sheet.getRange(rowIdx, 6).setValue(comparison);
          if (content)    sheet.getRange(rowIdx, 4).setValue(content);
          sheet.getRange(rowIdx, 2).setValue(date);

          return jsonOut({ status: "ok", message: "Updated existing", ref: refVal, duplicate: true });
        }
      }
    }

    // Insert new row at Row 2 (newest first, under header Row 1)
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, 6).setValues([[nextRef, date, teamNorm, content, report, comparison]]);
    sheet.getRange(2, 1).setFontWeight("bold").setHorizontalAlignment("center");

    // Dual-Sync sang Bảng tính thứ 2 (Cable Collect Data / Search Sheet 1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8)
    try {
      const secSs = SpreadsheetApp.openById("1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8");
      let secSheet = secSs.getSheetByName(DAILY_PLAN_TAB);
      if (secSheet) {
        secSheet.insertRowBefore(2);
        secSheet.getRange(2, 1, 1, 6).setValues([[nextRef, date, teamNorm, content, report, comparison]]);
        secSheet.getRange(2, 1).setFontWeight("bold").setHorizontalAlignment("center");
        Logger.log("[Dual-Sync] Successfully written " + nextRef + " to Secondary Sheet 1Etd2PmbY5Lg...");
      }
    } catch(secErr) {
      Logger.log("[Dual-Sync] Warning secondary sheet write: " + secErr.message);
    }

    return jsonOut({ status: "ok", ref: nextRef });
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
    const ss = SpreadsheetApp.openById(DR_SHEET_ID_NEW);
    const sheet = ss.getSheetByName(DAILY_PLAN_TAB);
    if (!sheet || sheet.getLastRow() < 2) {
      return jsonOut({ status: "ok", plans: [] });
    }

    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    const plans = [];

    for (let i = 0; i < data.length; i++) {
      const ref        = data[i][0].toString().trim();
      // Normalize date to DD/MM/YYYY so Python parse_plan_date() works reliably
      const date       = parseDateToDDMMYYYY_(data[i][1].toString().trim());
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
    const ss = SpreadsheetApp.openById(DR_SHEET_ID_NEW);
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
