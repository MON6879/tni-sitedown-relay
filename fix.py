with open(r'd:\6. AI\1. QLTC\Task and WO\apps_script_mdg.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = lines[:534] + [
'''
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
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
'''
]

with open(r'd:\6. AI\1. QLTC\Task and WO\apps_script_mdg.js', 'w', encoding='utf-8') as f:
    for line in new_lines:
        f.write(line if line.endswith('\n') else line + '\n')
