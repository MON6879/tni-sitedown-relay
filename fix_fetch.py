f = open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', encoding='utf-8')
c = f.read()
f.close()

old = """function fetchReportSheet() {
  const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:csv&gid=' + REPORT_GID;
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const rows = Utilities.parseCsv(resp.getContentText());
  const employees = [];
  const leaders = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const team = (row[0] || '').toString().trim();
    const name = (row[1] || '').toString().trim();
    const colC = (row[2] || '').toString().trim();
    const cont = (row[3] || '').toString().trim();
    const colE = (row[4] || '').toString().trim();
    if (!team || !name) continue;
    if (team === 'Assign Site' || team.indexOf('Export time') >= 0) continue;
    if (/Team leader/i.test(colC)) {
      leaders.push({ team: team, name: name, content: cont, chat_id: colE });
    } else {
      employees.push({ team: team, name: name, content: cont });
    }
  }
  return { employees: employees, leaders: leaders };
}"""

new = """function fetchReportSheet() {
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

  // Doc tu dong 1 den cuoi (giu nguyen index de biet vi tri)
  const data = reportSheet.getRange(1, 1, lastRow, 5).getValues();
  const employees = [];
  const leaders   = [];

  for (let i = 0; i < data.length; i++) {
    const row  = data[i];
    const team = (row[0] || '').toString().trim();
    const name = (row[1] || '').toString().trim();
    const colC = (row[2] || '').toString().trim();
    const cont = (row[3] || '').toString().trim();
    const colE = (row[4] || '').toString().trim();

    if (!team || !name) continue;
    // Bo qua dong header
    if (team === 'Assign Site' || team.indexOf('Export time') >= 0) continue;
    if (name === 'Assign Site' || name === 'Name System') continue;

    if (/Team leader/i.test(colC)) {
      leaders.push({ team: team, name: name, content: cont, chat_id: colE });
    } else {
      employees.push({ team: team, name: name, content: cont });
    }
  }
  return { employees: employees, leaders: leaders };
}"""

if old in c:
    c = c.replace(old, new)
    open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', 'w', encoding='utf-8').write(c)
    print('OK - fetchReportSheet fixed to use SpreadsheetApp')
else:
    print('NOT FOUND - checking snippet...')
    idx = c.find('function fetchReportSheet')
    if idx >= 0:
        print(repr(c[idx:idx+200]))
    else:
        print('fetchReportSheet not found at all')
