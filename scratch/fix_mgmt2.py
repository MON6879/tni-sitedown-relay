f = open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', encoding='utf-8')
c = f.read()
f.close()

# Fix 1: fetchReportSheet - don't skip rows where col C is a management title
# even if col A and col B are empty
old = """    if (!team || !name) continue;
    // Bo qua dong header
    if (team === 'Assign Site' || team.indexOf('Export time') >= 0) continue;
    if (name === 'Assign Site' || name === 'Name System') continue;

    if (/Team leader/i.test(colC)) {
      leaders.push({ team: team, name: name, content: cont, chat_id: colE });
    } else if (/Manager|BOD|Director/i.test(colC)) {
      // Management row: col C = "Duty Manager" / "Manager" / "BOD"
      // col E = Telegram ID, col B = name (may be empty), col A = label
      const mgName = name || team || colC;
      if (colE) {
        managers.push({ role: colC, name: mgName, chat_id: colE });
      }
    } else {
      employees.push({ team: team, name: name, content: cont });
    }"""

new = """    // Check management row BEFORE empty check (these have empty A+B)
    if (/Duty.?Manager|^Manager$|^BOD$|Director/i.test(colC)) {
      const mgName = name || team || colC;
      if (colE) {
        managers.push({ role: colC, name: mgName, chat_id: colE });
      }
      continue;
    }

    if (!team || !name) continue;
    // Bo qua dong header
    if (team === 'Assign Site' || team.indexOf('Export time') >= 0) continue;
    if (name === 'Assign Site' || name === 'Name System') continue;
    // Bo qua team "All WO" (gia, khong phai team that)
    if (team === 'All WO') continue;

    if (/Team leader/i.test(colC)) {
      leaders.push({ team: team, name: name, content: cont, chat_id: colE });
    } else {
      employees.push({ team: team, name: name, content: cont });
    }"""

if old in c:
    c = c.replace(old, new)
    open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', 'w', encoding='utf-8').write(c)
    print('OK - management rows fixed + All WO filtered')
else:
    print('NOT FOUND - searching...')
    idx = c.find('Management row')
    if idx >= 0:
        print(repr(c[idx-200:idx+300]))
    else:
        idx2 = c.find('Duty Manager')
        if idx2 >= 0:
            print(repr(c[idx2-200:idx2+200]))
        else:
            print('Duty Manager not found either')
