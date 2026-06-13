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

// ── Column index (1-based) ──────────────────────────────────────────────
const COL = {
  REF:       1,  // A — REF ID
  CONFIRM:   2,  // B — Confirm Complete
  DATE:      3,  // C — Date
  TIME:      4,  // D — Time
  TYPE:      5,  // E — Type (Rescue/RC/Maint/Deploy)
  SENDER:    6,  // F — Sender Name
  SENDERID:  7,  // G — Sender ID (Telegram user ID)
  INCIDENT:  8,  // H — Incident Name
  PHYROUTE:  9,  // I — Physical Route
  CABLELEN: 10,  // J — Total Cable Length
  OWNER:    11,  // K — Cable Owner
  BRANCH:   12,  // L — Responsible Branch
  RCA:      13,  // M — RCA
  TEAM:     14,  // N — Team Name
  WO:       15,  // O — WO
  MATERIALS:16,  // P — Materials List
  RAW:      17,  // Q — Raw Content (unformatted messages)
  PHOTOS:   18,  // R — Photos / OCR Text (max 6)
};

const HEADERS = [
  "REF", "Confirm Complete", "Date", "Time", "Type",
  "Sender Name", "Sender ID",
  "Incident Name", "Physical Route", "Total Cable Length",
  "Cable Owner", "Responsible Branch", "RCA",
  "Team Name", "WO", "Materials List",
  "Raw Content", "Photos/OCR"
];

const TOTAL_COLS = HEADERS.length; // 18

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

    const ss = SpreadsheetApp.openById(CABLE_SHEET_ID);
    ensureHeaders_(ss);
    return json_({ status: "ok", message: "Cable Collector running ✅" });
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
    const hdr = sheet.getRange(1, 1, 1, TOTAL_COLS);
    hdr.setValues([HEADERS]);
    hdr.setBackground("#1565C0").setFontColor("#FFFFFF").setFontWeight("bold");
    sheet.setFrozenRows(1);
    // Column widths
    sheet.setColumnWidth(COL.REF,       60);
    sheet.setColumnWidth(COL.CONFIRM,  160);
    sheet.setColumnWidth(COL.INCIDENT, 220);
    sheet.setColumnWidth(COL.PHOTOS,   200);
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

    sheet.getRange(newRow, 1, 1, TOTAL_COLS).setValues([rowData]);

    // Alternate row shading
    if (newRow % 2 === 0) {
      sheet.getRange(newRow, 1, 1, TOTAL_COLS).setBackground("#EFF3FB");
    }

    Logger.log("✅ cable_add REF:" + ref + " row:" + newRow);
    return json_({ status: "ok", row: last, ref: ref });
  } catch (err) {
    Logger.log("❌ cable_add error: " + err.message);
    return json_({ status: "error", message: err.message });
  }
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

    if (!tgUrl) return json_({ status: "error", message: "Missing tg_url" });

    // ── 1. Download ảnh từ Telegram ──────────────────────────────────
    let blob;
    try {
      const resp = UrlFetchApp.fetch(tgUrl, { muteHttpExceptions: true, deadline: 30 });
      if (resp.getResponseCode() !== 200) {
        return json_({ status: "error", message: "Download failed: HTTP " + resp.getResponseCode() });
      }
      const ts   = Utilities.formatDate(new Date(), TZ_CABLE, "yyyyMMdd_HHmmss");
      const name = "cable_" + (refId || "noref") + "_" + ts + ".jpg";
      blob = resp.getBlob().setName(name);
    } catch (e) {
      return json_({ status: "error", message: "Download error: " + e.message });
    }

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

      // Fallback: dòng mới nhất trong 30 phút từ cùng sender
      if (targetRow < 0 && body.sender_id) {
        const WIN_MS = 30 * 60 * 1000;
        const nowMs  = new Date().getTime();
        const data   = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
        for (let i = data.length - 1; i >= 0; i--) {
          if (String(data[i][COL.SENDERID - 1] || "") !== String(body.sender_id)) continue;
          // Parse date+time
          const dtStr = (data[i][COL.DATE - 1] || "") + " " + (data[i][COL.TIME - 1] || "");
          const m = dtStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
          if (!m) break;
          const rowMs = new Date(m[3], m[2]-1, m[1], m[4], m[5]).getTime();
          if (nowMs - rowMs > WIN_MS) break;
          targetRow = i + 2; break;
        }
      }

      // Fallback cuối: dòng cuối cùng
      if (targetRow < 0) targetRow = lastRow;
    }

    // ── 4. Ghi link vào cột R (Photos), tối đa 6 ảnh ─────────────────
    let attached = false;
    if (targetRow > 0) {
      const cell     = sheet.getRange(targetRow, COL.PHOTOS);
      const existing = cell.getValue().toString().trim();
      const photos   = existing ? existing.split(" | ") : [];

      if (photos.length < 6) {
        photos.push(driveLink);
        cell.setValue(photos.join(" | "));
        attached = true;
        Logger.log("✅ Link saved at row " + targetRow + " (" + photos.length + "/6)");
      } else {
        Logger.log("⚠️ Max 6 photos reached for row " + targetRow);
      }
    }

    return json_({ status: "ok", link: driveLink, attached: attached, ref: refId || null });
  } catch (err) {
    Logger.log("❌ cable_add_photo error: " + err.message);
    return json_({ status: "error", message: err.message });
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
