f = open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', encoding='utf-8')
c = f.read()
f.close()

# Find the existing routing block and add get_report_data
needle = 'if (body.action === "get_general")'
if needle in c:
    old_line = [l for l in c.split('\n') if needle in l][0]
    new_lines = old_line + '\n    if (body.action === "get_report_data")   return handleGetReportData(ss);'
    c = c.replace(old_line, new_lines)
    open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', 'w', encoding='utf-8').write(c)
    print('OK - get_report_data routing added')
else:
    print('needle not found')
    # show lines 33-45
    for i, l in enumerate(c.split('\n')[32:45], 33):
        print(i, repr(l))
