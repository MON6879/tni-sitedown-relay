"""
daily_read_report.py
====================
Run at 17:00 Myanmar — check who has read the Note message
("Team leader and Staff control Site down make plan rescue...")
in T1 / T2 / T3 / T4 / CONTROL.

For Team groups: only count team members from sheet (col E, rows 4-59).
For CONTROL: count all group participants.

Tracks read status over 3Day / 7Day / Month like Search Stats.
Sends report to each group.
"""

import asyncio
import io
import os
import re
from datetime import datetime, timezone, timedelta

import pandas as pd
import requests
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

# Map team string patterns → group key
TEAM_TO_GROUP = {
    "TEAM01": "T1", "TEAM 1": "T1", "TEAM1": "T1",
    "TEAM02": "T2", "TEAM 2": "T2", "TEAM2": "T2",
    "TEAM05": "T2", "TEAM 5": "T2", "TEAM5": "T2",  # Team 5 → Team 2
    "TEAM03": "T3", "TEAM 3": "T3", "TEAM3": "T3",
    "TEAM04": "T4", "TEAM 4": "T4", "TEAM4": "T4",
}

# Sheet config
SPREADSHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
SHEET_URL = (
    f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}"
    "/export?format=csv&gid=133591305"
)
HEADER_ROWS = 3
COL_A, COL_B, COL_C, COL_E = 0, 1, 2, 4

# Keywords to identify Note message
NOTE_KEYWORDS = ["team leader", "site down", "make plan", "rescue", "mdg", "mbb"]
# ──────────────────────────────────────────────────────────────────

def myanmar_now() -> str:
    return datetime.now(MYANMAR_TZ).strftime("%H:%M %d/%m/%Y")

def days_ago_utc(n: int) -> datetime:
    """Midnight N days ago in Myanmar time → UTC."""
    now_mm = datetime.now(MYANMAR_TZ)
    target = (now_mm - timedelta(days=n)).replace(hour=0, minute=0, second=0, microsecond=0)
    return target.astimezone(timezone.utc)

def is_note_msg(text: str) -> bool:
    """Check if message matches Note keywords."""
    t = (text or "").lower()
    return sum(1 for kw in NOTE_KEYWORDS if kw in t) >= 2


def get_team_members_from_sheet() -> dict:
    """
    Read sheet rows 4-59 (col A=team, B=name, C=role, E=chat_id).
    Returns: { group_key: [ {"name": str, "chat_id": int}, ... ] }
    """
    result = {}
    try:
        resp = requests.get(SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str, on_bad_lines="skip")

        for idx in range(HEADER_ROWS, len(df)):
            sheet_row = idx + 1
            if sheet_row < 4 or sheet_row > 59:
                continue

            row = df.iloc[idx]
            col_a = str(row.iloc[COL_A]).strip() if not pd.isna(row.iloc[COL_A]) else ""
            col_b = str(row.iloc[COL_B]).strip() if not pd.isna(row.iloc[COL_B]) else ""
            col_c = str(row.iloc[COL_C]).strip() if not pd.isna(row.iloc[COL_C]) else ""
            col_e = str(row.iloc[COL_E]).strip() if not pd.isna(row.iloc[COL_E]) else ""

            if col_a.lower() in ("nan", "none", ""):
                col_a = ""
            if col_b.lower() in ("nan", "none", ""):
                col_b = ""
            if col_e.lower() in ("nan", "none", ""):
                col_e = ""

            # Determine team group
            team_str = col_a.upper()
            # For TL rows (33-59), extract team from col_c "team leader X"
            if 33 <= sheet_row <= 59 and col_c and "team leader" in col_c.lower():
                m = re.search(r'team\s*leader\s*(\d+)', col_c, re.IGNORECASE)
                if m:
                    tl_num = m.group(1)
                    team_str = f"TEAM{tl_num.zfill(2)}"

            group_key = None
            for pattern, gk in TEAM_TO_GROUP.items():
                if pattern in team_str:
                    group_key = gk
                    break

            if not group_key or not col_b or not col_e:
                continue

            # Parse chat_id
            cid = col_e.replace(".0", "") if col_e.endswith(".0") else col_e
            if not cid.lstrip("-").isdigit():
                continue

            name = col_b
            result.setdefault(group_key, []).append({
                "name": name,
                "chat_id": int(cid),
            })

        print(f"  📋 Sheet: {sum(len(v) for v in result.values())} members across {len(result)} teams")
        for gk, members in result.items():
            print(f"     {gk}: {len(members)} members")

    except Exception as e:
        print(f"  ❌ Sheet read error: {e}")

    return result


async def get_all_members(client, chat_id: int, me_id: int) -> list[dict]:
    """Get all members in group (excluding bots and self) — for CONTROL."""
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


async def get_note_msgs_period(client, chat_id: int,
                               since_utc: datetime) -> list:
    """
    Get Note messages from ANY sender from since_utc until now.
    Returns list of (msg, date_mm) tuples.
    """
    notes = []
    try:
        history = await client(GetHistoryRequest(
            peer=chat_id, limit=200,
            offset_date=None, offset_id=0,
            max_id=0, min_id=0, add_offset=0, hash=0,
        ))
        for msg in history.messages:
            if msg.date < since_utc:
                break
            if msg.message and is_note_msg(msg.message):
                dt_mm = msg.date.astimezone(MYANMAR_TZ) if msg.date.tzinfo else msg.date.replace(tzinfo=timezone.utc).astimezone(MYANMAR_TZ)
                notes.append((msg, dt_mm))
    except Exception as e:
        print(f"    ⚠️  get_note_msgs error: {e}")
    return notes


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


async def process_group(client, group_key: str, chat_id: int,
                        me_id: int, team_sheet_members: dict):
    """Process 1 group: check Note reads over 3Day/7Day/Month."""
    print(f"\n[{group_key}] chat_id={chat_id}")

    # Get member list: sheet for teams, participants for CONTROL
    if group_key in team_sheet_members:
        sheet_list = team_sheet_members[group_key]
        members = [{"id": m["chat_id"], "name": m["name"]} for m in sheet_list]
        print(f"  📋 Using sheet members: {len(members)}")
    else:
        members = await get_all_members(client, chat_id, me_id)
        print(f"  👥 Using group participants: {len(members)}")

    member_ids = {m["id"] for m in members}
    member_count = len(members)

    if member_count == 0:
        print(f"  ⚠️  No members found — skip")
        return

    # Get Note messages from last 30 days
    since_month = days_ago_utc(30)
    note_msgs = await get_note_msgs_period(client, chat_id, since_month)

    if not note_msgs:
        print(f"  ℹ️  No Note messages found in last 30 days — skip")
        return

    print(f"  📨 Found {len(note_msgs)} Note messages in last 30 days")

    # Categorize by period
    now_mm = datetime.now(MYANMAR_TZ)
    today_start = now_mm.replace(hour=0, minute=0, second=0, microsecond=0)
    d1_start = today_start - timedelta(days=1)
    d2_start = today_start - timedelta(days=2)
    d7_start = today_start - timedelta(days=7)

    # Collect reader IDs per period
    readers_d0 = set()  # today
    readers_d1 = set()  # yesterday
    readers_d2 = set()  # day before
    readers_d7 = set()  # 7 days
    readers_month = set()  # 30 days
    today_note_msg = None

    for msg, dt_mm in note_msgs:
        rids = await get_reader_ids(client, chat_id, msg.id)
        rids = rids & member_ids  # only count team members

        readers_month |= rids

        if dt_mm >= d7_start:
            readers_d7 |= rids

        if dt_mm >= d2_start and dt_mm < d1_start:
            readers_d2 |= rids
        elif dt_mm >= d1_start and dt_mm < today_start:
            readers_d1 |= rids
        elif dt_mm >= today_start:
            readers_d0 |= rids
            if today_note_msg is None:
                today_note_msg = msg

        await asyncio.sleep(0.3)

    # Count reads per period
    cnt_d0 = len(readers_d0)
    cnt_d1 = len(readers_d1)
    cnt_d2 = len(readers_d2)
    cnt_d7 = len(readers_d7)
    cnt_month = len(readers_month)

    # Today's unread list
    today_unread = [m["name"] for m in members if m["id"] not in readers_d0]
    today_read   = [m["name"] for m in members if m["id"] in readers_d0]

    # Note preview
    note_preview = ""
    if today_note_msg:
        preview_text = (today_note_msg.message or "")[:60].replace("\n", " ")
        note_preview = f"📝 Note: {preview_text}...\n"

    # Build report
    date_str = now_mm.strftime("%d/%m/%Y")
    now_str  = myanmar_now()
    divider  = "━" * 28

    report = (
        f"👁 NOTE READ REPORT — {group_key}\n"
        f"📅 {date_str}  |  🕐 {now_str}\n"
        f"{note_preview}"
        f"{divider}\n"
        f"📊 Read Stats: 3Day: {cnt_d2}/{cnt_d1}/{cnt_d0}  "
        f"7Day: {cnt_d7}  Month: {cnt_month}\n"
        f"👥 Team Members: {member_count}\n"
        f"{divider}\n"
        f"✅ Read Today ({len(today_read)}):  "
        f"{', '.join(today_read) if today_read else 'No one yet'}\n"
        f"❌ Unread Today ({len(today_unread)}): "
        f"{', '.join(today_unread) if today_unread else 'Everyone has read ✅'}\n"
        f"{divider}"
    )

    await client.send_message(chat_id, report)
    print(f"  ✅ Report sent — Read: 3Day:{cnt_d2}/{cnt_d1}/{cnt_d0} 7Day:{cnt_d7} Month:{cnt_month}")
    print(f"     Today: {len(today_read)} read / {len(today_unread)} unread")
    await asyncio.sleep(1)


async def main():
    print(f"[{myanmar_now()}] 🚀 Daily Note Read Report starting...")

    # Read team members from sheet (col E, rows 4-59)
    print(f"[{myanmar_now()}] 📋 Reading team members from sheet...")
    team_sheet_members = get_team_members_from_sheet()

    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    async with client:
        me = await client.get_me()
        print(f"[{myanmar_now()}] 🔑 Logged in: @{me.username} ({me.first_name})")

        for group_key, chat_id in GROUPS.items():
            await process_group(client, group_key, chat_id, me.id, team_sheet_members)

    print(f"\n[{myanmar_now()}] 🎉 Complete!")


if __name__ == "__main__":
    asyncio.run(main())
