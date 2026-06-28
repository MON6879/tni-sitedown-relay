// ============================================================
// APPS SCRIPT — MDG RUN DATA COLLECTOR  v2.3
// Sheet  : MDG Detail  |  Folder : 2.4 Run MDG
// Photos : 6 separate columns U-Z with =HYPERLINK() formula
// v2026-06-26g — ANCHOR approach: text tạo mốc, ảnh tự gắn vào mốc cùng sender
// ============================================================

const MDG_SHEET_ID  = "1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y";
const MDG_DATA_TAB  = "MDG Detail";
const MDG_PHOTO_DIR = "2.4 Run MDG";
// Telegram bot token — hardcoded for reliability
// (Script Properties was returning wrong value → 401 Unauthorized)
const MDG_BOT_TOKEN  = "8928677923:AAE_cJuEDH1tUf5v0q5Wf0UjDHlcp_k1lGM";

// ── Column index (1-based) ──────────────────────────────────
const MCOL = {
  REF:       1,   // A
  CONFIRM:   2,   // B
  REC_DATE:  3,   // C — Recorded Date
  REC_TIME:  4,   // D — Recorded Time
  RPT_DATE:  5,   // E — Report Date (field "Date:")
  SITE_ID:   6,   // F
  BRANCH:    7,   // G
  TEAM:      8,   // H
  MDG_CODE:  9,   // I
  MDG_CAP:  10,   // J — MDG Capacity
  MDG_SER:  11,   // K — MDG Serial
  DG_START: 12,   // L — DG Start Time
  DG_END:   13,   // M — DG End Time
  TOTAL_HRS:14,   // N — Total Hours
  STAFF_NM: 15,   // O — Staff Name
  STAFF_CD: 16,   // P — Staff Code
  REMARK:   17,   // Q
  SENDER:   18,   // R — Sender Name
  SENDER_ID:19,   // S — Sender ID
  RAW:      20,   // T — Raw content
  PHOTO_1:  21,   // U — Photo 1 HYPERLINK
  PHOTO_2:  22,   // V — Photo 2 HYPERLINK
  PHOTO_3:  23,   // W — Photo 3 HYPERLINK
  PHOTO_4:  24,   // X — Photo 4 HYPERLINK
  PHOTO_5:  25,   // Y — Photo 5 HYPERLINK
  PHOTO_6:  26,   // Z — Photo 6 HYPERLINK
};
const PHOTO_COLS  = [21,22,23,24,25,26];  // U → Z
const MTOTAL_COLS = 26;
const MHEADERS = [
  "REF","Confirm Complete","Recorded Date","Recorded Time",
  "Report Date","Site ID","Branch","Team",
  "MDG Code","MDG Capacity","MDG Serial",
  "DG Start Time","DG End Time","Total Hours",
  "Staff Name","Staff Code","Remark",
  "Sender Name","Sender ID","Raw Content",
  "Photo 1","Photo 2","Photo 3","Photo 4","Photo 5","Photo 6"
];

// ── Inventory Column index (1-based) ────────────────────────
const INV_DATA_TAB  = "Inventory Main DG";
const INV_PHOTO_DIR = "2.8 INVENTORY FUEL MAIN DG";

const ICOL = {
  REF:       1,   // A
  CONFIRM:   2,   // B
  REC_DATE:  3,   // C
  REC_TIME:  4,   // D
  INV_DATE:  5,   // E (Inventory Fuel)
  DG_ID:     6,   // F
  FUEL_CM:   7,   // G
  FUEL_PCT:  8,   // H
  FUEL_LVL:  9,   // I
  KWH:       10,  // J
  RH:        11,  // K
  NOTE:      12,  // L
  SENDER:    13,  // M
  SENDER_ID: 14,  // N
  RAW:       15,  // O
  PHOTO_1:   16,  // P
  PHOTO_2:   17,
  PHOTO_3:   18,
  PHOTO_4:   19,
  PHOTO_5:   20,
  PHOTO_6:   21,
  PHOTO_7:   22,
  PHOTO_8:   23,
  PHOTO_9:   24,
  PHOTO_10:  25,
  PHOTO_11:  26,
  PHOTO_12:  27,
};
const IPHOTO_COLS  = [16,17,18,19,20,21,22,23,24,25,26,27];
const ITOTAL_COLS = 27;
const IHEADERS = [
  "REF","Confirm Complete","Recorded Date","Recorded Time",
  "Inventory Fuel","DG ID","Fuel Cm","Fuel %","Fuel Level",
  "KWh","RH","Note","Sender Name","Sender ID","Raw Content",
  "Photo 1","Photo 2","Photo 3","Photo 4","Photo 5","Photo 6",
  "Photo 7","Photo 8","Photo 9","Photo 10","Photo 11","Photo 12"
];
// ============================================================
// ANCHOR HELPERS
// Mỗi sender có 1 "mốc" = text MDG/INV cuối cùng họ gửi
// → ảnh tiếp theo tự động gắn vào mốc đó
// → text mới từ cùng sender → mốc cũ bị thay thế
// ============================================================
function saveAnchor_(senderId, ref, row, sheetType) {
  if (!senderId) return;
  const val = JSON.stringify({ ref: ref, row: row, sheet: sheetType, ts: Date.now() });
  PropertiesService.getScriptProperties().setProperty("ANCHOR_" + senderId, val);
  Logger.log("[ANCHOR] Saved sender=" + senderId + " → " + sheetType + " REF=" + ref + " row=" + row);
}

function getAnchor_(senderId) {
  if (!senderId) return null;
  try {
    const raw = PropertiesService.getScriptProperties().getProperty("ANCHOR_" + senderId);
    if (!raw) return null;
    const anchor = JSON.parse(raw);
    // Anchor hết hạn sau 12 giờ
    if (Date.now() - anchor.ts > 12 * 60 * 60 * 1000) {
      PropertiesService.getScriptProperties().deleteProperty("ANCHOR_" + senderId);
      return null;
    }
    return anchor;
  } catch(e) { return null; }
}

// ============================================================
// ENTRY POINTS
// ============================================================
function doPostMdg_(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action || "";
    if (action === "mdg_add")       return mdgAdd(body);
    if (action === "mdg_confirm")   return mdgConfirm(body);
    if (action === "mdg_add_photo") return processPhoto(body, "MDG"); // Explicit MDG
    if (action === "inv_add")       return invAdd(body);
    if (action === "inv_confirm")   return invConfirm(body);
    if (action === "inv_add_photo") return processPhoto(body, "INV"); // Explicit INV
    if (action === "process_photo") return processPhoto(body, "AUTO"); // Auto-detect
    if (action === "mdg_get_stats") return mdgGetStats(body);
    return json({ status:"error", message:"Unknown action: "+action });
  } catch(err) { return json({ status:"error", message:err.message }); }
}

function doGetMdg_(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";
    if (action === "mdg_get_stats") return mdgGetStats(e.parameter || {});
    if (action === "mdg_check_row") {
      const ref = (e.parameter && e.parameter.ref) || "";
      const ss  = SpreadsheetApp.openById(MDG_SHEET_ID);
      const sh  = getMdgSheet_(ss);
      const lr  = sh.getLastRow();
      if (lr < 2) return json({ status:"error", message:"No data" });
      const rc  = sh.getRange(2, MCOL.REF, lr-1, 1).getValues();
      for (let i=0;i<rc.length;i++) {
        if (String(rc[i][0]||"").replace(/^0+/,"")===ref.replace(/^0+/,"")) {
          const row=sh.getRange(i+2,1,1,MTOTAL_COLS).getValues()[0];
          return json({ status:"ok",ref:ref,sheetRow:i+2,
            E_RPT_DATE:row[MCOL.RPT_DATE-1], F_SITE_ID:row[MCOL.SITE_ID-1],
            H_TEAM:row[MCOL.TEAM-1], I_MDG_CODE:row[MCOL.MDG_CODE-1] });
        }
      }
      return json({ status:"error", message:"REF not found: "+ref });
    }
    const ss = SpreadsheetApp.openById(MDG_SHEET_ID);
    ensureMdgHeaders_(ss);
    return json({ status:"ok", version:"mdg-v2.2", message:"MDG Collector running ✅" });
  } catch(err) { return json({ status:"error", message:err.message }); }
}

// ============================================================
// SHEET SETUP
// ============================================================
function getMdgSheet_(ss) {
  let sh = ss.getSheetByName(MDG_DATA_TAB);
  if (!sh) sh = ss.insertSheet(MDG_DATA_TAB);
  return sh;
}
function ensureMdgHeaders_(ss) {
  const sh = getMdgSheet_(ss);
  const fv = sh.getRange(1,1).getValue();
  if (!fv || fv.toString().trim()==="") {
    const hdr = sh.getRange(1,1,1,MTOTAL_COLS);
    hdr.setValues([MHEADERS]);
    hdr.setFontWeight("bold").setBackground("#1565C0").setFontColor("#FFFFFF");
    sh.setFrozenRows(1);
    sh.setColumnWidth(MCOL.RAW,300);
    PHOTO_COLS.forEach(c => sh.setColumnWidth(c,120));
  }
}

function getInvSheet_(ss) {
  let sh = ss.getSheetByName(INV_DATA_TAB);
  if (!sh) sh = ss.insertSheet(INV_DATA_TAB);
  return sh;
}
function ensureInvHeaders_(ss) {
  const sh = getInvSheet_(ss);
  const fv = sh.getRange(1,1).getValue();
  if (!fv || fv.toString().trim()==="") {
    const hdr = sh.getRange(1,1,1,ITOTAL_COLS);
    hdr.setValues([IHEADERS]);
    hdr.setFontWeight("bold").setBackground("#FF6F00").setFontColor("#FFFFFF");
    sh.setFrozenRows(1);
    sh.setColumnWidth(ICOL.RAW,300);
    IPHOTO_COLS.forEach(c => sh.setColumnWidth(c,120));
  }
}

// ============================================================
// HELPERS — Time parser
// Converts any time string to Google Sheets day-fraction (0..1)
// Accepts: "6:00AM", "6:00 PM", "6:00 pm", "14:00", "6am", "4:30PM"
// ============================================================
function parseTimeToDayFraction(str) {
  if (!str) return null;
  str = str.toString().trim().replace(/\s+/g, "");
  if (!str) return null;

  // Match 12-hour: 6:00AM, 6AM, 4:30PM
  const m12 = str.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const mn = parseInt(m12[2] || "0", 10);
    const pm = m12[3].toUpperCase() === "PM";
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return (h * 60 + mn) / 1440;
  }

  // Match 24-hour: 14:00, 06:00
  const m24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const mn = parseInt(m24[2], 10);
    return (h * 60 + mn) / 1440;
  }

  return null;
}

// ============================================================
// MDG ADD
// ============================================================
function mdgAdd(body) {
  try {
    const ss  = SpreadsheetApp.openById(MDG_SHEET_ID);
    const sh  = getMdgSheet_(ss);
    ensureMdgHeaders_(ss);
    const f   = body.fields || {};
    const last= Math.max(sh.getLastRow(),1);
    const nr  = last+1;
    const ref = String(last).padStart(5,"0");
    const rd  = new Array(MTOTAL_COLS).fill("");
    rd[MCOL.REF      -1] = ref;
    rd[MCOL.CONFIRM  -1] = "";
    rd[MCOL.REC_DATE -1] = body.date        || "";
    rd[MCOL.REC_TIME -1] = body.time        || "";
    rd[MCOL.RPT_DATE -1] = f["date"]         || "";
    rd[MCOL.SITE_ID  -1] = f["site id"]      || "";
    rd[MCOL.BRANCH   -1] = f["branch"]       || "";
    rd[MCOL.TEAM     -1] = f["team"]         || "";
    rd[MCOL.MDG_CODE -1] = f["mdg code"]     || "";
    rd[MCOL.MDG_CAP  -1] = f["mdg capacity"] || "";
    rd[MCOL.MDG_SER  -1] = f["mdg serial"]   || "";
    // L and M: store raw text first (will be overwritten as time below)
    rd[MCOL.DG_START -1] = f["dg start time"]|| "";
    rd[MCOL.DG_END   -1] = f["dg end time"]  || "";
    rd[MCOL.TOTAL_HRS-1] = "";               // N: auto-calculated below
    rd[MCOL.STAFF_NM -1] = f["staff name"]   || "";
    rd[MCOL.STAFF_CD -1] = f["staff code"]   || "";
    rd[MCOL.REMARK   -1] = f["remark"]       || "";
    rd[MCOL.SENDER   -1] = body.sender_name  || "";
    rd[MCOL.SENDER_ID-1] = body.sender_id    || "";
    rd[MCOL.RAW      -1] = body.raw          || "";
    sh.getRange(nr,1,1,MTOTAL_COLS).setValues([rd]);

    // Force RPT_DATE as text
    if (rd[MCOL.RPT_DATE-1]) {
      const dc = sh.getRange(nr, MCOL.RPT_DATE);
      dc.setNumberFormat("@"); dc.setValue(rd[MCOL.RPT_DATE-1]);
    }

    // ── Col L: DG Start Time → time format ──────────────────
    const startFrac = parseTimeToDayFraction(f["dg start time"]);
    const endFrac   = parseTimeToDayFraction(f["dg end time"]);

    if (startFrac !== null) {
      const lCell = sh.getRange(nr, MCOL.DG_START);
      lCell.setValue(startFrac);
      lCell.setNumberFormat("hh:mm AM/PM");
    }

    // ── Col M: DG End Time → time format ────────────────────
    if (endFrac !== null) {
      const mCell = sh.getRange(nr, MCOL.DG_END);
      mCell.setValue(endFrac);
      mCell.setNumberFormat("hh:mm AM/PM");
    }

    // ── Col N: Total Hours = (M - L) × 24 ───────────────────
    if (startFrac !== null && endFrac !== null) {
      let diffHours = (endFrac - startFrac) * 24;
      if (diffHours < 0) diffHours += 24;           // overnight run
      diffHours = Math.round(diffHours * 100) / 100; // 2 decimal places
      const nCell = sh.getRange(nr, MCOL.TOTAL_HRS);
      nCell.setValue(diffHours);
      nCell.setNumberFormat("0.0#");
    } else if (f["total hours"]) {
      // Fallback: parse raw "10hrs" / "10" / "10.5"
      const rawHrs = f["total hours"].replace(/[^\d.]/g, "");
      if (rawHrs) {
        const nCell = sh.getRange(nr, MCOL.TOTAL_HRS);
        nCell.setValue(parseFloat(rawHrs));
        nCell.setNumberFormat("0.0#");
      }
    }

    if (nr%2===0) sh.getRange(nr,1,1,MTOTAL_COLS).setBackground("#EFF3FB");
    Logger.log("✅ MDG added REF="+ref+" row="+nr);
    // Lưu anchor → ảnh tiếp theo từ sender này sẽ tự gắn vào đây
    const sId = String(body.sender_id || "").trim();
    if (sId) saveAnchor_(sId, ref, nr, "MDG");
    return json({ status:"ok", ref:ref, row:last });
  } catch(err) { Logger.log("❌ mdg_add: "+err.message); return json({ status:"error", message:err.message }); }
}


// ============================================================
// MDG CONFIRM
// ============================================================
function mdgConfirm(body) {
  try {
    const ss  = SpreadsheetApp.openById(MDG_SHEET_ID);
    const sh  = getMdgSheet_(ss);
    const rid = String(body.ref_id||"").trim();
    if (!rid) return json({ status:"error", message:"ref_id required" });
    const lr  = sh.getLastRow();
    if (lr<2) return json({ status:"error", message:"No data" });
    const rc  = sh.getRange(2,MCOL.REF,lr-1,1).getValues();
    for (let i=0;i<rc.length;i++) {
      if (String(rc[i][0]||"").replace(/^0+/,"")===rid.replace(/^0+/,"")) {
        const r=i+2;
        sh.getRange(r,MCOL.CONFIRM).setValue("✅ "+body.confirmed_by+" "+body.date);
        sh.getRange(r,1,1,MTOTAL_COLS).setBackground("#D4EDDA");
        return json({ status:"ok", ref:rid, row:r });
      }
    }
    return json({ status:"error", message:"REF not found: "+rid });
  } catch(err) { return json({ status:"error", message:err.message }); }
}

// ============================================================
// INV ADD
// ============================================================
function invAdd(body) {
  try {
    const ss  = SpreadsheetApp.openById(MDG_SHEET_ID);
    const sh  = getInvSheet_(ss);
    ensureInvHeaders_(ss);
    const f   = body.fields || {};
    const last= Math.max(sh.getLastRow(),1);
    const nr  = last+1;
    const ref = String(last).padStart(5,"0");
    const rd  = new Array(ITOTAL_COLS).fill("");
    
    rd[ICOL.REF      -1] = ref;
    rd[ICOL.CONFIRM  -1] = "";
    rd[ICOL.REC_DATE -1] = body.date        || "";
    rd[ICOL.REC_TIME -1] = body.time        || "";
    rd[ICOL.INV_DATE -1] = f["inventory fuel"]|| "";
    rd[ICOL.DG_ID    -1] = f["dg id"]       || "";
    rd[ICOL.FUEL_CM  -1] = f["fuel cm"]     || "";
    rd[ICOL.FUEL_PCT -1] = f["fuel %"]      || "";
    rd[ICOL.FUEL_LVL -1] = f["fuel level"]  || "";
    rd[ICOL.KWH      -1] = f["kwh"]         || "";
    rd[ICOL.RH       -1] = f["rh"]          || "";
    rd[ICOL.NOTE     -1] = f["note"]        || "";
    rd[ICOL.SENDER   -1] = body.sender_name || "";
    rd[ICOL.SENDER_ID-1] = body.sender_id   || "";
    rd[ICOL.RAW      -1] = body.raw         || "";

    sh.getRange(nr,1,1,ITOTAL_COLS).setValues([rd]);

    // Force INV_DATE as text
    if (rd[ICOL.INV_DATE-1]) {
      const dc = sh.getRange(nr, ICOL.INV_DATE);
      dc.setNumberFormat("@"); dc.setValue(rd[ICOL.INV_DATE-1]);
    }

    if (nr%2===0) sh.getRange(nr,1,1,ITOTAL_COLS).setBackground("#FFF3E0");
    Logger.log("✅ INV added REF="+ref+" row="+nr);
    // Lưu anchor → ảnh tiếp theo từ sender này sẽ tự gắn vào đây
    const sId = String(body.sender_id || "").trim();
    if (sId) saveAnchor_(sId, ref, nr, "INV");
    return json({ status:"ok", ref:ref, row:last });
  } catch(err) { Logger.log("❌ inv_add: "+err.message); return json({ status:"error", message:err.message }); }
}

// ============================================================
// INV CONFIRM
// ============================================================
function invConfirm(body) {
  try {
    const ss  = SpreadsheetApp.openById(MDG_SHEET_ID);
    const sh  = getInvSheet_(ss);
    const rid = String(body.ref_id||"").trim();
    if (!rid) return json({ status:"error", message:"ref_id required" });
    const lr  = sh.getLastRow();
    if (lr<2) return json({ status:"error", message:"No data" });
    const rc  = sh.getRange(2,ICOL.REF,lr-1,1).getValues();
    for (let i=0;i<rc.length;i++) {
      if (String(rc[i][0]||"").replace(/^0+/,"")===rid.replace(/^0+/,"")) {
        const r=i+2;
        sh.getRange(r,ICOL.CONFIRM).setValue("✅ "+body.confirmed_by+" "+body.date);
        sh.getRange(r,1,1,ITOTAL_COLS).setBackground("#D4EDDA");
        return json({ status:"ok", ref:rid, row:r });
      }
    }
    return json({ status:"error", message:"REF not found: "+rid });
  } catch(err) { return json({ status:"error", message:err.message }); }
}

// ============================================================
// ADD PHOTO  (GAS downloads from Telegram — no Python timeout)
// ============================================================
function processPhoto(body, modeStr) {
  try {
    const ss      = SpreadsheetApp.openById(MDG_SHEET_ID);
    const mdgSh   = getMdgSheet_(ss);
    const invSh   = getInvSheet_(ss);
    const refId   = String(body.ref_id   ||"").trim();
    const senderId= String(body.sender_id||"").trim();
    const now     = new Date();

    // ── Helper: Tìm row mới nhất theo Sender ID trong 30 phút ──
    // FIX: JS new Date() không hiểu "dd/MM/yyyy" → chuyển sang ISO trước khi parse
    const parseRecDateTime = (dateStr, timeStr) => {
      try {
        // dateStr có thể là "26/06/2026" (string) hoặc Date object (GAS auto-convert)
        if (dateStr instanceof Date) {
          // GAS đọc từ sheet trả về Date object → lấy giờ từ timeStr riêng
          const tz = ss.getSpreadsheetTimeZone();
          const yyyyMmDd = Utilities.formatDate(dateStr, tz, "yyyy-MM-dd");
          const timeParts = String(timeStr || "00:00").trim().split(":");
          const hh   = String(timeParts[0] || "0").padStart(2, "0");
          const mm   = String(timeParts[1] || "0").padStart(2, "0");
          const iso  = `${yyyyMmDd}T${hh}:${mm}:00+06:30`;
          const d2   = new Date(iso);
          return isNaN(d2.getTime()) ? null : d2;
        }
        // dateStr là string "dd/MM/yyyy" → convert sang ISO với Myanmar timezone
        const parts = String(dateStr).trim().split("/");
        if (parts.length === 3) {
          // Thêm +06:30 để GAS hiểu đây là Myanmar time, không phải UTC
          const iso = parts[2] + "-" + parts[1] + "-" + parts[0]
                    + "T" + String(timeStr).trim() + ":00+06:30";
          const d = new Date(iso);
          if (!isNaN(d.getTime())) return d;
        }
        // Fallback
        const d2 = new Date(dateStr + " " + timeStr);
        return isNaN(d2.getTime()) ? null : d2;
      } catch(e) { return null; }
    };

    const findLatest = (sh, colSender, colDate, colTime) => {
      const lr = sh.getLastRow();
      if (lr < 2) return { row: -1, msDiff: 9999999999 };
      const sc = sh.getRange(2, colSender, lr-1, 1).getValues();
      const dc = sh.getRange(2, colDate,   lr-1, 1).getValues();
      const tc = sh.getRange(2, colTime,   lr-1, 1).getValues();
      for (let i = sc.length - 1; i >= 0; i--) {
        if (String(sc[i][0] || "") === senderId) {
          const d = parseRecDateTime(dc[i][0], tc[i][0]);
          if (d) {
            const diff = now - d;
            if (diff < 30 * 60 * 1000) return { row: i + 2, msDiff: diff };
          }
        }
      }
      return { row: -1, msDiff: 9999999999 };
    };

    // FIX race condition: nếu text + photo gởi cùng lúc, row chưa được lưu
    // → thử lại tối đa 3 lần, cách 4 giây mỗi lần
    const findLatestWithRetry = (sh, colSender, colDate, colTime, maxTries) => {
      for (let t = 0; t < maxTries; t++) {
        const result = findLatest(sh, colSender, colDate, colTime);
        if (result.row > 0) return result;
        if (t < maxTries - 1) {
          Logger.log("[processPhoto] findLatest: row not found, retry " + (t+1) + "/" + maxTries + " after 4s...");
          Utilities.sleep(4000);
        }
      }
      return { row: -1, msDiff: 9999999999 };
    };

    // FIX: Tìm bản ghi gần nhất trong 30 phút bất kể sender_id nào
    // Dùng khi admin gửi ảnh cho báo cáo của nhân viên khác
    const findLatestAny = (sh, colDate, colTime) => {
      const lr = sh.getLastRow();
      if (lr < 2) return { row: -1, msDiff: 9999999999 };
      const dc = sh.getRange(2, colDate, lr-1, 1).getValues();
      const tc = sh.getRange(2, colTime, lr-1, 1).getValues();
      for (let i = dc.length - 1; i >= 0; i--) {
        const d = parseRecDateTime(dc[i][0], tc[i][0]);
        if (d) {
          const diff = now - d;
          if (diff >= 0 && diff < 30 * 60 * 1000) return { row: i + 2, msDiff: diff };
        }
      }
      return { row: -1, msDiff: 9999999999 };
    };



    let targetType = "UNKNOWN";
    let targetRow = -1;
    let targetSheet = null;

    // ── 1. Xác định Target ────────────────────────────────────
    if (modeStr === "MDG" || modeStr === "INV") {
      targetType = modeStr;
      targetSheet = modeStr === "MDG" ? mdgSh : invSh;
      const sh = targetSheet;
      const refCol = modeStr === "MDG" ? MCOL.REF : ICOL.REF;
      const senderCol = modeStr === "MDG" ? MCOL.SENDER_ID : ICOL.SENDER_ID;
      const dateCol = modeStr === "MDG" ? MCOL.REC_DATE : ICOL.REC_DATE;
      const timeCol = modeStr === "MDG" ? MCOL.REC_TIME : ICOL.REC_TIME;

      if (refId) {
        const lr = sh.getLastRow();
        if (lr > 1) {
          const rc = sh.getRange(2, refCol, lr-1, 1).getValues();
          for (let i = 0; i < rc.length; i++) {
            if (String(rc[i][0]||"").replace(/^0+/,"") === refId.replace(/^0+/,"")) {
              targetRow = i + 2; break;
            }
          }
        }
      }
      // FIX: thử findLatestAny TRƯỚC (nhanh, < 1s) để tránh timeout Python 8s
      // Trường hợp ảnh gửi SAU text (vài phút) → tìm thấy ngay lập tức
      if (targetRow < 0) {
        targetRow = findLatestAny(sh, dateCol, timeCol).row;
        if (targetRow > 0) Logger.log("[processPhoto] findLatestAny instant hit → row=" + targetRow);
      }
      // Race condition (ảnh gửi CÙNG LÚC text) → retry 2×3s chờ text được lưu
      if (targetRow < 0 && senderId) {
        targetRow = findLatestWithRetry(sh, senderCol, dateCol, timeCol, 2).row;
      }
      // Final fallback any sender sau retry
      if (targetRow < 0) {
        Logger.log("[processPhoto] Sender " + senderId + " not matched → final findLatestAny");
        targetRow = findLatestAny(sh, dateCol, timeCol).row;
      }
    } else {
      // AUTO MODE: dùng anchor (mốc text cuối cùng của sender này)
      // Text đến trước → saveAnchor_ → ảnh đến → getAnchor_ → gắn vào đúng record
      // Text mới cùng sender → mốc cũ bị thay, ảnh mới gắn vào text mới
      const anchor = getAnchor_(senderId);
      if (anchor) {
        Logger.log("[AUTO] Anchor found sender=" + senderId + " → " + anchor.sheet + " REF=" + anchor.ref + " row=" + anchor.row);
        targetType  = anchor.sheet;
        targetRow   = anchor.row;
        targetSheet = targetType === "MDG" ? mdgSh : invSh;
      } else {
        Logger.log("[AUTO] No anchor for sender=" + senderId + " — photo rejected");
      }
    }

    if (targetRow < 0) {
      return json({ status:"error", message: "No MDG/INV text found for sender " + senderId + ". Please send MDG report text first, then photos." });
    }

    // ── 2. Download photo (3 methods, fallback chain) ─────────
    let blob = null;
    let errA = "skipped", errB = "skipped", errC = "skipped";

    if (body.tg_url) {
      try {
        const r = UrlFetchApp.fetch(body.tg_url, {muteHttpExceptions:true});
        if (r.getResponseCode() === 200) { blob = r.getBlob(); Logger.log("✅ Method A: tg_url OK"); }
        else errA = "HTTP " + r.getResponseCode();
      } catch(e) { errA = "EX:" + e.message; }
    } else errA = "no tg_url";

    if (!blob && body.tg_file_id) {
      try {
        const botToken = MDG_BOT_TOKEN;
        if (botToken) {
          const apiUrl = "https://api.telegram.org/bot" + botToken + "/getFile?file_id=" + encodeURIComponent(body.tg_file_id);
          const apiResp = UrlFetchApp.fetch(apiUrl, {muteHttpExceptions:true});
          const apiData = JSON.parse(apiResp.getContentText());
          if (apiData.ok) {
            const freshUrl = "https://api.telegram.org/file/bot" + botToken + "/" + apiData.result.file_path;
            const r2 = UrlFetchApp.fetch(freshUrl, {muteHttpExceptions:true});
            if (r2.getResponseCode() === 200) { blob = r2.getBlob(); Logger.log("✅ Method B OK"); }
            else errB = "download HTTP " + r2.getResponseCode();
          } else errB = "API err:" + apiData.error_code;
        } else errB = "no token";
      } catch(e) { errB = "EX:" + e.message; }
    } else if (!blob) errB = "no file_id";

    if (!blob && body.photo_b64) {
      try {
        const bytes = Utilities.base64Decode(body.photo_b64);
        blob = Utilities.newBlob(bytes, "image/jpeg", body.filename || "photo.jpg");
      } catch(e) { errC = "EX:" + e.message; }
    } else if (!blob) errC = "no b64";

    if (!blob) return json({ status:"error", message: "A=" + errA + " | B=" + errB + " | C=" + errC });

    // ── 3. Upload lên Drive ───────────────────────────────────
    const folder = targetType === "MDG" ? getMdgFolder_() : getInvFolder_();
    const df     = folder.createFile(blob);
    df.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const link   = df.getUrl();

    // ── 4. Ghi =HYPERLINK() ───────────────────────────────────
    const targetCols = targetType === "MDG" ? PHOTO_COLS : IPHOTO_COLS;
    const refCol = targetType === "MDG" ? MCOL.REF : ICOL.REF;
    let mRef = String(targetSheet.getRange(targetRow, refCol).getValue()).trim();
    if (!mRef) mRef = refId || "?";

    let photoNum = 0;
    for (let i = 0; i < targetCols.length; i++) {
      const cell = targetSheet.getRange(targetRow, targetCols[i]);
      if (!cell.getValue()) {
        photoNum = i + 1;
        cell.setFormula('=HYPERLINK("' + link + '","Photo ' + photoNum + '")');
        cell.setFontColor("#1155CC").setFontLine("underline");
        break;
      }
    }
    if (photoNum === 0) return json({ status:"error", message: "Max photos reached for REF:" + mRef });
    return json({ status:"ok", link:link, attached:true, ref:mRef, photoNum:photoNum, type: targetType });
  } catch(err) { Logger.log("❌ processPhoto: "+err.message); return json({ status:"error", message:err.message }); }
}

// ============================================================
// MDG GET STATS
// ============================================================
function mdgGetStats(body) {
  try {
    const ss=SpreadsheetApp.openById(MDG_SHEET_ID);
    const sh=getMdgSheet_(ss);
    const lr=sh.getLastRow();
    const today=Utilities.formatDate(new Date(),"Asia/Yangon","dd/MM/yyyy");
    let tc=0;
    if (lr>1) {
      const ds=sh.getRange(2,MCOL.REC_DATE,lr-1,1).getValues();
      tc=ds.filter(r=>String(r[0]).includes(today)).length;
    }
    return json({ status:"ok", stats:{ total:Math.max(lr-1,0), today:tc } });
  } catch(err) { return json({ status:"error", message:err.message }); }
}

// ============================================================
// HELPERS
// ============================================================
function getMdgFolder_() {
  const pi=DriveApp.getFoldersByName("1 VCM BRANCH TNI");
  const root=pi.hasNext()?pi.next():DriveApp.getRootFolder();
  const fi=root.getFoldersByName(MDG_PHOTO_DIR);
  return fi.hasNext()?fi.next():root.createFolder(MDG_PHOTO_DIR);
}
function getInvFolder_() {
  const pi=DriveApp.getFoldersByName("1 VCM BRANCH TNI");
  const root=pi.hasNext()?pi.next():DriveApp.getRootFolder();
  const fi=root.getFoldersByName(INV_PHOTO_DIR);
  return fi.hasNext()?fi.next():root.createFolder(INV_PHOTO_DIR);
}
// ============================================================
// ROUTING: doPost/doGet/json() đều nằm trong apps_script_collector.js
// (cùng 1 GAS project — không khai báo lại ở đây — sẽ bị conflict!)
// doPost route MDG actions → doPostMdg_() (line 76-83 of collector)
// doGet  route MDG GET    → doGetMdg_()  (line 105 of collector)
// ============================================================
