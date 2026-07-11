f = open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', encoding='utf-8')
c = f.read()
f.close()

# Add content field to ldResult entries
old = "    ldResult.push({ name: ld.name, team: ld.team, chat_id: chatId, today: s.today, d1: s.d1, d2: s.d2, week: s.week, month: s.month });"
new = "    ldResult.push({ name: ld.name, team: ld.team, chat_id: chatId, content: ld.content, today: s.today, d1: s.d1, d2: s.d2, week: s.week, month: s.month });"

if old in c:
    c = c.replace(old, new)
    open(r'D:\6. AI\1. QLTC\Task and WO\apps_script_collector.js', 'w', encoding='utf-8').write(c)
    print('OK - content added to ldResult')
else:
    print('NOT FOUND')
    idx = c.find('ldResult.push')
    if idx >= 0:
        print(repr(c[idx:idx+200]))
