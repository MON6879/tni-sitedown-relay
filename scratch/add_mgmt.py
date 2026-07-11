f = open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', encoding='utf-8')
c = f.read()
f.close()

# 1. Fix fetchReportSheet to also detect management rows
old_fetch = """    if (/Team leader/i.test(colC)) {
      leaders.push({ team: team, name: name, content: cont, chat_id: colE });
    } else {
      employees.push({ team: team, name: name, content: cont });
    }
  }
  return { employees: employees, leaders: leaders };
}"""

new_fetch = """    if (/Team leader/i.test(colC)) {
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
    }
  }
  return { employees: employees, leaders: leaders, managers: managers };
}"""

# Also need to add managers array declaration
old_arrays = """  const employees = [];
  const leaders   = [];

  for (let i = 0; i < data.length; i++) {"""

new_arrays = """  const employees = [];
  const leaders   = [];
  const managers  = [];

  for (let i = 0; i < data.length; i++) {"""

if old_fetch in c and old_arrays in c:
    c = c.replace(old_arrays, new_arrays)
    c = c.replace(old_fetch, new_fetch)
    print('fetchReportSheet updated for managers')
else:
    print('NOT FOUND fetch')
    if old_fetch not in c:
        idx = c.find('Team leader')
        print('Team leader at:', idx)
        if idx >= 0:
            print(repr(c[idx-100:idx+200]))

# 2. Add management section to handleGetReportData
old_get = """  const ldResult = [];
  for (const ld of leaders) {
    const s = teamStats[ld.team] || { today: 0, d1: 0, d2: 0, week: 0, month: 0 };
    const chatId = ld.chat_id || cfgIdMap[ld.name.toLowerCase()] || '';
    ldResult.push({ name: ld.name, team: ld.team, chat_id: chatId, today: s.today, d1: s.d1, d2: s.d2, week: s.week, month: s.month });
  }
  handleRefreshGeneral(ss);
  return json({ status: 'ok', employees: empResult, leaders: ldResult });
}"""

new_get = """  const ldResult = [];
  for (const ld of leaders) {
    const s = teamStats[ld.team] || { today: 0, d1: 0, d2: 0, week: 0, month: 0 };
    const chatId = ld.chat_id || cfgIdMap[ld.name.toLowerCase()] || '';
    ldResult.push({ name: ld.name, team: ld.team, chat_id: chatId, today: s.today, d1: s.d1, d2: s.d2, week: s.week, month: s.month });
  }

  // --- Tổng toàn bộ (cho ban quản lý) ---
  const grandTotal = { today: 0, d1: 0, d2: 0, week: 0, month: 0 };
  for (const t of Object.values(teamStats)) {
    grandTotal.today += t.today; grandTotal.d1 += t.d1; grandTotal.d2 += t.d2;
    grandTotal.week += t.week;   grandTotal.month += t.month;
  }

  // --- Team summary list (for management message) ---
  const teamSummary = [];
  for (const [team, s] of Object.entries(teamStats)) {
    teamSummary.push({ team: team, today: s.today, d1: s.d1, d2: s.d2, week: s.week, month: s.month });
  }

  handleRefreshGeneral(ss);
  return json({
    status: 'ok',
    employees: empResult,
    leaders: ldResult,
    managers: managers,
    teamSummary: teamSummary,
    grandTotal: grandTotal
  });
}"""

if old_get in c:
    c = c.replace(old_get, new_get)
    print('handleGetReportData updated for managers')
else:
    print('NOT FOUND get')

open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', 'w', encoding='utf-8').write(c)
print('Done')
