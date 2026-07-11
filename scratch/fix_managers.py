f = open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', encoding='utf-8')
c = f.read()
f.close()

# Fix: add managers destructuring in handleGetReportData
old = """  const data = fetchReportSheet();
  const employees = data.employees;
  const leaders = data.leaders;"""

new = """  const data = fetchReportSheet();
  const employees = data.employees;
  const leaders   = data.leaders;
  const managers  = data.managers;"""

if old in c:
    c = c.replace(old, new)
    open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', 'w', encoding='utf-8').write(c)
    print('OK - managers destructured in handleGetReportData')
else:
    print('NOT FOUND - searching...')
    idx = c.find('const data = fetchReportSheet')
    if idx >= 0:
        print(repr(c[idx:idx+200]))
