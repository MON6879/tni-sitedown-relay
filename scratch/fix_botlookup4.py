import re

with open('botlookup_relay.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('\r\n', '\n')

# Fix: Replace iter_dialogs with entity-map building approach
old1 = '''        # Cache TAT CA dialogs -> Telethon resolve duoc T1/T2/T3/T4 peer
        print(f"[{myanmar_now()}] Cache ALL dialogs...")
        async for _d in client.iter_dialogs():
            pass  # iterate het de cache entity
        print(f"[{myanmar_now()}] Cache xong")'''

new1 = '''        # Build entity map tu tat ca dialogs
        print(f"[{myanmar_now()}] Building entity map from dialogs...")
        entity_map = {}  # gname -> entity
        all_gids = set(str(abs(gid)) for gid in ALL_GROUPS.values())
        async for dialog in client.iter_dialogs():
            did = str(getattr(dialog.entity, 'id', 0))
            for gname, gid in ALL_GROUPS.items():
                if did == str(abs(int(gid))):
                    entity_map[gname] = dialog.entity
                    print(f"[{myanmar_now()}] Found {gname}: {dialog.title}")
        # Bao cao nhom nao tim thay
        for gname in ALL_GROUPS:
            if gname not in entity_map:
                print(f"[{myanmar_now()}] WARNING: {gname} not in dialogs!")
        print(f"[{myanmar_now()}] Entity map: {list(entity_map.keys())}")'''

if old1 in content:
    content = content.replace(old1, new1)
    print("Fix 1 (entity map): APPLIED")
else:
    print("Fix 1: NOT FOUND")

# Fix: Use entity_map when sending Note to groups
old2 = '''                    sent_msg = await client.send_message(gid, note_text, reply_to=reply_to_id)'''
new2 = '''                    # Dung entity tu entity_map neu co, fallback sang gid
                    target = entity_map.get(gname, int(gid))
                    sent_msg = await client.send_message(target, note_text, reply_to=reply_to_id)'''

if old2 in content:
    content = content.replace(old2, new2)
    print("Fix 2 (use entity_map for send): APPLIED")
else:
    print("Fix 2: NOT FOUND")
    # Try to find the send_message line
    lines = content.split('\n')
    for i, l in enumerate(lines):
        if 'send_message(gid' in l or 'send_message(target' in l:
            print(f"  Line {i+1}: {l}")

# Fix: also fix history lookup to use entity_map
old3 = '''                        grp_hist = await client(GetHistoryRequest(
                                peer=gid, limit=15,'''
new3 = '''                        grp_hist = await client(GetHistoryRequest(
                                peer=entity_map.get(gname, int(gid)), limit=15,'''

if old3 in content:
    content = content.replace(old3, new3)
    print("Fix 3 (entity_map for GetHistoryRequest): APPLIED")
else:
    print("Fix 3: NOT FOUND")

with open('botlookup_relay.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("\nFile written OK")
