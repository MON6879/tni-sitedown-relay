import re

with open('botlookup_relay.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize line endings
content = content.replace('\r\n', '\n')

# New collection block
new_block = '''        # -- 7. Doc lich su Botlookup (newest-first tu API) --
        history = await client(GetHistoryRequest(
            peer=source, limit=50,
            offset_date=None, offset_id=0,
            max_id=0, min_id=0, add_offset=0, hash=0,
        ))

        # -- 8. Thu thap tin sau send_time, sort oldest-first --
        all_after = [msg for msg in history.messages if msg.date >= send_time]
        all_after.sort(key=lambda m: m.date)  # oldest-first = tu tren xuong

        # -- 9. Gom tin bot: tu lenh /down_tni -> dung khi co nguoi khac --
        found_command = False
        bot_messages  = []

        for msg in all_after:
            # Tim lenh /down_tni do chinh minh gui
            if not found_command:
                if msg.sender_id == me.id and "/down_tni" in (msg.message or "").lower():
                    found_command = True
                continue

            # Sau lenh: kiem tra sender
            sender_uname = ""
            if msg.sender_id:
                try:
                    s = await client.get_entity(msg.sender_id)
                    sender_uname = getattr(s, "username", "") or ""
                except Exception:
                    pass

            if sender_uname.lower() == BOT_USERNAME.lower() and msg.message:
                # Tin tu bot -> gom vao (thu tu tu tren xuong)
                bot_messages.append(msg.message)
                print(f"[{myanmar_now()}] Bot tin #{len(bot_messages)}: {len(msg.message)} ky tu")
            else:
                # Nguoi khac gui -> ket thuc vung tra loi cua bot
                if msg.sender_id != me.id:
                    print(f"[{myanmar_now()}] STOP: nguoi khac gui (sender_id={msg.sender_id})")
                    break

        if not found_command:
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
                    bot_messages.append(msg.message)

        gas_url = os.environ.get("APPS_SCRIPT_URL", "")

        if not bot_messages:
            err = f"[{myanmar_now()}] @{BOT_USERNAME} khong phan hoi trong {WAIT_REPLY_SEC}s"
            print(err)
            await client.send_message(TARGET_CHAT_ID, err)

        raw_text = "\\n".join(bot_messages) if bot_messages else ""
'''

# Find the section to replace using regex
pattern = r'        # ── 7\. Đọc lịch sử Botlookup.*?raw_text = "\\n"\.join\(bot_messages\) if bot_messages else ""'
match = re.search(pattern, content, re.DOTALL)
if match:
    print(f"FOUND at {match.start()}-{match.end()}, replacing...")
    content = content[:match.start()] + new_block + content[match.end():]
    with open('botlookup_relay.py', 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print("DONE - file written")
else:
    print("NOT FOUND via regex, trying line-based search...")
    lines = content.split('\n')
    start_line = None
    end_line = None
    for i, line in enumerate(lines):
        if '7.' in line and 'Botlookup' in line and 'lịch sử' in line:
            start_line = i
        if start_line and 'raw_text = ' in line and 'bot_messages' in line:
            end_line = i
            break
    if start_line and end_line:
        print(f"Found via line search: lines {start_line+1} to {end_line+1}")
        new_lines = lines[:start_line] + new_block.split('\n') + lines[end_line+1:]
        with open('botlookup_relay.py', 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(new_lines))
        print("DONE")
    else:
        print(f"Still not found. start={start_line}, end={end_line}")
        # Show context around line 116
        for i in range(114, 155):
            print(f"{i+1}: {lines[i]}")
