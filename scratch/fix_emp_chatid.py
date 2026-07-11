f = open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', encoding='utf-8')
c = f.read()
f.close()

# Fix 1: employees.push - thêm chat_id: colE
old1 = "    } else if (team && name) {\n      // Nhan vien: co ca team va ten\n      employees.push({ team: team, name: name, content: cont });\n    }"
new1 = "    } else if (team && name) {\n      // Nhan vien: co ca team va ten - lay chat_id tu cot E\n      employees.push({ team: team, name: name, content: cont, chat_id: colE });\n    }"

# Fix 2: empResult - dùng emp.chat_id trực tiếp thay vì lookup cfgIdMap
old2 = "    const chatId = cfgIdMap[emp.name.toLowerCase()] || '';"
new2 = "    const chatId = emp.chat_id || cfgIdMap[emp.name.toLowerCase()] || '';"

ok1 = ok2 = False
if old1 in c:
    c = c.replace(old1, new1); ok1 = True
if old2 in c:
    c = c.replace(old2, new2); ok2 = True

open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', 'w', encoding='utf-8').write(c)
print('Fix1 employees.push chat_id:', ok1)
print('Fix2 empResult chatId:', ok2)
