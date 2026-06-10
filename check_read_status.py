"""
check_read_status.py
====================
Kiểm tra ai đã đọc tin nhắn gần nhất do tài khoản cá nhân gửi
vào các nhóm T1/T2/T3/T4/CONTROL.

Chạy: python check_read_status.py
Hoặc: GitHub Actions → workflow_dispatch
"""

import asyncio
import os
from datetime import datetime, timezone, timedelta

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.messages import GetMessageReadParticipantsRequest
from telethon.errors import ChatAdminRequiredError, PeerIdInvalidError

# ── Cấu hình ──────────────────────────────────────────────────
API_ID         = int(os.environ["TELEGRAM_API_ID"])
API_HASH       = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING = os.environ["TELEGRAM_SESSION"]

MYANMAR_TZ = timezone(timedelta(hours=6, minutes=30))

GROUPS = {
    "CONTROL (5 TNI TECHNICA DEP)": -5251698940,
    "Team 1":                        -5180992881,
    "Team 2 (T2+T5)":               -5188855349,
    "Team 3":                        -5183480727,
    "Team 4":                        -5238696719,
}

# Số tin nhắn gần nhất cần kiểm tra (do tài khoản mình gửi)
CHECK_LAST_N = 3
# ──────────────────────────────────────────────────────────────

def myanmar_now():
    return datetime.now(MYANMAR_TZ).strftime("%H:%M:%S %d/%m/%Y")

def fmt_time(dt):
    if dt is None:
        return "?"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(MYANMAR_TZ).strftime("%H:%M %d/%m")


async def check_group(client, name, chat_id):
    print(f"\n{'='*50}")
    print(f"📋 {name}")
    print(f"{'='*50}")

    try:
        entity = await client.get_entity(chat_id)
    except Exception as e:
        print(f"  ❌ Không lấy được entity: {e}")
        return

    # Lấy tin nhắn do mình gửi (out=True)
    try:
        messages = await client.get_messages(entity, limit=20)
    except Exception as e:
        print(f"  ❌ Lỗi get_messages: {e}")
        return

    my_msgs = [m for m in messages if m.out and m.text][:CHECK_LAST_N]

    if not my_msgs:
        print("  ⚠️  Không tìm thấy tin nhắn nào do tài khoản này gửi gần đây")
        return

    for msg in my_msgs:
        send_time = fmt_time(msg.date)
        preview   = (msg.text or "")[:60].replace("\n", " ")
        print(f"\n  📨 [{send_time}] {preview}...")

        try:
            result = await client(GetMessageReadParticipantsRequest(
                peer   = entity,
                msg_id = msg.id
            ))

            if not result:
                print("  👁️  Chưa có ai đọc")
            else:
                print(f"  👁️  Đã đọc: {len(result)} người")
                for user in result:
                    name_str = (user.first_name or "") + " " + (user.last_name or "")
                    username = f"@{user.username}" if user.username else ""
                    print(f"    ✅ {name_str.strip()} {username}")

        except ChatAdminRequiredError:
            print("  ⚠️  Cần quyền admin để xem (supergroup lớn)")
        except Exception as e:
            print(f"  ❌ Lỗi: {e}")


async def main():
    print(f"🔍 Kiểm tra read status — {myanmar_now()}")

    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    async with client:
        me = await client.get_me()
        print(f"🔑 Tài khoản: @{me.username} ({me.first_name})")
        print(f"📊 Kiểm tra {CHECK_LAST_N} tin nhắn gần nhất do bạn gửi mỗi nhóm\n")

        for group_name, chat_id in GROUPS.items():
            await check_group(client, group_name, chat_id)

    print(f"\n\n✅ Xong — {myanmar_now()}")


if __name__ == "__main__":
    asyncio.run(main())
