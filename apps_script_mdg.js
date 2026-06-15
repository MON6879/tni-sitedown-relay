// ============================================================
// APPS SCRIPT — MDG RUN DATA COLLECTOR  v2.0
// Sheet  : MDG Detail  |  Folder : 2.4 Run MDG
// Photos : 6 separate columns U-Z with =HYPERLINK() formula
// ============================================================

const MDG_SHEET_ID  = "1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y";
const MDG_DATA_TAB  = "MDG Detail";
const MDG_PHOTO_DIR = "2.4 Run MDG";

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

// ============================================================
// ENTRY POINTS
// ============================================================
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action || "";
    if (action === "mdg_add")       return mdgAdd(body);
    if (action === "mdg_confirm")   return mdgConfirm(body);
    if (action === "mdg_add_photo") return mdgAddPhoto(body);
    if (action === "mdg_get_stats") return mdgGetStats(body);
    return json_({ status:"error", message:"Unknown action: "+action });
  } catch(err) { return json_({ status:"error", message:err.message }); }
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";
    if (action === "mdg_get_stats") return mdgGetStats(e.parameter || {});
    if (action === "mdg_check_row") {
      const ref = (e.parameter && e.parameter.ref) || "";
      const ss  = SpreadsheetApp.openById(MDG_SHEET_ID);
      const sh  = getMdgSheet_(ss);
      const lr  = sh.getLastRow();
      if (lr < 2) return json_({ status:"error", message:"No data" });
      const rc  = sh.getRange(2, MCOL.REF, lr-1, 1).getValues();
      for (let i=0;i<rc.length;i++) {
        if (String(rc[i][0]||"").replace(/^0+/,"")===ref.replace(/^0+/,"")) {
          const row=sh.getRange(i+2,1,1,MTOTAL_COLS).getValues()[0];
          return json_({ status:"ok",ref:ref,sheetRow:i+2,
            E_RPT_DATE:row[MCOL.RPT_DATE-1], F_SITE_ID:row[MCOL.SITE_ID-1],
            H_TEAM:row[MCOL.TEAM-1], I_MDG_CODE:row[MCOL.MDG_CODE-1] });
        }
      }
      return json_({ status:"error", message:"REF not found: "+ref });
    }
    const ss = SpreadsheetApp.openById(MDG_SHEET_ID);
    ensureMdgHeaders_(ss);
    return json_({ status:"ok", version:"mdg-v2.0", message:"MDG Collector running ✅" });
  } catch(err) { return json_({ status:"error", message:err.message }); }
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
    return json_({ status:"ok", ref:ref, row:last });
  } catch(err) { Logger.log("❌ mdg_add: "+err.message); return json_({ status:"error", message:err.message }); }
}


// ============================================================
// MDG CONFIRM
// ============================================================
function mdgConfirm(body) {
  try {
    const ss  = SpreadsheetApp.openById(MDG_SHEET_ID);
    const sh  = getMdgSheet_(ss);
    const rid = String(body.ref_id||"").trim();
    if (!rid) return json_({ status:"error", message:"ref_id required" });
    const lr  = sh.getLastRow();
    if (lr<2) return json_({ status:"error", message:"No data" });
    const rc  = sh.getRange(2,MCOL.REF,lr-1,1).getValues();
    for (let i=0;i<rc.length;i++) {
      if (String(rc[i][0]||"").replace(/^0+/,"")===rid.replace(/^0+/,"")) {
        const r=i+2;
        sh.getRange(r,MCOL.CONFIRM).setValue("✅ "+body.confirmed_by+" "+body.date);
        sh.getRange(r,1,1,MTOTAL_COLS).setBackground("#D4EDDA");
        return json_({ status:"ok", ref:rid, row:r });
      }
    }
    return json_({ status:"error", message:"REF not found: "+rid });
  } catch(err) { return json_({ status:"error", message:err.message }); }
}

// ============================================================
// MDG ADD PHOTO  (GAS downloads from Telegram — no Python timeout)
// ============================================================
function mdgAddPhoto(body) {
  try {
    const ss      = SpreadsheetApp.openById(MDG_SHEET_ID);
    const sh      = getMdgSheet_(ss);
    const refId   = String(body.ref_id   ||"").trim();
    const senderId= String(body.sender_id||"").trim();

    // ── 1. Download photo (3 methods, fallback chain) ─────────
    let blob = null;

    // Method A: tg_url trực tiếp (Python đã tính sẵn)
    if (!blob && body.tg_url) {
      try {
        const r = UrlFetchApp.fetch(body.tg_url, {muteHttpExceptions:true});
        if (r.getResponseCode() === 200) {
          blob = r.getBlob();
          Logger.log("✅ Method A: tg_url OK");
        } else {
          Logger.log("⚠️ Method A: tg_url returned " + r.getResponseCode());
        }
      } catch(e) { Logger.log("⚠️ Method A error: "+e.message); }
    }

    // Method B: Gọi Telegram getFile API → fresh URL (nếu A bị 404)
    if (!blob && body.tg_file_id) {
      try {
        const botToken = PropertiesService.getScriptProperties()
                         .getProperty("COLLECTOR_BOT_TOKEN") || "";
        if (botToken) {
          const apiUrl  = "https://api.telegram.org/bot" + botToken
                        + "/getFile?file_id=" + encodeURIComponent(body.tg_file_id);
          const apiResp = UrlFetchApp.fetch(apiUrl, {muteHttpExceptions:true});
          const apiData = JSON.parse(apiResp.getContentText());
          if (apiData.ok) {
            const freshUrl = "https://api.telegram.org/file/bot" + botToken
                           + "/" + apiData.result.file_path;
            const r2 = UrlFetchApp.fetch(freshUrl, {muteHttpExceptions:true});
            if (r2.getResponseCode() === 200) {
              blob = r2.getBlob();
              Logger.log("✅ Method B: getFile+fresh URL OK");
            } else {
              Logger.log("⚠️ Method B: fresh URL returned " + r2.getResponseCode());
            }
          } else {
            Logger.log("⚠️ Method B: getFile API failed: " + apiResp.getContentText());
          }
        } else {
          Logger.log("⚠️ Method B: COLLECTOR_BOT_TOKEN not set in Script Properties");
        }
      } catch(e) { Logger.log("⚠️ Method B error: "+e.message); }
    }

    // Method C: base64 (Python đã download sẵn — fallback cuối)
    if (!blob && body.photo_b64) {
      try {
        const bytes = Utilities.base64Decode(body.photo_b64);
        blob = Utilities.newBlob(bytes, "image/jpeg", body.filename || "photo.jpg");
        Logger.log("✅ Method C: base64 OK");
      } catch(e) { Logger.log("⚠️ Method C error: "+e.message); }
    }

    if (!blob) {
      return json_({ status:"error", message:"All 3 download methods failed. Set COLLECTOR_BOT_TOKEN in Script Properties." });
    }

    // ── 2. Upload lên Drive ───────────────────────────────────
    const folder = getMdgFolder_();
    const df     = folder.createFile(blob);
    df.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const link   = df.getUrl();
    Logger.log("✅ Photo uploaded: "+link);

    // ── 3. Tìm target row ─────────────────────────────────────
    const lr = sh.getLastRow();
    let tRow = -1, mRef = refId||null;
    if (refId && lr>1) {
      const rc = sh.getRange(2,MCOL.REF,lr-1,1).getValues();
      for (let i=0;i<rc.length;i++)
        if (String(rc[i][0]||"").replace(/^0+/,"")===refId.replace(/^0+/,"")) { tRow=i+2; break; }
    }
    // Fallback: sender_id trong 30 phút
    if (tRow<0 && senderId && lr>1) {
      const now=new Date();
      const sc=sh.getRange(2,MCOL.SENDER_ID,lr-1,1).getValues();
      const dc=sh.getRange(2,MCOL.REC_DATE, lr-1,1).getValues();
      const tc=sh.getRange(2,MCOL.REC_TIME, lr-1,1).getValues();
      for (let i=sc.length-1;i>=0;i--) {
        if (String(sc[i][0]||"")===senderId) {
          try { const d=new Date(dc[i][0]+" "+tc[i][0]); if((now-d)<30*60*1000){tRow=i+2;break;} }
          catch(_){tRow=i+2;break;}
        }
      }
    }
    if (tRow<0) tRow=lr;

    // ── 4. Ghi =HYPERLINK() vào cột Photo trống đầu tiên ─────
    if (tRow>0) {
      const rv = sh.getRange(tRow,MCOL.REF).getValue();
      if (rv) mRef = String(rv).trim();

      let photoNum = 0;
      for (let i=0;i<PHOTO_COLS.length;i++) {
        const cell = sh.getRange(tRow, PHOTO_COLS[i]);
        if (!cell.getValue()) {
          photoNum = i+1;
          cell.setFormula('=HYPERLINK("'+link+'","Photo '+photoNum+'")');
          cell.setFontColor("#1155CC").setFontLine("underline");
          Logger.log("✅ HYPERLINK at col "+PHOTO_COLS[i]+" (Photo "+photoNum+") REF:"+mRef);
          break;
        }
      }
      if (photoNum===0) return json_({ status:"error", message:"Max 6 photos reached for REF:"+mRef });
      return json_({ status:"ok", link:link, attached:true, ref:mRef, photoNum:photoNum });
    }
    return json_({ status:"ok", link:link, attached:false, ref:mRef });
  } catch(err) { Logger.log("❌ mdg_add_photo: "+err.message); return json_({ status:"error", message:err.message }); }
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
    return json_({ status:"ok", stats:{ total:Math.max(lr-1,0), today:tc } });
  } catch(err) { return json_({ status:"error", message:err.message }); }
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
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
