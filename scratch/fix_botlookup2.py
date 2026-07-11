import re

with open('botlookup_relay.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

# Fix 1: Add dialog caching after client connects (to resolve T1-T4 peers)
old1 = '''        me = await client.get_me()
        print(f"[{myanmar_now()}] 🔑 Đăng nhập: @{me.username} ({me.first_name})")'''

new1 = '''        me = await client.get_me()
        print(f"[{myanmar_now()}] Dang nhap: @{me.username} ({me.first_name})")

        # Cache toan bo dialogs de Telethon resolve duoc T1/T2/T3/T4 peer
        print(f"[{myanmar_now()}] Cache dialogs...")
        await client.get_dialogs(limit=200)
        print(f"[{myanmar_now()}] Cache xong")'''

if old1.replace('\r\n','\n') in content:
    content = content.replace(old1.replace('\r\n','\n'), new1)
    print("Fix 1 (dialog cache): APPLIED")
else:
    # Try partial match
    if 'me.first_name})' in content:
        content = content.replace(
            'print(f"[{myanmar_now()}] 🔑 Đăng nhập: @{me.username} ({me.first_name})")',
            '''print(f"[{myanmar_now()}] Dang nhap: @{me.username} ({me.first_name})")

        # Cache toan bo dialogs de Telethon resolve duoc T1/T2/T3/T4 peer
        print(f"[{myanmar_now()}] Cache dialogs...")
        await client.get_dialogs(limit=200)
        print(f"[{myanmar_now()}] Cache xong")'''
        )
        print("Fix 1 (dialog cache): APPLIED via partial")
    else:
        print("Fix 1: NOT FOUND")

# Fix 2: Fix command detection - also check msg.out flag
old2 = '''            if not found_command:
                if msg.sender_id == me.id and "/down_tni" in (msg.message or "").lower():
                    found_command = True
                continue'''

new2 = '''            if not found_command:
                # Check via sender_id OR msg.out flag (some groups use out=True)
                is_mine = (msg.sender_id == me.id) or getattr(msg, 'out', False)
                if is_mine and "/down_tni" in (msg.message or "").lower():
                    found_command = True
                continue'''

if old2 in content:
    content = content.replace(old2, new2)
    print("Fix 2 (command detection): APPLIED")
else:
    print("Fix 2: NOT FOUND - trying alternate")
    if 'msg.sender_id == me.id and "/down_tni"' in content:
        content = content.replace(
            'if msg.sender_id == me.id and "/down_tni" in (msg.message or "").lower():',
            '''# Check via sender_id OR msg.out flag (some groups use out=True)
                is_mine = (msg.sender_id == me.id) or getattr(msg, 'out', False)
                if is_mine and "/down_tni" in (msg.message or "").lower():'''
        )
        print("Fix 2: APPLIED via alternate")

# Fix 3: Fallback also checks msg.out
old3 = '''        if not found_command:
            print(f"[{myanmar_now()}] Khong tim thay lenh /down_tni -> fallback: lay toan bo tin bot")
            for msg in all_after:
                s_name = ""
                if msg.sender_id:
                    try:
                        s = await client.get_entity(msg.sender_id)
                        s_name = getattr(s, "username", "") or ""
                    except Exception:
                        pass
                if s_name.lower() == BOT_USERNAME.lower() and msg.message:
                    bot_messages.append(msg.message)'''

new3 = '''        if not found_command:
            print(f"[{myanmar_now()}] Khong tim thay lenh /down_tni -> fallback: lay toan bo tin bot sau send_time")
            for msg in all_after:
                is_mine = (msg.sender_id == me.id) or getattr(msg, 'out', False)
                if is_mine:
                    continue  # skip own messages
                s_name = ""
                if msg.sender_id:
                    try:
                        s = await client.get_entity(msg.sender_id)
                        s_name = getattr(s, "username", "") or ""
                    except Exception:
                        pass
                if s_name.lower() == BOT_USERNAME.lower() and msg.message:
                    bot_messages.append(msg.message)'''

if old3 in content:
    content = content.replace(old3, new3)
    print("Fix 3 (fallback skip own): APPLIED")
else:
    print("Fix 3: NOT FOUND (ok, minor)")

with open('botlookup_relay.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("\nFile written OK")
