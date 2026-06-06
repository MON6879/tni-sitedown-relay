f = open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', encoding='utf-8')
c = f.read()
f.close()

old = """    // Check management row BEFORE empty check (these have empty A+B)
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

new = """    // Bo qua dong header
    if (team === 'Assign Site' || team.indexOf('Export time') >= 0) continue;
    if (name === 'Assign Site' || name === 'Name System') continue;
    // Bo qua team "All WO" (gia)
    if (team === 'All WO') continue;

    if (/Team leader/i.test(colC)) {
      // Doi truong: co team, ten, noi dung
      leaders.push({ team: team, name: name, content: cont, chat_id: colE });
    } else if (team && name) {
      // Nhan vien: co ca team va ten
      employees.push({ team: team, name: name, content: cont });
    } else if (colE) {
      // Quan ly: chi can co ID cot E la gui bao cao tong hop
      const mgName = name || team || colC || ('ID:' + colE);
      managers.push({ role: colC || 'Manager', name: mgName, chat_id: colE });
    }"""

if old in c:
    c = c.replace(old, new)
    open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', 'w', encoding='utf-8').write(c)
    print('OK - managers now detected by col E only')
else:
    print('NOT FOUND')
    idx = c.find('Check management row')
    if idx >= 0:
        print(repr(c[idx:idx+400]))
