"""
daily_read_report.py
====================
Run at 18:00 Myanmar — check who has read / not read
messages in T1 / T2 / T3 / T4 / CONTROL from morning until now.

Logic "read": read at least 1 message today.
Send summary report to each group.
"""

import asyncio
import os
from datetime import datetime, timezone, timedelta

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.messages import (
    GetHistoryRequest,
    GetMessageReadParticipantsRequest,
)

# ── Config ──────────────────────────────────────────────────────
API_ID         = int(os.environ["TELEGRAM_API_ID"])
API_HASH       = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING = os.environ["TELEGRAM_SESSION"]

MYANMAR_TZ = timezone(timedelta(hours=6, minutes=30))

GROUPS = {
    "T1":      -5180992881,   # TNI TEAM 1
    "T2":      -5188855349,   # TNI TEAM 2 (T2+T5)
    "T3":      -5183480727,   # TNI TEAM 3
    "T4":      -5238696719,   # TNI TEAM 4
    "CONTROL": -5251698940,   # 5 TNI TECHNICA DEP CONTROL SITE
}

# Keywords to identify Note B2:B5 messages
NOTE_KEYWORDS = ["team leader", "site down make plan", "rescue", "mdg", "mbb"]
# ──────────────────────────────────────────────────────────────────

def myanmar_now() -> str:
    return datetime.now(MYANMAR_TZ).strftime("%H:%M %d/%m/%Y")

def fmt_time(dt: datetime) -> str:
    if dt is None:
        return "?"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(MYANMAR_TZ).strftime("%H:%M")

def today_start_utc() -> datetime:
    """Midnight today in Myanmar time → UTC."""
    now_mm = datetime.now(MYANMAR_TZ)
    midnight_mm = now_mm.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight_mm.astimezone(timezone.utc)

def is_note_msg(text: str) -> bool:
    """Check if message is a Note B2:B5 message."""
    t = (text or "").lower()
    return any(kw in t for kw in NOTE_KEYWORDS)


async def get_members(client, chat_id: int, me_id: int) -> list[dict]:
    """Get all members in group (excluding bots and self)."""
    try:
        participants = await client.get_participants(chat_id)
        members = []
        for p in participants:
            if getattr(p, "bot", False) or p.id == me_id:
                continue
            name = (getattr(p, "first_name", "") or "").strip()
            last = (getattr(p, "last_name",  "") or "").strip()
            if last:
                name = f"{name} {last}".strip()
            members.append({"id": p.id, "name": name or str(p.id)})
        return members
    except Exception as e:
        print(f"    ⚠️  get_members error: {e}")
        return []


async def get_my_msgs_today(client, chat_id: int, me_id: int,
                            since_utc: datetime) -> tuple[list, list]:
    """
    Get messages sent by this account today.
    Returns: (note_msgs, other_msgs)
    """
    notes, others = [], []
    try:
        history = await client(GetHistoryRequest(
            peer=chat_id, limit=100,
            offset_date=None, offset_id=0,
            max_id=0, min_id=0, add_offset=0, hash=0,
        ))
        for msg in history.messages:
            if msg.date < since_utc:
                break
            sender_id = getattr(msg.from_id, "user_id", None)
            if sender_id == me_id and msg.message:
                if is_note_msg(msg.message):
                    notes.append(msg)
                else:
                    others.append(msg)
    except Exception as e:
        print(f"    ⚠️  get_my_msgs_today error: {e}")
    return notes, others


async def get_reader_ids(client, chat_id: int, msg_id: int) -> set:
    """Get set of user_ids who have read msg_id."""
    try:
        readers = await client(GetMessageReadParticipantsRequest(
            peer=chat_id, msg_id=msg_id,
        ))
        return {getattr(r, "user_id", 0) for r in readers}
    except Exception as e:
        print(f"    ⚠️  get_reader_ids error: {e}")
        return set()


async def process_group(client, name: str, chat_id: int,
                        me_id: int, since_utc: datetime):
    """Process 1 group: get messages, check read status, send report."""
    print(f"\n[{name}] chat_id={chat_id}")

    members, (note_msgs, other_msgs) = await asyncio.gather(
        get_members(client, chat_id, me_id),
        get_my_msgs_today(client, chat_id, me_id, since_utc),
    )

    all_msgs = note_msgs + other_msgs
    if not all_msgs:
        print(f"  ℹ️  No messages sent today — skip")
        return

    print(f"  📨 Note: {len(note_msgs)} | Other: {len(other_msgs)} | 👥 Members: {len(members)}")

    # Collect reader_ids from all messages today
    all_reader_ids: set = set()
    for msg in all_msgs:
        rids = await get_reader_ids(client, chat_id, msg.id)
        all_reader_ids |= rids
        await asyncio.sleep(0.3)

    # Classify read / unread
    read_members   = [m for m in members if m["id"] in all_reader_ids]
    unread_members = [m for m in members if m["id"] not in all_reader_ids]

    read_names   = [m["name"] for m in read_members]
    unread_names = [m["name"] for m in unread_members]

    # Preview Note B2:B5
    note_preview = ""
    if note_msgs:
        preview_text = (note_msgs[0].message or "")[:80].replace("\n", " ")
        note_preview = f"📝 Note: {preview_text}...\n"

    # Build report
    date_str = datetime.now(MYANMAR_TZ).strftime("%d/%m/%Y")
    now_str  = myanmar_now()
    divider  = "─" * 30

    report = (
        f"👁 READ REPORT — {name}\n"
        f"📅 {date_str}  |  🕐 {now_str}\n"
        f"📨 {len(all_msgs)} messages sent today\n"
        f"{note_preview}"
        f"{divider}\n"
        f"✅ Read ({len(read_names)}):  "
        f"{', '.join(read_names)  if read_names   else 'No one yet'}\n"
        f"❌ Unread ({len(unread_names)}): "
        f"{', '.join(unread_names) if unread_names else 'Everyone has read ✅'}\n"
        f"{divider}"
    )

    await client.send_message(chat_id, report)
    print(f"  ✅ Report sent ({len(read_names)} read / {len(unread_names)} unread)")
    await asyncio.sleep(1)


async def main():
    print(f"[{myanmar_now()}] 🚀 Daily Read Report starting...")
    since_utc = today_start_utc()
    print(f"[{myanmar_now()}] 📅 Checking messages from midnight Myanmar → now")

    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    async with client:
        me = await client.get_me()
        print(f"[{myanmar_now()}] 🔑 Logged in: @{me.username} ({me.first_name})")

        for group_name, chat_id in GROUPS.items():
            await process_group(client, group_name, chat_id, me.id, since_utc)

    print(f"\n[{myanmar_now()}] 🎉 Complete!")


if __name__ == "__main__":
    asyncio.run(main())
