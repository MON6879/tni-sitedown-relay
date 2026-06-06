f = open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', encoding='utf-8')
c = f.read()
f.close()

# Fix: only add to managers if colE is a real numeric Telegram ID (not "-" or empty)
old = "    } else if (colE) {\n      // Quan ly: chi can co ID cot E la gui bao cao tong hop\n      const mgName = name || team || colC || ('ID:' + colE);\n      managers.push({ role: colC || 'Manager', name: mgName, chat_id: colE });\n    }"

new = "    } else if (colE && /^\\d{5,}$/.test(colE.trim())) {\n      // Quan ly: co ID cot E la so (Telegram ID dang so, khong phai \"-\")\n      const mgName = name || team || colC || ('ID:' + colE);\n      managers.push({ role: colC || 'Manager', name: mgName, chat_id: colE.trim() });\n    }"

if old in c:
    c = c.replace(old, new)
    open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', 'w', encoding='utf-8').write(c)
    print('OK - managers now only accept numeric IDs (5+ digits)')
else:
    print('NOT FOUND')
    idx = c.find('chi can co ID cot E')
    if idx >= 0:
        print(repr(c[idx-50:idx+200]))
