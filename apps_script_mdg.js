// ============================================================
// APPS SCRIPT — MDG RUN DATA COLLECTOR  v1.0
// Sheet  : MDG Detail  |  Folder : 2.4 Run MDG
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
  PHOTOS:   21,   // U — Drive links (max 6)
};
const MTOTAL_COLS = 21;
const MHEADERS = [
  "REF","Confirm Complete","Recorded Date","Recorded Time",
  "Report Date","Site ID","Branch","Team",
  "MDG Code","MDG Capacity","MDG Serial",
  "DG Start Time","DG End Time","Total Hours",
  "Staff Name","Staff Code","Remark",
  "Sender Name","Sender ID","Raw Content","Photos"
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
    return json_({ status:"ok", version:"mdg-v1.0", message:"MDG Collector running ✅" });
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
  const sh  = getMdgSheet_(ss);
  const fv  = sh.getRange(1,1).getValue();
  if (!fv || fv.toString().trim()==="") {
    const hdr = sh.getRange(1,1,1,MTOTAL_COLS);
    hdr.setValues([MHEADERS]);
    hdr.setFontWeight("bold").setBackground("#1565C0").setFontColor("#FFFFFF");
    sh.setFrozenRows(1);
    sh.setColumnWidth(MCOL.RAW,300);
    sh.setColumnWidth(MCOL.PHOTOS,250);
  } else {
    const ex = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    MHEADERS.forEach((h,i)=>{
      if (!ex.includes(h)) sh.getRange(1,i+1).setValue(h)
        .setFontWeight("bold").setBackground("#1565C0").setFontColor("#FFFFFF");
    });
  }
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
    rd[MCOL.DG_START -1] = f["dg start time"]|| "";
    rd[MCOL.DG_END   -1] = f["dg end time"]  || "";
    rd[MCOL.TOTAL_HRS-1] = f["total hours"]  || "";
    rd[MCOL.STAFF_NM -1] = f["staff name"]   || "";
    rd[MCOL.STAFF_CD -1] = f["staff code"]   || "";
    rd[MCOL.REMARK   -1] = f["remark"]       || "";
    rd[MCOL.SENDER   -1] = body.sender_name  || "";
    rd[MCOL.SENDER_ID-1] = body.sender_id    || "";
    rd[MCOL.RAW      -1] = body.raw          || "";
    rd[MCOL.PHOTOS   -1] = "";
    sh.getRange(nr,1,1,MTOTAL_COLS).setValues([rd]);
    // Force RPT_DATE (col E) luu text, khong bi Sheets convert sang Date
    if (rd[MCOL.RPT_DATE-1]) { const dc=sh.getRange(nr,MCOL.RPT_DATE); dc.setNumberFormat("@"); dc.setValue(rd[MCOL.RPT_DATE-1]); }
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
// MDG ADD PHOTO
// ============================================================
function mdgAddPhoto(body) {
  try {
    const ss      = SpreadsheetApp.openById(MDG_SHEET_ID);
    const sh      = getMdgSheet_(ss);
    const refId   = String(body.ref_id   ||"").trim();
    const tgUrl   = body.tg_url          ||"";
    const senderId= String(body.sender_id||"").trim();
    if (!tgUrl) return json_({ status:"error", message:"tg_url required" });
    const imgR = UrlFetchApp.fetch(tgUrl,{muteHttpExceptions:true});
    if (imgR.getResponseCode()!==200)
      return json_({ status:"error", message:"Download fail: "+imgR.getResponseCode() });
    const blob = imgR.getBlob();
    const ts   = Utilities.formatDate(new Date(),"Asia/Yangon","yyyyMMdd_HHmmss");
    blob.setName("MDG_"+(refId||senderId)+"_"+ts+".jpg");
    const folder = getMdgFolder_();
    const df     = folder.createFile(blob);
    df.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    const link   = df.getUrl();
    // Find target row
    const lr = sh.getLastRow();
    let tRow = -1, mRef = refId||null;
    if (refId) {
      const rc = sh.getRange(2,MCOL.REF,lr-1,1).getValues();
      for (let i=0;i<rc.length;i++)
        if (String(rc[i][0]||"").replace(/^0+/,"")===refId.replace(/^0+/,"")) { tRow=i+2; break; }
    }
    if (tRow<0 && senderId) {
      const now=new Date();
      const sc=sh.getRange(2,MCOL.SENDER_ID,lr-1,1).getValues();
      const dc=sh.getRange(2,MCOL.REC_DATE, lr-1,1).getValues();
      const tc=sh.getRange(2,MCOL.REC_TIME, lr-1,1).getValues();
      for (let i=sc.length-1;i>=0;i--) {
        if (String(sc[i][0]||"")===senderId) {
          try { const d=new Date(dc[i][0]+" "+tc[i][0]); if ((now-d)<30*60*1000){tRow=i+2;break;} }
          catch(_){tRow=i+2;break;}
        }
      }
    }
    if (tRow<0) tRow=lr;
    let attached=false;
    if (tRow>0) {
      const rv=sh.getRange(tRow,MCOL.REF).getValue();
      if (rv) mRef=String(rv).trim();
      const cell=sh.getRange(tRow,MCOL.PHOTOS);
      const ex=cell.getValue().toString().trim();
      const ps=ex?ex.split(" | "):[];
      if (ps.length<6) { ps.push(link); cell.setValue(ps.join(" | ")); attached=true; }
    }
    return json_({ status:"ok", link:link, attached:attached, ref:mRef });
  } catch(err) { return json_({ status:"error", message:err.message }); }
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

