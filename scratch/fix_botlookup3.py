import re

with open('botlookup_relay.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('\r\n', '\n')

# Fix 1: Cache ALL dialogs using iter_dialogs (not limited to 200)
old1 = '''        # Cache toan bo dialogs de Telethon resolve duoc T1/T2/T3/T4 peer
        print(f"[{myanmar_now()}] Cache dialogs...")
        await client.get_dialogs(limit=200)
        print(f"[{myanmar_now()}] Cache xong")'''

new1 = '''        # Cache TAT CA dialogs -> Telethon resolve duoc T1/T2/T3/T4 peer
        print(f"[{myanmar_now()}] Cache ALL dialogs...")
        async for _d in client.iter_dialogs():
            pass  # iterate het de cache entity
        print(f"[{myanmar_now()}] Cache xong")'''

if old1 in content:
    content = content.replace(old1, new1)
    print("Fix 1 (iter_dialogs): APPLIED")
else:
    print("Fix 1: NOT FOUND")

# Fix 2: Set send_time AFTER sending + small buffer back
old2 = '''        # ── 4. Ghi nhớ thời điểm gửi lệnh ───────────────────────
        send_time = datetime.now(timezone.utc)

        # ── 5. Gửi lệnh ──────────────────────────────────────────
        print(f"[{myanmar_now()}] 📤 Gửi: {COMMAND}")
        await client.send_message(source, COMMAND)'''

new2 = '''        # ── 4+5. Gui lenh va ghi nho thoi diem SAU khi gui ─────
        print(f"[{myanmar_now()}] 📤 Gửi: {COMMAND}")
        await client.send_message(source, COMMAND)
        # send_time dat SAU khi gui, tru 5s buffer de chac chan include command
        send_time = datetime.now(timezone.utc) - timedelta(seconds=5)'''

if old2 in content:
    content = content.replace(old2, new2)
    print("Fix 2 (send_time after send): APPLIED")
else:
    print("Fix 2: NOT FOUND, trying partial...")
    if 'send_time = datetime.now(timezone.utc)' in content and 'await client.send_message(source, COMMAND)' in content:
        # Find the block manually
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'Ghi nhớ thời điểm' in line or 'send_time = datetime.now(timezone.utc)' in line:
                print(f"  Found send_time at line {i+1}: {line}")
            if 'await client.send_message(source, COMMAND)' in line:
                print(f"  Found send_message at line {i+1}: {line}")

with open('botlookup_relay.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("\nFile written")
