// ============================================================
// TNI Cable Route Collector — Google Apps Script
// Sheet: 1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y
// Tab: "Detail cable"
// ============================================================
// SETUP:
//   1. Open Script Editor from the Cable Google Sheet
//   2. Deploy as Web App: Execute as Me | Who has access: Anyone
//   3. Copy Web App URL → add to GitHub Secrets as CABLE_APPS_SCRIPT_URL
//   ⚠️ Drive API v2 KHÔNG cần thiết — dùng DriveApp thay thế
// Drive folder: My Drive → 1 VCM BRANCH TNI → 2.3 CABLE PHOTO TELEGRAM
// ============================================================

const CABLE_SHEET_ID  = "1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y";
const CABLE_DATA_TAB  = "Detail cable";
const CABLE_PERMIT_TAB = "Cable permit ID";
const TZ_CABLE        = "Asia/Yangon"; // UTC+6:30
// Telegram bot token — for Method B (getFile API fallback)
const TG_BOT_TOKEN    = "8928677923:AAE_cJuEDH1tUf5v0q5Wf0UjDHlcp_k1lGM";

// ── Column index (1-based) ──────────────────────────────────────────────
const COL = {
  REF:       1,  // A — REF ID
  CONFIRM:   2,  // B — Confirm Complete
  DATE:      3,  // C — Date (recorded date)
  TIME:      4,  // D — Time
  TYPE:      5,  // E — Type (Rescue/RC/Maint/Deploy)
  SENDER:    6,  // F — Sender Name
  SENDERID:  7,  // G — Sender ID (Telegram user ID)
  INC_DATE:  8,  // H — Incident Date (extracted from Incident Name)
  INCIDENT:  9,  // I — Incident Name
  PHYROUTE: 10,  // J — Physical Route
  CABLELEN: 11,  // K — Total Cable Length
  OWNER:    12,  // L — Cable Owner
  BRANCH:   13,  // M — Responsible Branch
  RCA:      14,  // N — RCA
  TEAM:     15,  // O — Team Name
  WO:       16,  // P — WO
  MATERIALS:17,  // Q — Materials List
  RAW:      18,  // R — Raw Content (unformatted messages)
  PHOTOS:   19,  // S — Photos (max 6 Drive links)
};

const HEADERS = [
  "REF", "Confirm Complete", "Date", "Time", "Type",
  "Sender Name", "Sender ID",
  "Incident Date",
  "Incident Name", "Physical Route", "Total Cable Length",
  "Cable Owner", "Responsible Branch", "RCA",
  "Team Name", "WO", "Materials List",
  "Raw Content", "Photos"
];

const TOTAL_COLS = HEADERS.length; // 19


// ── JSON helper ─────────────────────────────────────────────────────────
function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ENTRY POINTS
// ============================================================

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action || "";

    if (action === "cable_add")       return cableAdd(body);
    if (action === "cable_confirm")   return cableConfirm(body);
    if (action === "cable_add_photo") return cableAddPhoto(body);
    if (action === "cable_get_stats") return cableGetStats(body);

    return json_({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return json_({ status: "error", message: err.message });
  }
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";
    if (action === "cable_get_stats") return cableGetStats(e.parameter || {});
    if (action === "cable_check_row") {
      const ref = (e.parameter && e.parameter.ref) || "";
      const ss  = SpreadsheetApp.openById(CABLE_SHEET_ID);
      const sheet = getDataSheet_(ss);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return json_({ status: "error", message: "No data" });
      const refCol = sheet.getRange(2, COL.REF, lastRow - 1, 1).getValues();
      for (let i = 0; i < refCol.length; i++) {
        if (String(refCol[i][0] || "").replace(/^0+/, "") === ref.replace(/^0+/, "")) {
          const row = sheet.getRange(i + 2, 1, 1, TOTAL_COLS).getValues()[0];
          return json_({
            status: "ok", ref: ref, sheetRow: i + 2,
            H_INC_DATE:  row[COL.INC_DATE  - 1],
            I_INCIDENT:  row[COL.INCIDENT  - 1],
            E_TYPE:      row[COL.TYPE      - 1],
            C_DATE:      row[COL.DATE      - 1],
          });
        }
      }
      return json_({ status: "error", message: "REF not found: " + ref });
    }

    const ss = SpreadsheetApp.openById(CABLE_SHEET_ID);
    ensureHeaders_(ss);
    return json_({ status: "ok", version: "v3.0-INC_DATE_H8", message: "Cable Collector running ✅" });
  } catch (err) {
    return json_({ status: "error", message: err.message });
  }
}

// ============================================================
// SHEET SETUP
// ============================================================

function getDataSheet_(ss) {
  let sheet = ss.getSheetByName(CABLE_DATA_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(CABLE_DATA_TAB);
  }
  return sheet;
}

function ensureHeaders_(ss) {
  const sheet    = getDataSheet_(ss);
  const firstVal = sheet.getRange(1, 1).getValue();

  if (!firstVal || firstVal.toString().trim() === "") {
    // Sheet trống: tạo mới toàn bộ header
    const hdr = sheet.getRange(1, 1, 1, TOTAL_COLS);
    hdr.setValues([HEADERS]);
    hdr.setBackground("#1565C0").setFontColor("#FFFFFF").setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(COL.REF,       60);
    sheet.setColumnWidth(COL.CONFIRM,  160);
    sheet.setColumnWidth(COL.INC_DATE, 110);
    sheet.setColumnWidth(COL.INCIDENT, 220);
    sheet.setColumnWidth(COL.PHOTOS,   200);
  } else {
    // Sheet đã có data: thêm các cột còn thiếu vào cuối
    const existingCols = sheet.getLastColumn();
    if (existingCols < TOTAL_COLS) {
      for (let c = existingCols + 1; c <= TOTAL_COLS; c++) {
        const cell = sheet.getRange(1, c);
        cell.setValue(HEADERS[c - 1]);
        cell.setBackground("#1565C0").setFontColor("#FFFFFF").setFontWeight("bold");
        if (c === COL.INC_DATE) sheet.setColumnWidth(c, 110);
      }
      Logger.log("Added " + (TOTAL_COLS - existingCols) + " missing column(s)");
    }
  }
}

// ============================================================
// ACTION: cable_add — New cable incident record
// ============================================================
function cableAdd(body) {
  try {
    const ss    = SpreadsheetApp.openById(CABLE_SHEET_ID);
    ensureHeaders_(ss);
    const sheet  = getDataSheet_(ss);
    const last   = Math.max(sheet.getLastRow(), 1);
    const newRow = last + 1;
    const ref    = String(last).padStart(5, "0");   // 00001, 00002...

    const fields = body.fields || {};

    const rowData = new Array(TOTAL_COLS).fill("");
    rowData[COL.REF       - 1] = ref;
    rowData[COL.CONFIRM   - 1] = "";
    rowData[COL.DATE      - 1] = body.date        || "";
    rowData[COL.TIME      - 1] = body.time        || "";
    rowData[COL.TYPE      - 1] = body.type        || "";
    rowData[COL.SENDER    - 1] = body.sender_name || "";
    rowData[COL.SENDERID  - 1] = body.sender_id   || "";
    rowData[COL.INCIDENT  - 1] = fields["incident name"]        || "";
    rowData[COL.PHYROUTE  - 1] = fields["physical route"]       || "";
    rowData[COL.CABLELEN  - 1] = fields["total cable length"]   || "";
    rowData[COL.OWNER     - 1] = fields["cable owner"]          || "";
    rowData[COL.BRANCH    - 1] = fields["responsible branch"]   || "";
    rowData[COL.RCA       - 1] = fields["rca"]                  || "";
    rowData[COL.TEAM      - 1] = fields["team name"]            || "";
    rowData[COL.WO        - 1] = fields["wo"]                   || "";
    rowData[COL.MATERIALS - 1] = fields["materials list"]       || "";
    rowData[COL.RAW       - 1] = body.raw         || "";
    rowData[COL.PHOTOS    - 1] = "";
    rowData[COL.INC_DATE  - 1] = extractIncidentDate_(fields["incident name"] || body.raw || "");

    sheet.getRange(newRow, 1, 1, TOTAL_COLS).setValues([rowData]);

    // Force cột H (INC_DATE) lưu dạng text, không bị Sheets convert sang Date
    if (rowData[COL.INC_DATE - 1]) {
      const dateCell = sheet.getRange(newRow, COL.INC_DATE);
      dateCell.setNumberFormat("@");
      dateCell.setValue(rowData[COL.INC_DATE - 1]);
    }

    // Alternate row shading
    if (newRow % 2 === 0) {
      sheet.getRange(newRow, 1, 1, TOTAL_COLS).setBackground("#EFF3FB");
    }

    Logger.log("✅ cable_add REF:" + ref + " row:" + newRow);

    // Gắn ảnh đã gửi TRƯỚC báo cáo (pending queue ±15 phút)
    if (body.sender_id) {
      attachPendingPhotos_(sheet, newRow, String(body.sender_id), ref);
    }

    return json_({ status: "ok", row: last, ref: ref });
  } catch (err) {
    Logger.log("❌ cable_add error: " + err.message);
    return json_({ status: "error", message: err.message });
  }
}

// ============================================================
// HELPER: Extract date from Incident Name text
// Supports: 6.6.2026 | 06/06/2026 | 6/6/2026 | 06.06.2026
// Returns: "06/06/2026"  or "" if not found
// ============================================================
function extractIncidentDate_(text) {
  if (!text) return "";
  const m = text.match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{4})/);
  if (!m) return "";
  const day   = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year  = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return String(day).padStart(2,"0") + "/" + String(month).padStart(2,"0") + "/" + year;
}

// ============================================================
// ACTION: cable_confirm — Mark Confirm Complete in Col B
// ============================================================
function cableConfirm(body) {
  try {
    const ss    = SpreadsheetApp.openById(CABLE_SHEET_ID);
    const sheet = getDataSheet_(ss);
    const refId = String(body.ref_id || "").trim();

    if (!refId) return json_({ status: "error", message: "Missing ref_id" });

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return json_({ status: "error", message: "No data yet" });

    const refCol = sheet.getRange(2, COL.REF, lastRow - 1, 1).getValues();
    let targetRow = -1;
    for (let i = 0; i < refCol.length; i++) {
      const rowRef = String(refCol[i][0] || "").replace(/^0+/, "");
      const bodyRef = refId.replace(/^0+/, "");
      if (rowRef === bodyRef) { targetRow = i + 2; break; }
    }

    if (targetRow < 0) {
      return json_({ status: "error", message: "REF not found: " + refId });
    }

    // Build confirm text
    const detail = body.confirm_detail ? " | " + body.confirm_detail : "";
    const confirmText =
      "✅ " + (body.confirmed_by || "?") +
      " | " + (body.date || "") + " " + (body.time || "") + detail;

    const cell = sheet.getRange(targetRow, COL.CONFIRM);
    cell.setValue(confirmText);
    cell.setBackground("#A5D6A7"); // green
    cell.setFontWeight("bold");

    Logger.log("✅ cable_confirm REF:" + refId + " row:" + targetRow);
    return json_({ status: "ok", row: targetRow, ref: refId });
  } catch (err) {
    Logger.log("❌ cable_confirm error: " + err.message);
    return json_({ status: "error", message: err.message });
  }
}

// ============================================================
// ACTION: cable_add_photo — Upload ảnh lên Drive, lưu link vào Sheet
// Folder: My Drive / 1 VCM BRANCH TNI / 2.3 CABLE PHOTO TELEGRAM
// Tối đa 6 ảnh mỗi REF, lưu link vào cột R (Photos)
// ============================================================
function cableAddPhoto(body) {
  try {
    const ss    = SpreadsheetApp.openById(CABLE_SHEET_ID);
    const sheet = getDataSheet_(ss);
    const refId = String(body.ref_id || "").trim();
    const tgUrl = body.tg_url || "";

    if (!tgUrl && !body.tg_file_id)
      return json_({ status: "error", message: "Missing tg_url and tg_file_id" });

    // ── 1. Download ảnh (Method A: tg_url; Method B: tg_file_id) ─────────
    let blob;
    let errA = "skipped", errB = "skipped";

    // Method A: tg_url trực tiếp
    if (!blob && tgUrl) {
      try {
        const r = UrlFetchApp.fetch(tgUrl, { muteHttpExceptions: true, deadline: 30 });
        if (r.getResponseCode() === 200) {
          blob = r.getBlob();
          errA = "ok";
        } else {
          errA = "HTTP " + r.getResponseCode();
        }
      } catch(e) { errA = e.message; }
    }

    // Method B: tg_file_id → gọi Telegram getFile API
    if (!blob && body.tg_file_id) {
      try {
        const apiUrl = `https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(body.tg_file_id)}`;
        const apiR   = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true, deadline: 15 });
        const apiJ   = JSON.parse(apiR.getContentText());
        if (apiJ.ok) {
          const filePath   = apiJ.result.file_path;
          const fileUrl    = `https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${filePath}`;
          const dlR        = UrlFetchApp.fetch(fileUrl, { muteHttpExceptions: true, deadline: 30 });
          if (dlR.getResponseCode() === 200) {
            blob = dlR.getBlob();
            errB = "ok";
          } else { errB = "dl HTTP " + dlR.getResponseCode(); }
        } else { errB = "API err: " + apiJ.description; }
      } catch(e) { errB = e.message; }
    }

    if (!blob) {
      return json_({ status: "error", message: `A=${errA} | B=${errB}` });
    }

    const ts   = Utilities.formatDate(new Date(), TZ_CABLE, "yyyyMMdd_HHmmss");
    const name = "cable_" + (refId || "noref") + "_" + ts + ".jpg";
    blob.setName(name);

    // ── 2. Upload lên Drive folder 2.3 CABLE PHOTO TELEGRAM ──────────
    const folder    = getCablePhotoFolder_();
    const file      = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const driveLink = "https://drive.google.com/file/d/" + file.getId() + "/view";
    Logger.log("✅ Photo uploaded: " + driveLink);

    // ── 3. Tìm dòng REF trong sheet ──────────────────────────────────
    let targetRow = -1;
    const lastRow = sheet.getLastRow();

    if (lastRow >= 2) {
      const refCol = sheet.getRange(2, COL.REF, lastRow - 1, 1).getValues();

      if (refId) {
        // Tìm theo REF ID
        for (let i = 0; i < refCol.length; i++) {
          if (String(refCol[i][0] || "").replace(/^0+/, "") === refId.replace(/^0+/, "")) {
            targetRow = i + 2; break;
          }
        }
      }

      // Fallback: dòng GẦN NHẤT trong ±15 phút từ cùng sender (trước HOẶC sau)
      if (targetRow < 0 && body.sender_id) {
        const WIN_MS  = 15 * 60 * 1000;  // ±15 phút
        const nowMs   = new Date().getTime();
        const data    = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
        let   bestDiff = Infinity;
        for (let i = data.length - 1; i >= 0; i--) {
          if (String(data[i][COL.SENDERID - 1] || "") !== String(body.sender_id)) continue;
          const dtStr = (data[i][COL.DATE - 1] || "") + " " + (data[i][COL.TIME - 1] || "");
          const m = dtStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
          if (!m) continue;
          const rowMs = new Date(m[3], m[2]-1, m[1], m[4], m[5]).getTime();
          const diff  = Math.abs(nowMs - rowMs);
          if (diff <= WIN_MS && diff < bestDiff) {
            bestDiff  = diff;
            targetRow = i + 2;
          }
          // Dừng khi row quá cũ (>15 phút so với now)
          if (nowMs - rowMs > WIN_MS) break;
        }
      }
      // Không có fallback "dòng cuối cùng" — tránh gắn nhầm sang báo cáo khác
    }

    // ── 4. Ghi link vào cột S (Photos), tối đa 6 ảnh ─────────────────
    let attached  = false;
    let matchedRef = refId || null;   // sẽ cập nhật sau khi tìm được dòng

    if (targetRow > 0) {
      // Đọc REF thực tế của dòng (dùng khi fallback bằng sender_id)
      const refVal = sheet.getRange(targetRow, COL.REF).getValue();
      if (refVal) matchedRef = String(refVal).trim();

      const cell   = sheet.getRange(targetRow, COL.PHOTOS);
      const photos = readPhotoUrls_(cell);  // đọc URLs thực từ RichText

      if (photos.length < 6) {
        photos.push(driveLink);
        cell.setRichTextValue(buildPhotoRichText_(photos));
        attached = true;
        Logger.log("✅ Link saved at row " + targetRow + " REF:" + matchedRef + " (" + photos.length + "/6)");
      } else {
        Logger.log("⚠️ Max 6 photos reached for row " + targetRow);
      }
    }

    // Nếu chưa gắn được (ảnh đến TRƯỚC báo cáo) → đưa vào pending queue
    if (!attached && body.sender_id && driveLink) {
      const key   = "pp_" + String(body.sender_id);
      const props = PropertiesService.getScriptProperties();
      try {
        const raw   = props.getProperty(key);
        const queue = raw ? JSON.parse(raw) : { links: [], time: new Date().getTime() };
        if (queue.links.length < 6) {
          queue.links.push(driveLink);
          queue.time = new Date().getTime();
          props.setProperty(key, JSON.stringify(queue));
          Logger.log("📥 Pending queue " + queue.links.length + " photos → sender:" + body.sender_id);
        }
      } catch(pe) { Logger.log("⚠️ pending queue error: " + pe.message); }
    }

    return json_({ status: "ok", link: driveLink, attached: attached, ref: matchedRef });
  } catch (err) {
    Logger.log("❌ cable_add_photo error: " + err.message);
    return json_({ status: "error", message: err.message });
  }
}

// ── Helper: build RichText clickable "Photo 1 | Photo 2 | ..." ───────────
function buildPhotoRichText_(urls) {
  let fullText = ""; const segs = [];
  for (let i = 0; i < urls.length; i++) {
    if (i > 0) { fullText += " | "; segs.push({ url: null }); }
    const label = "Photo " + (i + 1);
    segs.push({ url: urls[i], label: label });
    fullText += label;
  }
  const rtb = SpreadsheetApp.newRichTextValue().setText(fullText);
  let pos = 0;
  for (const seg of segs) {
    const len = (seg.label || " | ").length;
    if (seg.url) rtb.setLinkUrl(pos, pos + len, seg.url);
    pos += len;
  }
  return rtb.build();
}

// ── Helper: đọc URLs thực từ RichText cell ────────────────────────────────
function readPhotoUrls_(cell) {
  try {
    const rtv = cell.getRichTextValue();
    if (!rtv) return [];
    const urls = [];
    for (const run of rtv.getRuns()) {
      const url = run.getLinkUrl();
      if (url) urls.push(url);
    }
    return urls;
  } catch(e) { return []; }
}

// ── Helper: gắn ảnh pending (gửi TRƯỚC báo cáo) vào row vừa tạo ─────────
function attachPendingPhotos_(sheet, row, senderId, ref) {
  try {
    const key   = "pp_" + senderId;
    const props = PropertiesService.getScriptProperties();
    const raw   = props.getProperty(key);
    if (!raw) return;

    const queue  = JSON.parse(raw);
    const WIN_MS = 15 * 60 * 1000;
    const nowMs  = new Date().getTime();
    if (Math.abs(nowMs - queue.time) > WIN_MS) {
      props.deleteProperty(key); return;  // Hết hạn 15 phút
    }

    const links = (queue.links || []).slice(0, 6);
    if (!links.length) { props.deleteProperty(key); return; }

    const cell     = sheet.getRange(row, COL.PHOTOS);
    const existing = readPhotoUrls_(cell);
    const combined = existing.concat(links).slice(0, 6);
    cell.setRichTextValue(buildPhotoRichText_(combined));

    props.deleteProperty(key);
    Logger.log("✅ Attached " + links.length + " pending photos → REF:" + ref);
  } catch(e) {
    Logger.log("⚠️ attachPendingPhotos_ error: " + e.message);
    try { PropertiesService.getScriptProperties().deleteProperty("pp_" + senderId); } catch(x) {}
  }
}

// ── Lấy hoặc tạo folder '2.3 CABLE PHOTO TELEGRAM' ──────────────────────
// Nằm bên trong folder '1 VCM BRANCH TNI'
function getCablePhotoFolder_() {
  const PARENT_NAME = "1 VCM BRANCH TNI";
  const CHILD_NAME  = "2.3 CABLE PHOTO TELEGRAM";

  const parents = DriveApp.getFoldersByName(PARENT_NAME);
  const parent  = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();

  const children = parent.getFoldersByName(CHILD_NAME);
  return children.hasNext() ? children.next() : parent.createFolder(CHILD_NAME);
}

// ============================================================
// ACTION: cable_get_stats — Statistics for daily report
// ============================================================
function cableGetStats(params) {
  try {
    const ss    = SpreadsheetApp.openById(CABLE_SHEET_ID);
    const sheet = getDataSheet_(ss);
    const last  = sheet.getLastRow();

    if (last < 2) {
      return json_({ status: "ok", stats: {
        today: 0, day3: 0, day7: 0, month: 0, total: 0,
        confirmed: 0, pending: 0, by_type: {}
      }});
    }

    const now      = new Date();
    const nowLocal = new Date(now.getTime() + 6.5 * 3600000); // UTC+6:30
    const todayStr = Utilities.formatDate(now, TZ_CABLE, "dd/MM/yyyy");

    function parseLocalDate(str) {
      const m = String(str).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!m) return null;
      return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    }

    function daysDiff(d) {
      const todayMid = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
      const rowMid   = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return Math.floor((todayMid - rowMid) / 86400000);
    }

    const data = sheet.getRange(2, 1, last - 1, TOTAL_COLS).getValues();

    const stats = {
      today: 0, day3: 0, day7: 0, month: 0, total: 0,
      confirmed: 0, pending: 0, by_type: {}
    };

    for (const row of data) {
      const ref  = String(row[COL.REF - 1] || "").trim();
      if (!ref)  continue;   // skip truly empty rows

      const dateStr = String(row[COL.DATE - 1] || "").trim();
      const typeKey = String(row[COL.TYPE - 1] || "").toLowerCase().trim();
      const confirm = String(row[COL.CONFIRM - 1] || "").trim();

      stats.total++;
      if (confirm) stats.confirmed++; else stats.pending++;

      if (!stats.by_type[typeKey]) {
        stats.by_type[typeKey] = { today: 0, day3: 0, day7: 0, month: 0, total: 0 };
      }
      stats.by_type[typeKey].total++;

      const d = parseLocalDate(dateStr);
      if (!d) continue;
      const diff = daysDiff(d);

      if (diff === 0)  { stats.today++;                      stats.by_type[typeKey].today++; }
      if (diff < 3)   { stats.day3++;                       stats.by_type[typeKey].day3++;  }
      if (diff < 7)   { stats.day7++;                       stats.by_type[typeKey].day7++;  }
      if (d.getFullYear() === nowLocal.getFullYear() &&
          d.getMonth()    === nowLocal.getMonth()) {
        stats.month++;
        stats.by_type[typeKey].month++;
      }
    }

    Logger.log("cable_get_stats: " + JSON.stringify(stats));
    return json_({ status: "ok", stats: stats });
  } catch (err) {
    Logger.log("❌ cable_get_stats error: " + err.message);
    return json_({ status: "error", message: err.message });
  }
}
