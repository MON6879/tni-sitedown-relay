"""
check_read_status.py
====================
Check who has read the latest messages → send report to each group.

Run: python check_read_status.py
Or:  GitHub Actions → workflow_dispatch
"""

import asyncio
import os
from datetime import datetime, timezone, timedelta

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.messages import GetMessageReadParticipantsRequest
from telethon.errors import ChatAdminRequiredError
from delete_old_helper import delete_old_messages_telethon, save_msgids

# ── Config ──────────────────────────────────────────────────
API_ID         = int(os.environ["TELEGRAM_API_ID"])
API_HASH       = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING = os.environ["TELEGRAM_SESSION"]
GAS_URL        = os.environ.get("APPS_SCRIPT_URL", "")

MYANMAR_TZ = timezone(timedelta(hours=6, minutes=30))

GROUPS = {
    "CONTROL": { "name": "5 TNI TECHNICA DEP CONTROL", "id": -5251698940 },
    "T1":      { "name": "Team 1",                      "id": -5180992881 },
    "T2":      { "name": "Team 2 (T2+T5)",              "id": -5188855349 },
    "T3":      { "name": "Team 3",                      "id": -5183480727 },
    "T4":      { "name": "Team 4",                      "id": -5238696719 },
}

# Check last N messages sent by this account
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
        print(f"  ❌ Cannot get entity: {e}")
        return

    # Get messages sent by this account
    try:
        messages = await client.get_messages(entity, limit=30)
    except Exception as e:
        print(f"  ❌ Error get_messages: {e}")
        return

    my_msgs = [m for m in messages if m.out and m.text][:CHECK_LAST_N]

    if not my_msgs:
        print("  ⚠️  No messages sent by this account")
        return

    # ── Build report ──────────────────────────────────────
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
                report_lines.append("  ❌ No one has read")
                print(f"  [{send_time}] No one has read")
            else:
                report_lines.append(f"  ✅ Read by: <b>{len(readers)} people</b>")
                for rp in readers:
                    # ReadParticipantDate has user_id + date, resolve to User
                    try:
                        user_id = getattr(rp, "user_id", 0)
                        user = await client.get_entity(user_id)
                        full_name = (getattr(user, "first_name", "") or "") + \
                                    (" " + user.last_name if getattr(user, "last_name", None) else "")
                        uname = f" (@{user.username})" if getattr(user, "username", None) else ""
                        report_lines.append(f"  • {full_name.strip()}{uname}")
                    except Exception:
                        report_lines.append(f"  • User ID: {getattr(rp, 'user_id', '?')}")
                print(f"  [{send_time}] Read by: {len(readers)} people")

        except ChatAdminRequiredError:
            report_lines.append("  ⚠️ Admin rights required")
        except Exception as e:
            report_lines.append(f"  ⚠️ Cannot retrieve: {e}")
            print(f"  ❌ Error: {e}")

    # ── Send report to group ──────────────────────────────
    report_text = "\n".join(report_lines)
    try:
        await delete_old_messages_telethon(client, chat_id, GAS_URL, f"READSTATUS_{key}")
        sent = await client.send_message(
            entity,
            report_text,
            parse_mode="html"
        )
        save_msgids(GAS_URL, f"READSTATUS_{key}", [sent.id])
        print(f"  📤 Report sent to {gname}")
    except Exception as e:
        print(f"  ❌ Failed to send report: {e}")


async def main():
    print(f"🔍 Check read status — {myanmar_now()}")

    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    async with client:
        me = await client.get_me()
        print(f"🔑 Account: @{me.username} ({me.first_name})")
        print(f"📊 Checking last {CHECK_LAST_N} messages → send report to each group\n")

        for key, info in GROUPS.items():
            await check_and_report(client, key, info)
            await asyncio.sleep(1)   # avoid rate limit

    print(f"\n✅ Done — {myanmar_now()}")


if __name__ == "__main__":
    asyncio.run(main())
