// ============================================================
// TNI Asset Collector — Google Apps Script
// ============================================================
// Deploy as Web App:
//   Execute as: Me | Who has access: Anyone
// ============================================================

const SHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8";

// Tab where collected data is stored (gid = 199426270)
const DATA_TAB        = "Asset order and request";

// Tab where authorised users are listed (gid = 1236389870)
// Layout: Col A = Field Name (existing)  |  Col B = Name  |  Col C = Telegram ID
const CFG_TAB         = "Config";

// Tab for search activity log
const SEARCH_LOG_TAB  = "Search Log";

// Tab for aggregated search stats (one row per user)
const SEARCH_STATS_TAB = "Search Stats";

// Tab for general combined report (Name + ID + Content + Search stats)
const GENERAL_TAB      = "General";

// GID of the daily report sheet (gid=133591305)
const REPORT_GID       = "133591305";

// ============================================================
// ENTRY POINTS
// ============================================================

function doPost(e) {
  try {
    const body  = JSON.parse(e.postData.contents);
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getDataSheet(ss);

    if (body.action === "add")              return handleAdd(sheet, body);
    if (body.action === "done")             return handleDone(sheet, ss, body);
    if (body.action === "find")             return handleFind(sheet, body);
    if (body.action === "add_photo")        return handleAddPhoto(sheet, body);
    if (body.action === "register_chat")    return handleRegisterChat(ss, body);
    if (body.action === "register_user")    return handleRegisterUser(ss, body);
    if (body.action === "get_users")        return handleGetUsers(ss);
    if (body.action === "log_search")       return handleLogSearch(ss, body);
    if (body.action === "refresh_general") return handleRefreshGeneral(ss);
    if (body.action === "get_general")      return handleGetGeneral(ss);
    if (body.action === "get_report_data")   return handleGetReportData(ss);
    if (body.action === "get_asset_stats")   return handleGetAssetStats(ss);

    return json({ status: "error", message: "Unknown action: " + body.action });
  } catch (err) {
    return json({ status: "error", message: err.message });
  }
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";

    // ── Site Down data endpoint (cho Python Telethon sender) ──
    if (action === "get_site_down_data") return getSiteDownData();

    // ── Default: status check ─────────────────────────────────
    const ss = SpreadsheetApp.openById(SHEET_ID);
    getDataSheet(ss);
    setupConfigHeaders(ss);
    const ids = getAllowedIds(ss);
    return json({ status: "ok", message: "TNI Collector running", allowed: ids.size });
  } catch (err) {
    return json({ status: "error", message: err.message });
  }
}

// ============================================================
// GET_SITE_DOWN_DATA — đọc Sheet site down, trả JSON cho Python
// Sheet: 1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow (GID=0)
// ============================================================
function getSiteDownData() {
  try {
    const SD_SHEET_ID  = "1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow";
    const SD_SHEET_GID = "0";

    const ss = SpreadsheetApp.openById(SD_SHEET_ID);
    let sheet = null;
    for (const s of ss.getSheets()) {
      if (s.getSheetId().toString() === SD_SHEET_GID) { sheet = s; break; }
    }
    if (!sheet) return json({ status: "error", message: "Sheet not found" });

    // A1: timestamp/nội dung báo cáo mới nhất
    const a1 = sheet.getRange("A1").getValue().toString().trim();

    // Col C: toàn bộ dữ liệu đã tính bằng formula
    const lastRow = sheet.getLastRow();
    const colC = lastRow > 0
      ? sheet.getRange(1, 3, lastRow, 1).getValues().flat()
              .map(c => (c || "").toString().trim())
              .filter(c => c.length > 0)
      : [];

    // AW4:AZ8 (5 rows × 4 cols) — summary per team
    const awaz = sheet.getRange(4, 49, 5, 4).getValues();

    // AW4 timestamp
    const aw4 = sheet.getRange("AW4").getValue().toString().trim();

    return json({ status: "ok", a1, colC, awaz, aw4 });
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
  const dateTime = body.date    || "";
  const chatId   = body.chat_id || "";

  // NEW format: body.msg = "Order: TNI0002 ..."
  // OLD format: body.fields = {order:"...", revoke:"..."} + body.sender_name
  let content = body.msg || "";
  if (!content && body.fields && typeof body.fields === "object") {
    const parts = [];
    for (const [k, v] of Object.entries(body.fields)) {
      if (v) parts.push(k.charAt(0).toUpperCase() + k.slice(1) + ": " + v);
    }
    content = parts.join("\n");
  }

  const row = ["", dateTime, chatId, content, ""];
  sheet.appendRow(row);

  const rowNum = sheet.getLastRow();
  const seqId  = rowNum - 1;

  // Ghi REF vào cột A
  sheet.getRange(rowNum, 1).setValue(seqId);

  // Gắn ảnh pending (nếu user đã gửi ảnh trước khi gửi text)
  const props   = PropertiesService.getScriptProperties();
  const pKey    = "PENDING_PHOTO_" + chatId;
  const pending = JSON.parse(props.getProperty(pKey) || "[]");
  if (pending.length > 0) {
    pending.forEach(function(link, idx) {
      if (idx < 6) {
        sheet.getRange(rowNum, 6 + idx).setValue(link); // F=6, G=7 ... K=11
      }
    });
    props.deleteProperty(pKey);
  }

  const bg = seqId % 2 === 0 ? "#EBF3FB" : "#FFFFFF";
  sheet.getRange(rowNum, 1, 1, 11).setBackground(bg); // A–K

  return json({ status: "ok", message: "Row added", row: seqId });
}

// ============================================================
// ACTION: ADD_PHOTO — ảnh Telegram → Google Drive → link vào cột F–K
// Payload: { action, user_id, tg_url, date }
// Cột F=6, G=7, H=8, I=9, J=10, K=11 (tối đa 6 ảnh)
// ============================================================
function handleAddPhoto(sheet, body) {
  const userId = String(body.user_id || "").trim();
  const tgUrl  = body.tg_url || "";
  if (!userId || !tgUrl) {
    return json({ status: "error", message: "Missing user_id or tg_url" });
  }

  // 1. Download ảnh từ Telegram
  let blob;
  try {
    blob = UrlFetchApp.fetch(tgUrl, { muteHttpExceptions: true }).getBlob();
  } catch(e) {
    return json({ status: "error", message: "Download failed: " + e.message });
  }

  // 2. Upload lên Google Drive folder 'TNI_Asset_Photos'
  const folder   = getOrCreatePhotoFolder_();
  const file     = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const driveLink = "https://drive.google.com/file/d/" + file.getId() + "/view";

  // 3. Tìm dòng gần nhất của user này trong 30 phút
  const data   = sheet.getDataRange().getValues();
  const WIN_MS = 30 * 60 * 1000;
  const nowMs  = new Date().getTime();
  let attached = false;

  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][2] || "").trim() !== userId) continue;  // Col C = user_id
    const rowTime = parseSheetDate_(String(data[i][1] || ""));
    if (!rowTime || (nowMs - rowTime.getTime()) > WIN_MS) break; // quá cũ

    // Tìm cột ảnh trống (F=col5 → K=col10, index 0-based)
    for (let c = 5; c <= 10; c++) {
      if (!data[i][c]) {
        sheet.getRange(i + 1, c + 1).setValue(driveLink);
        attached = true;
        break;
      }
    }
    break;
  }

  // 4. Nếu chưa có dòng → lưu tạm (chờ text gửi sau)
  if (!attached) {
    const props = PropertiesService.getScriptProperties();
    const key   = "PENDING_PHOTO_" + userId;
    const arr   = JSON.parse(props.getProperty(key) || "[]");
    if (arr.length < 6) {
      arr.push(driveLink);
      props.setProperty(key, JSON.stringify(arr));
    }
  }

  return json({ status: "ok", attached: attached, link: driveLink });
}

// Tạo hoặc lấy folder '2.2 TNIASSET TELEGRAM' bên trong '1 VCM BRANCH TNI'
function getOrCreatePhotoFolder_() {
  const PARENT_NAME = "1 VCM BRANCH TNI";
  const CHILD_NAME  = "2.2 TNIASSET TELEGRAM";

  // Tìm folder cha
  const parents = DriveApp.getFoldersByName(PARENT_NAME);
  const parent  = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();

  // Tìm hoặc tạo folder con bên trong
  const children = parent.getFoldersByName(CHILD_NAME);
  return children.hasNext() ? children.next() : parent.createFolder(CHILD_NAME);
}


// Parse date string "dd/MM/yyyy HH:mm" → Date object
function parseSheetDate_(str) {
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
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

  // Tìm hàng bằng cách quét cột A (REF ID) — an toàn khi xóa dòng
  const lastRow   = sheet.getLastRow();
  if (lastRow < 2) {
    return json({ status: "error", message: "Sheet trống" });
  }

  const colA      = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const rowIndex  = colA.findIndex(v => parseInt(v) === refId);

  if (rowIndex === -1) {
    return json({ status: "error", message: "Không tìm thấy REF:" + String(refId).padStart(5,"0") + " (có thể đã bị xóa)" });
  }

  const targetRow = rowIndex + 2;   // +1 header, +1 vì findIndex bắt đầu từ 0

  // Cột E (col 5): gộp Done nhiều lần vào 1 ô (append)
  const existing = sheet.getRange(targetRow, 5).getValue().toString().trim();

  const doneDate   = body.done_date   || "";
  const doneTime   = body.done_time   || "";
  const doneDetail = body.done        || "";
  const doneNote   = body.note        || "";
  const configName = getNameById(ss, doerId) || (body.sender_name || "");

  let newEntry = "Done";
  if (doneDetail) newEntry += " " + doneDetail;
  newEntry += " + " + doneDate + " " + doneTime;
  if (configName) newEntry += " (" + configName + ")";
  if (doneNote)   newEntry += " | " + doneNote;

  // Gộp vào ô hiện có (nếu đã có nội dung trước đó)
  const doneText = existing ? existing + "\n" + newEntry : newEntry;

  sheet.getRange(targetRow, 5)
       .setValue(doneText)
       .setBackground("#D9EAD3")
       .setFontColor("#137333")
       .setFontWeight("bold")
       .setWrap(true);

  return json({ status: "ok", message: "Done updated", row: refId, done_text: newEntry });
}

// ============================================================
// ACTION: REGISTER_CHAT — lưu tên + ID nhóm vào sheet "Chat IDs"
// ============================================================
function handleRegisterChat(ss, body) {
  const chatId    = String(body.chat_id    || "").trim();
  const chatTitle = String(body.chat_title || "").trim();
  const chatType  = String(body.chat_type  || "").trim();
  const regBy     = String(body.reg_by     || "").trim();
  const now       = new Date();
  const dateStr   = Utilities.formatDate(now, "Asia/Rangoon", "dd/MM/yyyy HH:mm");

  if (!chatId) return json({ status: "error", message: "chat_id is required" });

  // Tạo hoặc lấy sheet "Chat IDs"
  let sheet = ss.getSheetByName("Chat IDs");
  if (!sheet) {
    sheet = ss.insertSheet("Chat IDs");
    const headers = ["Chat Title", "Chat ID", "Type", "Registered By", "Date"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, 5)
         .setFontWeight("bold")
         .setBackground("#4472C4")
         .setFontColor("#FFFFFF")
         .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, 5, 180);
    SpreadsheetApp.flush();
  }

  // Kiểm tra trùng chat_id
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat().map(String);
    if (ids.includes(chatId)) {
      return json({ status: "duplicate", message: "Chat \"" + chatTitle + "\" (" + chatId + ") đã có rồi" });
    }
  }

  sheet.appendRow([chatTitle, chatId, chatType, regBy, dateStr]);
  return json({ status: "ok", message: "Đã lưu: " + chatTitle + " (" + chatId + ")" });
}

// ============================================================
// ACTION: FIND — search column C for matching content text
// Returns the first matching row ID (sequential, not row number)
// Payload: { action, text }
// ============================================================
function handleFind(sheet, body) {
  const searchText = (body.text || "").trim().toLowerCase();
  if (!searchText) return json({ status: "error", message: "text is required" });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return json({ status: "not_found", message: "Sheet is empty" });

  // Col A = REF, Col D = Content (sau khi thêm cột A)
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues(); // A,B,C,D

  // Tìm từ dưới lên (ưu tiên dòng mới nhất nếu trùng nội dung)
  for (let i = data.length - 1; i >= 0; i--) {
    const refVal  = data[i][0];  // col A = REF
    const content = (data[i][3] || "").toString().trim().toLowerCase(); // col D = content
    if (!content) continue;
    // Bi-directional: content chứa searchText HOẶC searchText chứa content
    if (content === searchText || content.includes(searchText) || searchText.includes(content)) {
      return json({ status: "ok", row: parseInt(refVal) || (i + 1) });
    }
  }
  return json({ status: "not_found", message: "No matching request found" });
}

// ============================================================
// ACTION: REGISTER_USER — lưu tên + Telegram ID vào tab Config
// Col B = Name  |  Col C = Telegram ID
// ============================================================
function handleRegisterUser(ss, body) {
  const userId   = String(body.user_id   || "").trim();
  const userName = String(body.user_name || "").trim();

  if (!userId) return json({ status: "error", message: "user_id is required" });

  // Tạo hoặc lấy sheet "User IDs"
  let sheet = ss.getSheetByName("User IDs");
  if (!sheet) {
    sheet = ss.insertSheet("User IDs");
    const headers = ["Name", "Telegram ID", "Date"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, 3)
         .setFontWeight("bold")
         .setBackground("#4472C4")
         .setFontColor("#FFFFFF")
         .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 220);
    sheet.setColumnWidth(2, 160);
    sheet.setColumnWidth(3, 160);
    SpreadsheetApp.flush();
  }

  // Kiểm tra trùng Telegram ID (col B)
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat().map(String);
    if (ids.includes(userId)) {
      return json({ status: "duplicate", message: "ID " + userId + " đã có rồi" });
    }
  }

  const now     = new Date();
  const dateStr = Utilities.formatDate(now, "Asia/Rangoon", "dd/MM/yyyy HH:mm");
  sheet.appendRow([userName, userId, dateStr]);
  return json({ status: "ok", message: "Đã lưu: " + userName + " (" + userId + ")" });
}

// ============================================================
// ACTION: GET_USERS — trả về danh sách Name + Telegram ID từ Config
// Dùng bởi send_now.py để tra cứu ID theo tên
// ============================================================
function handleGetUsers(ss) {
  const config = ss.getSheetByName("Config");
  if (!config) return json({ status: "error", message: "Config sheet not found" });

  const lastRow = config.getLastRow();
  if (lastRow < 2) return json({ status: "ok", users: [] });

  const data  = config.getRange(2, 1, lastRow - 1, 3).getValues(); // col A,B,C
  const users = [];
  for (const row of data) {
    const name = (row[0] || "").toString().trim();
    const id   = (row[1] || "").toString().trim();
    if (name && id) users.push({ name, id });
  }
  return json({ status: "ok", users });
}

// ============================================================
// ACTION: LOG_SEARCH — ghi nhật ký tìm kiếm TNI + cập nhật stats
// ============================================================
function handleLogSearch(ss, body) {
  const userName = (body.user_name || "").toString().trim();
  const userId   = (body.user_id   || "").toString().trim();
  const tniCode  = (body.tni_code  || "").toString().trim().toUpperCase();
  const dateStr  = (body.date      || "").toString().trim();
  const timeStr  = (body.time      || "").toString().trim();

  if (!userId || !tniCode) {
    return json({ status: "error", message: "Thiếu user_id hoặc tni_code" });
  }

  // Lấy / tạo tab "Search Log"
  let logSheet = ss.getSheetByName(SEARCH_LOG_TAB);
  if (!logSheet) {
    logSheet = ss.insertSheet(SEARCH_LOG_TAB);
    logSheet.appendRow(["Date", "Time", "User Name", "User ID", "TNI Code"]);
    logSheet.getRange(1, 1, 1, 5).setFontWeight("bold")
            .setBackground("#34A853").setFontColor("#FFFFFF");
  }

  // Ghi 1 dòng log
  logSheet.appendRow([dateStr, timeStr, userName, userId, tniCode]);

  // Cập nhật Search Stats
  refreshStats(ss);

  return json({ status: "ok" });
}

// ============================================================
// HELPER: refreshStats — tính lại thống kê, ghi vào "Search Stats"
// Format: "Name & ID & Day:D-2/D-1/Today & Week:X & Month:Y"
// ============================================================
function refreshStats(ss) {
  const logSheet = ss.getSheetByName(SEARCH_LOG_TAB);
  if (!logSheet || logSheet.getLastRow() < 2) return;

  // Đọc toàn bộ log (bỏ header)
  const lastRow = logSheet.getLastRow();
  const data    = logSheet.getRange(2, 1, lastRow - 1, 5).getValues();
  // Cols: 0=Date, 1=Time, 2=UserName, 3=UserID, 4=TNICode

  // Ngày hôm nay (Rangoon UTC+6:30)
  const now     = new Date();
  const tz      = "Asia/Rangoon";
  const today   = Utilities.formatDate(now, tz, "dd/MM/yyyy");
  const d1      = Utilities.formatDate(new Date(now - 86400000),   tz, "dd/MM/yyyy");
  const d2      = Utilities.formatDate(new Date(now - 2*86400000), tz, "dd/MM/yyyy");
  const msWeek  = 7  * 86400000;
  const msMonth = 30 * 86400000;

  // Tổng hợp theo user
  const users = {};  // key = userId
  for (const row of data) {
    const dateVal  = (row[0] || "").toString().trim();
    const userName = (row[2] || "").toString().trim();
    const userId   = (row[3] || "").toString().trim();
    if (!userId) continue;

    if (!users[userId]) {
      users[userId] = { name: userName, today: 0, d1: 0, d2: 0, week: 0, month: 0 };
    }
    const u = users[userId];

    // Parse dd/MM/yyyy → Date
    const parts = dateVal.split("/");
    let rowDate = null;
    if (parts.length === 3) {
      rowDate = new Date(+parts[2], +parts[1]-1, +parts[0]);
    }
    if (!rowDate) continue;

    const diffMs = now - rowDate;
    if (dateVal === today)   u.today++;
    if (dateVal === d1)      u.d1++;
    if (dateVal === d2)      u.d2++;
    if (diffMs <= msWeek)    u.week++;
    if (diffMs <= msMonth)   u.month++;
  }

  // Lấy / tạo tab "Search Stats"
  let statsSheet = ss.getSheetByName(SEARCH_STATS_TAB);
  if (!statsSheet) {
    statsSheet = ss.insertSheet(SEARCH_STATS_TAB);
    statsSheet.getRange(1, 1).setValue("Search Stats (auto-updated)");
    statsSheet.getRange(1, 1).setFontWeight("bold")
              .setBackground("#4285F4").setFontColor("#FFFFFF");
  }

  // Xóa dữ liệu cũ (từ hàng 2 trở đi)
  const statLast = statsSheet.getLastRow();
  if (statLast >= 2) statsSheet.getRange(2, 1, statLast - 1, 1).clearContent();

  // Ghi từng dòng tổng hợp
  let writeRow = 2;
  for (const uid of Object.keys(users)) {
    const u = users[uid];
    const summary = `${u.name} & ${uid} & Day:${u.d2}/${u.d1}/${u.today} & Week:${u.week} & Month:${u.month}`;
    statsSheet.getRange(writeRow, 1).setValue(summary);
    writeRow++;
  }
}

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

// Tìm tên trong Config (col B) theo Telegram ID (col C)
function getNameById(ss, telegramId) {
  let cfg = ss.getSheetByName(CFG_TAB);
  if (!cfg) {
    for (const s of ss.getSheets()) {
      if (s.getSheetId().toString() === "1236389870") { cfg = s; break; }
    }
  }
  if (!cfg || cfg.getLastRow() < 2) return "";

  const rows = cfg.getRange(2, 1, cfg.getLastRow() - 1, 3).getValues();
  for (const r of rows) {
    if (String(r[2]).trim() === String(telegramId).trim()) {
      return String(r[1]).trim();  // col B = Name
    }
  }
  return "";
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

// ============================================================
// HELPER: buildSearchStatsMap
// ============================================================
function buildSearchStatsMap(ss) {
  const map = {};
  const logSheet = ss.getSheetByName(SEARCH_LOG_TAB);
  if (!logSheet || logSheet.getLastRow() < 2) return map;
  const tz = 'Asia/Rangoon';
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'dd/MM/yyyy');
  const d1 = Utilities.formatDate(new Date(now - 86400000), tz, 'dd/MM/yyyy');
  const d2 = Utilities.formatDate(new Date(now - 2*86400000), tz, 'dd/MM/yyyy');
  const msWeek = 7 * 86400000;
  const msMonth = 30 * 86400000;
  const last = logSheet.getLastRow();
  const data = logSheet.getRange(2, 1, last - 1, 4).getValues();
  for (const row of data) {
    const dateVal = (row[0] || '').toString().trim();
    const name = (row[2] || '').toString().trim().toLowerCase();
    if (!name) continue;
    if (!map[name]) map[name] = { today: 0, d1: 0, d2: 0, week: 0, month: 0 };
    const u = map[name];
    const parts = dateVal.split('/');
    if (parts.length !== 3) continue;
    const rowDate = new Date(+parts[2], +parts[1]-1, +parts[0]);
    const diffMs = now - rowDate;
    if (dateVal === today) u.today++;
    if (dateVal === d1) u.d1++;
    if (dateVal === d2) u.d2++;
    if (diffMs <= msWeek) u.week++;
    if (diffMs <= msMonth) u.month++;
  }
  return map;
}

// ============================================================
// HELPER: fetchReportSheet
// ============================================================
function fetchReportSheet() {
  // Dung SpreadsheetApp doc truc tiep (khong can UrlFetchApp)
  // Report sheet co GID = 133591305, nam trong cung spreadsheet
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let reportSheet = null;
  for (const s of ss.getSheets()) {
    if (s.getSheetId().toString() === REPORT_GID) { reportSheet = s; break; }
  }
  if (!reportSheet) return { employees: [], leaders: [] };

  const lastRow = reportSheet.getLastRow();
  if (lastRow < 3) return { employees: [], leaders: [] };

  // Doc tu dong 1 den cuoi — doc toi 6 cot (A-F) de co them du lieu neu co
  const maxCol = Math.max(reportSheet.getLastColumn(), 6);
  const data = reportSheet.getRange(1, 1, lastRow, maxCol).getValues();
  const employees = [];
  const leaders   = [];
  const managers  = [];

  for (let i = 0; i < data.length; i++) {
    const row  = data[i];
    const team = (row[0] || '').toString().trim();
    const name = (row[1] || '').toString().trim();
    const colC = (row[2] || '').toString().trim();
    const cont = (row[3] || '').toString().trim();
    const colE = (row[4] || '').toString().trim();
    // colF (index 5) dự phòng nếu có thêm cột (username hệ thống)
    const colF = row.length > 5 ? (row[5] || '').toString().trim() : '';

    // Bo qua dong header
    if (team === 'Assign Site' || team.indexOf('Export time') >= 0) continue;
    if (name === 'Assign Site' || name === 'Name System') continue;
    // Bo qua team "All WO" (gia)
    if (team === 'All WO') continue;

    if (/Team leader/i.test(colC)) {
      // Doi truong: co team, ten, noi dung
      leaders.push({ team: team, name: name, content: cont, chat_id: colE, sys_name: colF });
    } else if (team && name) {
      // Nhan vien: co ca team va ten - lay chat_id tu cot E
      employees.push({ team: team, name: name, content: cont, chat_id: colE, sys_name: colF });
    } else if (colE && /^\d{5,}$/.test(colE.trim())) {
      // Quan ly: co ID cot E la so (Telegram ID dang so, khong phai "-")
      const mgName = name || team || colC || ('ID:' + colE);
      managers.push({ role: colC || 'Manager', name: mgName, chat_id: colE.trim() });
    }
  }
  return { employees: employees, leaders: leaders, managers: managers };
}

// ============================================================
// ACTION: REFRESH_GENERAL
// ============================================================
function handleRefreshGeneral(ss) {
  const statsMap = buildSearchStatsMap(ss);
  const data = fetchReportSheet();
  const employees = data.employees;
  let gen = ss.getSheetByName(GENERAL_TAB);
  if (!gen) gen = ss.insertSheet(GENERAL_TAB);
  gen.clearContents();
  gen.appendRow(['Team', 'Nhan vien', 'Hom nay', 'Hom qua', 'Hom kia', 'Tuan', 'Thang']);
  gen.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#1565C0').setFontColor('#FFFFFF');
  for (const emp of employees) {
    const s = statsMap[emp.name.toLowerCase()] || { today: 0, d1: 0, d2: 0, week: 0, month: 0 };
    gen.appendRow([emp.team, emp.name, s.today, s.d1, s.d2, s.week, s.month]);
  }
  gen.setColumnWidth(1, 200);
  gen.setColumnWidth(2, 160);
  SpreadsheetApp.flush();
  return json({ status: 'ok', message: 'General refreshed — ' + employees.length + ' rows' });
}

// ============================================================
// ACTION: GET_REPORT_DATA — for send_now.py / cron_send.py
// Trả về đầy đủ: search stats + WO stats + assign task + dep breakdown
// ============================================================
function handleGetReportData(ss) {
  const statsMap = buildSearchStatsMap(ss);
  const cfgIdMap = {};
  const cfg = ss.getSheetByName(CFG_TAB);
  if (cfg && cfg.getLastRow() >= 2) {
    const cfgData = cfg.getRange(2, 1, cfg.getLastRow() - 1, 2).getValues();
    for (const row of cfgData) {
      const n = (row[0] || '').toString().trim().toLowerCase();
      const id = (row[1] || '').toString().trim();
      if (n && id) cfgIdMap[n] = id;
    }
  }

  const data = fetchReportSheet();
  const employees = data.employees;
  const leaders   = data.leaders;
  const managers  = data.managers;

  // ── Tính số ngày trong kỳ tháng (từ 21 tháng trước đến hôm nay) ──
  const tz = 'Asia/Rangoon';
  const now = new Date();
  const nowLocal = new Date(now.getTime() + 6.5 * 3600000);
  const dayNow = nowLocal.getUTCDate();
  let monthStart;
  if (dayNow <= 20) {
    monthStart = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth() - 1, 21) - 6.5 * 3600000);
  } else {
    monthStart = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), 21) - 6.5 * 3600000);
  }
  const monthDays = Math.floor((now - monthStart) / 86400000) + 1;

  // ── Parse WO stats từ cột D (content) của mỗi nhân viên/TL ──
  // Format cột D chứa sẵn báo cáo WO: ta parse ra các trường cần
  function parseWoFromContent(content) {
    const result = {
      wo_remain:    0,   // WO còn lại tổng
      site_remain:  0,   // Site còn lại
      wo_total:     0,   // Tổng WO
      wo_month_close: 0, // WO đóng trong kỳ tháng
      wo_week_close:  0, // WO đóng 7 ngày
      wo_d0: 0, wo_d1: 0, wo_d2: 0, // WO đóng hôm nay/qua/kia
      assign_remain: 0,  // Assign task còn lại
      assign_month_close: 0,
      dep_stats: {},     // { Asset: {remain:N, point:P}, CM: {...}, ... }
      eod_reported: 0,   // Số NV báo cáo cuối ngày (chỉ dùng cho TL)
    };
    if (!content) return result;

    // WO remain: "WO remain : 34" hoặc "WO remain: 34"
    const woRm = content.match(/WO\s*remain\s*[:\s]+?(\d+)/i);
    if (woRm) result.wo_remain = parseInt(woRm[1]) || 0;

    // Site remain: "Site: 11" hoặc "Site : 11"
    const siteRm = content.match(/Site\s*:\s*(\d+)/i);
    if (siteRm) result.site_remain = parseInt(siteRm[1]) || 0;

    // Month close (kỳ tháng): "Month Xday :77" hoặc "Month 18day :77"
    const moClose = content.match(/Month\s+\d+day\s*:\s*(\d+)/i);
    if (moClose) result.wo_month_close = parseInt(moClose[1]) || 0;

    // WO close 7 day: "/Close 7day: 26"
    const wkClose = content.match(/Close\s+7day\s*:\s*(\d+)/i);
    if (wkClose) result.wo_week_close = parseInt(wkClose[1]) || 0;

    // WO total: "M: 0 /26" — 26 là tổng WO tháng
    const mTotal = content.match(/M:\s*\d+\s*\/\s*(\d+)/i);
    if (mTotal) result.wo_total = parseInt(mTotal[1]) || 0;

    // Daily: "<:> 0/0/2/209" (TL: hôm nay/qua/kia/tổng team)
    // hoặc "<0/0/0>" (NV: 3day hôm nay/qua/kia)
    const dailyTL = content.match(/<:>\s*(\d+)\/(\d+)\/(\d+)\/(\d+)/);
    if (dailyTL) {
      result.wo_d0 = parseInt(dailyTL[1]) || 0;
      result.wo_d1 = parseInt(dailyTL[2]) || 0;
      result.wo_d2 = parseInt(dailyTL[3]) || 0;
      result.wo_total = parseInt(dailyTL[4]) || result.wo_total;
    } else {
      const daily3 = content.match(/<(\d+)\/(\d+)\/(\d+)>/);
      if (daily3) {
        result.wo_d0 = parseInt(daily3[1]) || 0;
        result.wo_d1 = parseInt(daily3[2]) || 0;
        result.wo_d2 = parseInt(daily3[3]) || 0;
      }
    }

    // Assign remain: "Assign: 30" hoặc "Assign: *60"
    const assignRm = content.match(/Assign\s*:\s*\*?(\d+)/i);
    if (assignRm) result.assign_remain = parseInt(assignRm[1]) || 0;

    // Assign month close: "Task Close Month: 0: 0/0/0" — lấy số đầu
    const assignMo = content.match(/Task\s*Close\s*Month\s*:\s*(\d+)/i);
    if (assignMo) result.assign_month_close = parseInt(assignMo[1]) || 0;

    // EOD (báo cáo cuối ngày): "3-Day Result: 11/0/0/0" — 11=tổng NV, 3 số sau là báo cáo hôm nay/qua/kia
    const eod = content.match(/3-Day\s*Result\s*:\s*(\d+)\/(\d+)\/(\d+)\/(\d+)/i);
    if (eod) result.eod_reported = parseInt(eod[2]) || 0; // số NV báo cáo hôm nay

    // Dep stats: "Asset : 3/P: 0" hoặc "Asset : TL:6 /13 P:0"
    // Pattern NV: "DepName : N/P: P_score"
    // Pattern TL: "DepName : TL:tl_count /total P:score"
    const depNV = /([A-Za-z&\s]+?)\s*:\s*(\d+)\/P:\s*(\d+)/g;
    const depTL = /([A-Za-z&\s]+?)\s*:\s*TL:(\d+)\s*\/(\d+)\s*P:(\d+)/g;
    let m;
    while ((m = depTL.exec(content)) !== null) {
      const dep = m[1].trim();
      if (dep && !['WO remain', 'Assign', 'Task Close Month', 'All Task Close', 'Close'].includes(dep)) {
        result.dep_stats[dep] = { tl_count: parseInt(m[2])||0, total: parseInt(m[3])||0, point: parseInt(m[4])||0, is_tl: true };
      }
    }
    // Chỉ parse NV nếu không có TL pattern
    if (Object.keys(result.dep_stats).length === 0) {
      while ((m = depNV.exec(content)) !== null) {
        const dep = m[1].trim();
        if (dep && !['WO remain', 'Assign', 'Task Close Month', 'All Task Close', 'Close', 'M', 'Site'].includes(dep)) {
          result.dep_stats[dep] = { remain: parseInt(m[2])||0, point: parseInt(m[3])||0, is_tl: false };
        }
      }
    }

    return result;
  }

  // ── Tính rank dựa trên % close WO theo tuần lũy kế ──
  // Tuần trong tháng: tuần 1=25%, tuần 2=50%, tuần 3=75%, tuần 4=100%
  function calcRank(wo_total, wo_month_close, month_days) {
    if (!wo_total) return 0;
    const weekNum = Math.min(4, Math.ceil(month_days / 7));  // tuần 1-4
    const target_pct = weekNum * 25;                          // 25/50/75/100%
    const actual_pct = Math.round(wo_month_close / wo_total * 100);
    // rank = điểm delta so với target (>0 tốt, <0 trễ)
    return actual_pct - target_pct;
  }

  // ── Tính % close ──
  function calcClosePct(wo_total, wo_month_close) {
    if (!wo_total) return 0;
    return Math.round(wo_month_close / wo_total * 100);
  }

  // ── Search team stats ──
  const teamStats = {};
  for (const emp of employees) {
    const s = statsMap[emp.name.toLowerCase()] || { today: 0, d1: 0, d2: 0, week: 0, month: 0 };
    if (!teamStats[emp.team]) teamStats[emp.team] = { today: 0, d1: 0, d2: 0, week: 0, month: 0 };
    const t = teamStats[emp.team];
    t.today += s.today; t.d1 += s.d1; t.d2 += s.d2; t.week += s.week; t.month += s.month;
  }

  // ── Team WO totals (tổng từ nhân viên trong team) ──
  const teamWo = {}; // team -> { wo_remain, wo_total, wo_month_close, wo_week_close, wo_d0,d1,d2, assign_remain, member_count }
  for (const emp of employees) {
    const wo = parseWoFromContent(emp.content);
    if (!teamWo[emp.team]) teamWo[emp.team] = { wo_remain:0, wo_total:0, wo_month_close:0, wo_week_close:0, wo_d0:0, wo_d1:0, wo_d2:0, assign_remain:0, assign_month_close:0, member_count:0 };
    const t = teamWo[emp.team];
    t.wo_remain       += wo.wo_remain;
    t.wo_total        += wo.wo_total;
    t.wo_month_close  += wo.wo_month_close;
    t.wo_week_close   += wo.wo_week_close;
    t.wo_d0           += wo.wo_d0;
    t.wo_d1           += wo.wo_d1;
    t.wo_d2           += wo.wo_d2;
    t.assign_remain   += wo.assign_remain;
    t.assign_month_close += wo.assign_month_close;
    t.member_count    += 1;
  }

  // ── Assign task stats từ Input task sheet ──
  const INPUT_GID = '1755404595';
  const inputSh = ss.getSheets().find(s => s.getSheetId().toString() === INPUT_GID);
  const assignByDep = {}; // dep -> { total, done, remain }
  if (inputSh && inputSh.getLastRow() >= 2) {
    const rows = inputSh.getRange(2, 1, inputSh.getLastRow() - 1, 10).getValues();
    for (const r of rows) {
      const dep  = (r[1] || '').toString().trim();
      const con  = (r[3] || '').toString().trim();
      const done = (r[9] || '').toString().trim();
      if (!dep || !con || ['nan','dep assign','sum'].includes(dep.toLowerCase())) continue;
      if (!assignByDep[dep]) assignByDep[dep] = { total: 0, done: 0, remain: 0 };
      assignByDep[dep].total++;
      if (done) assignByDep[dep].done++; else assignByDep[dep].remain++;
    }
  }

  // ── Build employee result ──
  // Tính rank toàn bộ NV rồi sắp xếp để gán rank số thứ tự
  const empWithWo = employees.map(emp => {
    const s = statsMap[emp.name.toLowerCase()] || { today: 0, d1: 0, d2: 0, week: 0, month: 0 };
    const chatId = emp.chat_id || cfgIdMap[emp.name.toLowerCase()] || '';
    const wo = parseWoFromContent(emp.content);
    const close_pct = calcClosePct(wo.wo_total, wo.wo_month_close);
    return { name: emp.name, sys_name: emp.sys_name, team: emp.team, chat_id: chatId,
             content: emp.content,
             search_today: s.today, search_d1: s.d1, search_d2: s.d2, search_week: s.week, search_month: s.month,
             wo_remain: wo.wo_remain, site_remain: wo.site_remain, wo_total: wo.wo_total,
             wo_month_close: wo.wo_month_close, wo_week_close: wo.wo_week_close,
             wo_d0: wo.wo_d0, wo_d1: wo.wo_d1, wo_d2: wo.wo_d2,
             assign_remain: wo.assign_remain, assign_month_close: wo.assign_month_close,
             dep_stats: wo.dep_stats,
             close_pct: close_pct,
             _rank_score: close_pct };
  });
  // Sắp xếp theo % close giảm dần để gán rank
  const sorted = [...empWithWo].sort((a,b) => b._rank_score - a._rank_score);
  const rankMap = {};
  sorted.forEach((e, idx) => { rankMap[e.name] = idx + 1; });
  const empResult = empWithWo.map(e => ({ ...e, rank: rankMap[e.name] || 0 }));

  // ── Build leader result ──
  const ldResult = [];
  let leaderRankIdx = 1;
  // Sắp xếp leader theo % close để gán rank
  const ldWithScore = leaders.map(ld => {
    const wo = parseWoFromContent(ld.content);
    // Đọc thêm từ TL content: "3-Day Result: 11/0/0/0" → member_count / eod_today / eod_d1 / eod_d2
    const eodM = ld.content.match(/3-Day\s*Result\s*:\s*(\d+)\/(\d+)\/(\d+)\/(\d+)/i);
    const member_count   = eodM ? parseInt(eodM[1]) || 0 : 0;
    const eod_today      = eodM ? parseInt(eodM[2]) || 0 : 0;
    const eod_d1         = eodM ? parseInt(eodM[3]) || 0 : 0;
    const eod_d2         = eodM ? parseInt(eodM[4]) || 0 : 0;
    // TL task close: "Team leader task Close: X"
    const tlCloseM = ld.content.match(/Team\s*leader\s*task\s*Close\s*:\s*(\d+)/i);
    const tl_task_close = tlCloseM ? parseInt(tlCloseM[1]) || 0 : 0;
    // All Task Close: "All Task Close: 1 : 0 : 0 : 0" — 4 kỳ trong tháng
    const allCloseM = ld.content.match(/All\s*Task\s*Close\s*:\s*(\d+)\s*:\s*(\d+)\s*:\s*(\d+)\s*:\s*(\d+)/i);
    const all_task_close = allCloseM ? [parseInt(allCloseM[1])||0, parseInt(allCloseM[2])||0, parseInt(allCloseM[3])||0, parseInt(allCloseM[4])||0] : [0,0,0,0];
    const close_pct = calcClosePct(wo.wo_total, wo.wo_month_close);
    const chatId = ld.chat_id || cfgIdMap[ld.name.toLowerCase()] || '';
    const twStats = teamWo[ld.team] || { wo_remain:0, wo_total:0, wo_month_close:0, wo_week_close:0, wo_d0:0, wo_d1:0, wo_d2:0, assign_remain:0, member_count:0 };
    return {
      name: ld.name, sys_name: ld.sys_name, team: ld.team, chat_id: chatId, content: ld.content,
      member_count: member_count || twStats.member_count,
      eod_today, eod_d1, eod_d2,
      wo_remain: wo.wo_remain || twStats.wo_remain,
      wo_total: wo.wo_total || twStats.wo_total,
      wo_month_close: wo.wo_month_close || twStats.wo_month_close,
      wo_week_close: wo.wo_week_close || twStats.wo_week_close,
      wo_d0: wo.wo_d0 || twStats.wo_d0,
      wo_d1: wo.wo_d1 || twStats.wo_d1,
      wo_d2: wo.wo_d2 || twStats.wo_d2,
      assign_remain: wo.assign_remain || twStats.assign_remain,
      assign_month_close: wo.assign_month_close || twStats.assign_month_close,
      dep_stats: wo.dep_stats,
      tl_task_close, all_task_close,
      close_pct: close_pct,
      _rank_score: close_pct
    };
  });
  const ldSorted = [...ldWithScore].sort((a,b) => b._rank_score - a._rank_score);
  const ldRankMap = {};
  ldSorted.forEach((e, idx) => { ldRankMap[e.name] = idx + 1; });
  ldWithScore.forEach(ld => ldResult.push({ ...ld, rank: ldRankMap[ld.name] || 0 }));

  // --- Tổng toàn bộ (cho ban quản lý) ---
  const grandTotal = { today: 0, d1: 0, d2: 0, week: 0, month: 0 };
  for (const t of Object.values(teamStats)) {
    grandTotal.today += t.today; grandTotal.d1 += t.d1; grandTotal.d2 += t.d2;
    grandTotal.week += t.week;   grandTotal.month += t.month;
  }

  // --- Team summary list (for management message) ---
  const teamSummary = [];
  for (const [team, s] of Object.entries(teamStats)) {
    const tw = teamWo[team] || {};
    teamSummary.push({ team, today: s.today, d1: s.d1, d2: s.d2, week: s.week, month: s.month,
                       wo_remain: tw.wo_remain||0, assign_remain: tw.assign_remain||0 });
  }

  handleRefreshGeneral(ss);
  return json({
    status: 'ok',
    month_days: monthDays,
    employees: empResult,
    leaders: ldResult,
    managers: managers,
    teamSummary: teamSummary,
    grandTotal: grandTotal,
    assignByDep: assignByDep
  });
}

// JSON response helper
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ACTION: GET_ASSET_STATS
// Đếm Order/Revoke/... theo Team + theo khoảng thời gian
// Col A=REF | Col B=Date | Col C=chat_id | Col D=Content | Col E=Done
// Periods: today(1) / yesterday(1) / 2days / 6days / 15days
// ============================================================
function handleGetAssetStats(ss) {
  const TEAMS = [
    'MYT_TNI_TEAM01_Dawei',
    'MYT_TNI_TEAM02_Myeik',
    'MYT_TNI_TEAM03_Bokpyin',
    'MYT_TNI_TEAM04_Kawthoung'
  ];
  const PERIODS = [0, 1, 2, 6, 15]; // ngày: 0=hôm nay, 1=hôm qua, 2=2 ngày trước, 6=tuần, 15=nửa tháng

  // Mốc thời gian (giờ Myanmar = UTC+6:30)
  const now   = new Date();
  const tzOff = 6.5 * 60 * 60 * 1000;
  const today = new Date(Math.floor((now.getTime() + tzOff) / 86400000) * 86400000 - tzOff);
  // today = đầu ngày hôm nay theo giờ Myanmar

  function dayStart(daysAgo) {
    return new Date(today.getTime() - daysAgo * 86400000);
  }

  // --- Bước 1: Config ---
  const cfgSheet   = ss.getSheetByName(CFG_TAB);
  const actionTypes = [];
  const recipients  = [];
  if (cfgSheet && cfgSheet.getLastRow() >= 2) {
    const cfgData = cfgSheet.getRange(2, 1, cfgSheet.getLastRow() - 1, 3).getValues();
    for (const row of cfgData) {
      const colA = (row[0] || '').toString().trim();
      const colC = (row[2] || '').toString().trim();
      if (colC && /^\d{5,}$/.test(colC)) recipients.push(colC);
      if (colA) {
        const type = colA.split(':')[0].trim();
        if (type && !actionTypes.includes(type)) actionTypes.push(type);
      }
    }
  }

  // --- Bước 2: Map chat_id → team ---
  const reportSheet = SpreadsheetApp.openById(SHEET_ID).getSheets()
    .find(s => s.getSheetId().toString() === REPORT_GID);
  const idToTeam = {};
  if (reportSheet && reportSheet.getLastRow() >= 2) {
    const rData = reportSheet.getRange(2, 1, reportSheet.getLastRow() - 1, 5).getValues();
    for (const r of rData) {
      const team   = (r[0] || '').toString().trim();
      const chatId = (r[4] || '').toString().trim();
      if (team && chatId && TEAMS.includes(team)) idToTeam[chatId] = team;
    }
  }

  // --- Bước 3: Khởi tạo stats ---
  // stats[at][team] = { d0,d1,d2,d6,d15,done_d0,done_d1,done_d2,done_d6,done_d15,total,done }
  function emptyPeriod() {
    return { d0:0,d1:0,d2:0,d6:0,d15:0, done_d0:0,done_d1:0,done_d2:0,done_d6:0,done_d15:0, total:0,done:0 };
  }
  const stats = {};
  for (const at of actionTypes) {
    stats[at] = {};
    for (const tm of TEAMS) stats[at][tm] = emptyPeriod();
  }

  // --- Bước 4: Đọc và đếm ---
  const dataSh = ss.getSheetByName(DATA_TAB);
  if (dataSh && dataSh.getLastRow() >= 2) {
    const rows = dataSh.getRange(2, 1, dataSh.getLastRow() - 1, 5).getValues();
    for (const r of rows) {
      const rawDate = r[1];                                    // Col B = date
      const chatId  = (r[2] || '').toString().trim();         // Col C
      const content = (r[3] || '').toString().trim();         // Col D
      const doneVal = (r[4] || '').toString().trim();         // Col E
      if (!content) continue;

      const actionType = content.split(':')[0].trim();
      if (!actionTypes.includes(actionType)) continue;

      const team = idToTeam[chatId] || null;
      if (!team) continue;

      // Parse ngày
      let rowDate = null;
      if (rawDate instanceof Date) {
        rowDate = rawDate;
      } else if (rawDate) {
        const parts = rawDate.toString().split('/');
        if (parts.length === 3) rowDate = new Date(parts[2], parts[1]-1, parts[0]);
      }

      const isDone = doneVal.length > 0;
      const s = stats[actionType][team];
      s.total += 1;
      if (isDone) s.done += 1;

      if (rowDate) {
        const diffDays = Math.floor((today.getTime() - rowDate.getTime()) / 86400000);
        if (diffDays === 0)  { s.d0++;  if (isDone) s.done_d0++;  }
        if (diffDays === 1)  { s.d1++;  if (isDone) s.done_d1++;  }
        if (diffDays === 2)  { s.d2++;  if (isDone) s.done_d2++;  }
        if (diffDays <  6)  { s.d6++;  if (isDone) s.done_d6++;  }
        if (diffDays < 15)  { s.d15++; if (isDone) s.done_d15++; }
      }
    }
  }

  // --- Bước 5: Grand total ---
  const grandTotal = {};
  for (const at of actionTypes) {
    grandTotal[at] = emptyPeriod();
    for (const tm of TEAMS) {
      const s = stats[at][tm];
      const g = grandTotal[at];
      ['d0','d1','d2','d6','d15','done_d0','done_d1','done_d2','done_d6','done_d15','total','done']
        .forEach(k => g[k] += s[k]);
    }
  }

  return json({
    status:      'ok',
    actionTypes: actionTypes,
    teams:       TEAMS,
    stats:       stats,
    grandTotal:  grandTotal,
    recipients:  recipients
  });
}

// ============================================================
// GỬI TELEGRAM HÀNG LOẠT — Thêm vào cuối file, không đụng code cũ
// Sheet: SEND_TELEGRAM | Cột B=Tên | C=Nội dung | D=Chat ID | E=Kết quả
// ============================================================

const TG_SEND_TOKEN  = '8897800070:AAHcG2eHlPsE0KpZAGjcFTe7ndn8gjpQi-A';
const SEND_TAB_NAME  = 'SEND_TELEGRAM';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📲 Gửi Telegram')
    .addItem('🆕 Tạo Sheet Gửi',   'setupSendTelegramSheet')
    .addItem('📤 Gửi tin nhắn',    'sendTelegramBulk')
    .addItem('🗑️ Xóa kết quả',    'clearTelegramResults')
    .addItem('🧪 Test 1 tin nhắn', 'sendTestMessage')
    .addToUi();
}

function setupSendTelegramSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SEND_TAB_NAME);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(SEND_TAB_NAME);

  // Tiêu đề
  sh.getRange('A1:E1').merge()
    .setValue('📲 GỬI TIN NHẮN TELEGRAM HÀNG LOẠT')
    .setBackground('#1565C0').setFontColor('#FFFFFF')
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 45);

  // Hướng dẫn
  sh.getRange('A2:E2').merge()
    .setValue('💡 Điền Tên (B) + Nội dung (C) + Chat ID Telegram (D) → Bấm nút GỬI')
    .setBackground('#E3F2FD').setFontColor('#0D47A1').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(2, 30);

  // Header
  sh.getRange('A3:E3')
    .setValues([['STT','TÊN NHÂN VIÊN','NỘI DUNG TIN NHẮN','CHAT ID TELEGRAM','KẾT QUẢ']])
    .setBackground('#1976D2').setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(3, 35);

  // Độ rộng cột
  sh.setColumnWidth(1, 50);
  sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 380);
  sh.setColumnWidth(4, 170);
  sh.setColumnWidth(5, 200);

  // 100 dòng
  for (let i = 1; i <= 100; i++) {
    const r  = i + 3;
    const bg = (r % 2 === 0) ? '#F8F9FA' : '#FFFFFF';
    sh.getRange(r, 1).setValue(i);
    sh.getRange(r, 1, 1, 5).setBackground(bg);
  }
  // Dòng mẫu
  sh.getRange('B4').setValue('Ví dụ: Maung Aung');
  sh.getRange('C4').setValue('📋 Xin chào! Đây là tin nhắn thử nghiệm từ hệ thống TNI.');

  // Định dạng
  sh.getRange('A4:E103').setBorder(true,true,true,true,true,true,'#BBDEFB',SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');
  sh.getRange('B4:B103').setHorizontalAlignment('left').setFontSize(10).setFontWeight('bold');
  sh.getRange('C4:C103').setWrap(true).setHorizontalAlignment('left').setFontSize(10);
  sh.getRange('D4:D103').setHorizontalAlignment('center').setFontSize(10).setFontFamily('Courier New');
  sh.getRange('E4:E103').setHorizontalAlignment('center').setFontSize(10);

  // Nút bấm (ô màu)
  sh.setColumnWidth(6, 20);
  sh.setColumnWidth(7, 145);
  sh.setColumnWidth(8, 145);

  sh.getRange('G1:H2').merge()
    .setValue('📤 GỬI TIN NHẮN')
    .setBackground('#E53935').setFontColor('#FFFFFF')
    .setFontSize(13).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true,true,true,true,false,false,'#B71C1C',SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  sh.getRange('G3:H3').merge()
    .setValue('🗑️ XÓA KẾT QUẢ')
    .setBackground('#757575').setFontColor('#FFFFFF')
    .setFontSize(10).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(3, 28);

  // Thống kê tự động
  sh.getRange('G4').setValue('📊 THỐNG KÊ').setBackground('#E8EAF6').setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('G5').setValue('✅ Thành công:').setBackground('#E8F5E9');
  sh.getRange('H5').setFormula('=COUNTIF(E4:E103,"✅*")').setBackground('#E8F5E9').setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('G6').setValue('❌ Thất bại:').setBackground('#FFEBEE');
  sh.getRange('H6').setFormula('=COUNTIF(E4:E103,"❌*")').setBackground('#FFEBEE').setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('G7').setValue('📋 Tổng có ID:').setBackground('#E3F2FD');
  sh.getRange('H7').setFormula('=COUNTA(D4:D103)').setBackground('#E3F2FD').setFontWeight('bold').setHorizontalAlignment('center');

  sh.setFrozenRows(3);
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(ss.getNumSheets());

  SpreadsheetApp.getUi().alert(
    '✅ Tạo sheet xong! (100 dòng)\n\n' +
    '📌 Gán nút đỏ:\n' +
    '   Click ô đỏ → 3 chấm ⋮ → Assign script\n' +
    '   → Gõ: sendTelegramBulk → OK\n\n' +
    '📌 Gán nút xám:\n' +
    '   → Gõ: clearTelegramResults → OK'
  );
}

function sendTelegramBulk() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const sh  = ss.getSheetByName(SEND_TAB_NAME);
  if (!sh) { SpreadsheetApp.getUi().alert('❌ Chưa tạo sheet!\nVào menu 📲 → Tạo Sheet Gửi'); return; }

  const lastRow = sh.getLastRow();
  if (lastRow < 4) { SpreadsheetApp.getUi().alert('⚠️ Chưa có dữ liệu!'); return; }

  const data   = sh.getRange(4, 2, lastRow - 3, 3).getValues(); // B, C, D
  const resCol = sh.getRange(4, 5, lastRow - 3, 1);             // E
  const now    = Utilities.formatDate(new Date(), 'Asia/Rangoon', 'dd/MM/yyyy HH:mm');

  let ok = 0, fail = 0, skip = 0;
  const results = [];

  for (let i = 0; i < data.length; i++) {
    const content = String(data[i][1] || '').trim();   // C
    const chatId  = String(data[i][2] || '').trim().replace(/\.0$/, ''); // D

    if (!content && !chatId) { results.push(['']); skip++; continue; }
    if (!content)            { results.push(['⚠️ Thiếu nội dung']); skip++; continue; }
    if (!chatId)             { results.push(['⚠️ Thiếu Chat ID']);   skip++; continue; }

    const r = _tgSendMsg(chatId, content);
    if (r.ok) { results.push([`✅ ${now}`]); ok++; }
    else       { results.push([`❌ ${r.error}`]);  fail++; }
    Utilities.sleep(300);
  }

  if (results.length > 0) {
    resCol.setValues(results);
    for (let i = 0; i < results.length; i++) {
      const cell = sh.getRange(4 + i, 5);
      const val  = results[i][0];
      if      (val.startsWith('✅')) cell.setBackground('#E8F5E9').setFontColor('#1B5E20');
      else if (val.startsWith('❌')) cell.setBackground('#FFEBEE').setFontColor('#B71C1C');
      else if (val.startsWith('⚠️')) cell.setBackground('#FFF8E1').setFontColor('#E65100');
      else                           cell.setBackground('#FFFFFF').setFontColor('#000000');
    }
  }
  SpreadsheetApp.getUi().alert(`📊 KẾT QUẢ\n\n✅ Thành công : ${ok}\n❌ Thất bại  : ${fail}\n⚠️ Bỏ qua    : ${skip}`);
}

function clearTelegramResults() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SEND_TAB_NAME);
  if (!sh) return;
  sh.getRange(4, 5, 100, 1).clearContent().setBackground('#FFFFFF').setFontColor('#000000');
  SpreadsheetApp.getUi().alert('🗑️ Đã xóa kết quả cột E!');
}

function sendTestMessage() {
  const ui = SpreadsheetApp.getUi();
  const r  = ui.prompt('🧪 TEST', 'Nhập Chat ID Telegram của bạn:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const chatId = r.getResponseText().trim();
  if (!chatId) { ui.alert('❌ Chưa nhập Chat ID!'); return; }
  const now = Utilities.formatDate(new Date(), 'Asia/Rangoon', 'dd/MM/yyyy HH:mm');
  const res = _tgSendMsg(chatId, `🧪 <b>Test thành công!</b>\n📅 ${now}\n✅ Bot hoạt động bình thường!`);
  ui.alert(res.ok ? '✅ Gửi thành công!\nKiểm tra Telegram.' : `❌ Lỗi: ${res.error}`);
}

function _tgSendMsg(chatId, text) {
  try {
    const resp = UrlFetchApp.fetch(
      `https://api.telegram.org/bot${TG_SEND_TOKEN}/sendMessage`,
      { method      : 'post',
        contentType : 'application/json',
        payload     : JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' }),
        muteHttpExceptions: true,
        deadline    : 10   // ← tối đa 10 giây mỗi lần gọi
      }
    );
    const j = JSON.parse(resp.getContentText());
    return j.ok ? { ok: true } : { ok: false, error: j.description };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// ── Chạy hàm này 1 lần để cấp quyền UrlFetchApp ──
function authorizeNow() {
  UrlFetchApp.fetch('https://api.telegram.org');
  SpreadsheetApp.getUi().alert('✅ Cấp quyền thành công!');
}
