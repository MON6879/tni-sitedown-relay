"""
check_read_status.py
====================
Kiểm tra ai đã đọc tin nhắn gần nhất → gửi kết quả vào nhóm đó
để mọi người cùng thấy.

Chạy: python check_read_status.py
Hoặc: GitHub Actions → workflow_dispatch
"""

import asyncio
import os
from datetime import datetime, timezone, timedelta

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.messages import GetMessageReadParticipantsRequest
from telethon.errors import ChatAdminRequiredError

# ── Cấu hình ──────────────────────────────────────────────────
API_ID         = int(os.environ["TELEGRAM_API_ID"])
API_HASH       = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING = os.environ["TELEGRAM_SESSION"]

MYANMAR_TZ = timezone(timedelta(hours=6, minutes=30))

GROUPS = {
    "CONTROL": { "name": "5 TNI TECHNICA DEP CONTROL", "id": -5251698940 },
    "T1":      { "name": "Team 1",                      "id": -5180992881 },
    "T2":      { "name": "Team 2 (T2+T5)",              "id": -5188855349 },
    "T3":      { "name": "Team 3",                      "id": -5183480727 },
    "T4":      { "name": "Team 4",                      "id": -5238696719 },
}

# Kiểm tra N tin nhắn gần nhất do tài khoản cá nhân gửi
CHECK_LAST_N = 3
# ──────────────────────────────────────────────────────────────

def myanmar_now():
    return datetime.now(MYANMAR_TZ).strftime("%H:%M %d/%m/%Y")

def fmt_time(dt):
    if dt is None:
        return "?"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(MYANMAR_TZ).strftime("%H:%M %d/%m")


async def check_and_report(client, key, group_info):
    gname  = group_info["name"]
    chat_id = group_info["id"]

    print(f"\n{'='*50}\n📋 {gname}\n{'='*50}")

    try:
        entity = await client.get_entity(chat_id)
    except Exception as e:
        print(f"  ❌ Không lấy được entity: {e}")
        return

    # Lấy tin nhắn do tài khoản mình gửi
    try:
        messages = await client.get_messages(entity, limit=30)
    except Exception as e:
        print(f"  ❌ Lỗi get_messages: {e}")
        return

    my_msgs = [m for m in messages if m.out and m.text][:CHECK_LAST_N]

    if not my_msgs:
        print("  ⚠️  Không có tin nhắn nào do tài khoản này gửi")
        return

    # ── Xây dựng báo cáo ──────────────────────────────────────
    report_lines = []
    report_lines.append(f"👁 <b>READ STATUS — {gname}</b>")
    report_lines.append(f"⏰ {myanmar_now()}")
    report_lines.append("━" * 26)

    for msg in my_msgs:
        send_time = fmt_time(msg.date)
        preview   = (msg.text or "")[:50].replace("\n", " ")
        report_lines.append(f"\n📨 <b>[{send_time}]</b> {preview}...")

        try:
            readers = await client(GetMessageReadParticipantsRequest(
                peer   = entity,
                msg_id = msg.id
            ))

            if not readers:
                report_lines.append("  ❌ Chưa có ai đọc")
                print(f"  [{send_time}] Chưa có ai đọc")
            else:
                report_lines.append(f"  ✅ Đã đọc: <b>{len(readers)} người</b>")
                for user in readers:
                    full_name = (user.first_name or "") + (" " + user.last_name if user.last_name else "")
                    uname     = f" (@{user.username})" if user.username else ""
                    report_lines.append(f"  • {full_name.strip()}{uname}")
                print(f"  [{send_time}] Đã đọc: {len(readers)} người")

        except ChatAdminRequiredError:
            report_lines.append("  ⚠️ Cần quyền admin để xem")
        except Exception as e:
            report_lines.append(f"  ⚠️ Không lấy được: {e}")
            print(f"  ❌ Lỗi: {e}")

    # ── Gửi báo cáo vào nhóm ──────────────────────────────────
    report_text = "\n".join(report_lines)
    try:
        await client.send_message(
            entity,
            report_text,
            parse_mode="html"
        )
        print(f"  📤 Đã gửi báo cáo vào nhóm {gname}")
    except Exception as e:
        print(f"  ❌ Gửi báo cáo thất bại: {e}")


async def main():
    print(f"🔍 Kiểm tra read status — {myanmar_now()}")

    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    async with client:
        me = await client.get_me()
        print(f"🔑 Tài khoản: @{me.username} ({me.first_name})")
        print(f"📊 Kiểm tra {CHECK_LAST_N} tin gần nhất → gửi kết quả vào từng nhóm\n")

        for key, info in GROUPS.items():
            await check_and_report(client, key, info)
            await asyncio.sleep(1)   # tránh rate limit

    print(f"\n✅ Xong — {myanmar_now()}")


if __name__ == "__main__":
    asyncio.run(main())
