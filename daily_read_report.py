"""
daily_read_report.py
====================
Chạy lúc 21:00 Myanmar — kiểm tra ai đã đọc / chưa đọc
tin nhắn hôm nay (gửi bằng tài khoản cá nhân) trong:
  T1 / T2 / T3 / T4 / CONTROL

Gửi báo cáo riêng vào từng group.
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

# ── Cấu hình ──────────────────────────────────────────────────────
API_ID         = int(os.environ["TELEGRAM_API_ID"])
API_HASH       = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING = os.environ["TELEGRAM_SESSION"]

MYANMAR_TZ = timezone(timedelta(hours=6, minutes=30))

GROUPS = {
    "CONTROL": -5251698940,   # 5 TNI TECHNICA DEP CONTROL SITE
    "T1":      -5180992881,   # TNI TEAM 1
    "T2":      -5188855349,   # TNI TEAM 2 (T2+T5)
    "T3":      -5183480727,   # TNI TEAM 3
    "T4":      -5238696719,   # TNI TEAM 4
}
# ──────────────────────────────────────────────────────────────────

def myanmar_now() -> str:
    return datetime.now(MYANMAR_TZ).strftime("%H:%M %d/%m/%Y")

def today_start_utc() -> datetime:
    """Midnight hôm nay theo giờ Myanmar → UTC."""
    now_mm = datetime.now(MYANMAR_TZ)
    midnight_mm = now_mm.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight_mm.astimezone(timezone.utc)


async def get_members(client, chat_id: int, me_id: int) -> list[dict]:
    """Lấy tất cả thành viên trong group (trừ bot và mình)."""
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
        print(f"    ⚠️  get_members lỗi: {e}")
        return []


async def get_my_msgs_today(client, chat_id: int, me_id: int,
                            since_utc: datetime) -> list:
    """Lấy danh sách tin nhắn của mình trong group hôm nay."""
    msgs = []
    try:
        history = await client(GetHistoryRequest(
            peer=chat_id, limit=100,
            offset_date=None, offset_id=0,
            max_id=0, min_id=0, add_offset=0, hash=0,
        ))
        for msg in history.messages:
            if msg.date < since_utc:
                break                # tin cũ hơn → dừng
            sender_id = getattr(msg.from_id, "user_id", None)
            if sender_id == me_id and msg.message:
                msgs.append(msg)
    except Exception as e:
        print(f"    ⚠️  get_my_msgs_today lỗi: {e}")
    return msgs


async def get_reader_ids(client, chat_id: int, msg_id: int) -> set:
    """Lấy set user_id đã đọc tin msg_id."""
    try:
        readers = await client(GetMessageReadParticipantsRequest(
            peer=chat_id, msg_id=msg_id,
        ))
        return {getattr(r, "user_id", 0) for r in readers}
    except Exception as e:
        print(f"    ⚠️  get_reader_ids lỗi: {e}")
        return set()


async def process_group(client, name: str, chat_id: int,
                        me_id: int, since_utc: datetime):
    """Xử lý 1 group: lấy tin, kiểm tra read, gửi báo cáo."""
    print(f"\n[{name}] chat_id={chat_id}")

    # Lấy thành viên và tin nhắn hôm nay
    members, msgs = await asyncio.gather(
        get_members(client, chat_id, me_id),
        get_my_msgs_today(client, chat_id, me_id, since_utc),
    )

    if not msgs:
        print(f"  ℹ️  Không có tin nào gửi hôm nay — bỏ qua")
        return

    print(f"  📨 Tin hôm nay: {len(msgs)} | 👥 Thành viên: {len(members)}")

    # Gộp tất cả reader_ids từ mọi tin trong ngày
    all_reader_ids: set = set()
    for msg in msgs:
        rids = await get_reader_ids(client, chat_id, msg.id)
        all_reader_ids |= rids
        await asyncio.sleep(0.3)

    # Phân loại
    read_members   = [m for m in members if m["id"] in all_reader_ids]
    unread_members = [m for m in members if m["id"] not in all_reader_ids]

    read_names   = [m["name"] for m in read_members]
    unread_names = [m["name"] for m in unread_members]

    # Tạo tin báo cáo
    date_str = datetime.now(MYANMAR_TZ).strftime("%d/%m/%Y")
    divider  = "─" * 30
    report = (
        f"👁 BÁO CÁO ĐÃ XEM — {name}\n"
        f"📅 {date_str}  |  📨 {len(msgs)} tin đã gửi hôm nay\n"
        f"{divider}\n"
        f"✅ Đã đọc ({len(read_names)}):  "
        f"{', '.join(read_names)  if read_names   else 'Chưa có ai'}\n"
        f"❌ Chưa đọc ({len(unread_names)}): "
        f"{', '.join(unread_names) if unread_names else 'Tất cả đã đọc ✅'}\n"
        f"{divider}"
    )

    await client.send_message(chat_id, report)
    print(f"  ✅ Đã gửi báo cáo ({len(read_names)} đọc / {len(unread_names)} chưa)")
    await asyncio.sleep(1)


async def main():
    print(f"[{myanmar_now()}] 🚀 Daily Read Report bắt đầu...")
    since_utc = today_start_utc()
    print(f"[{myanmar_now()}] 📅 Kiểm tra tin từ: {since_utc.strftime('%H:%M %d/%m/%Y')} UTC")

    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    async with client:
        me = await client.get_me()
        print(f"[{myanmar_now()}] 🔑 Đăng nhập: @{me.username} ({me.first_name})")

        for group_name, chat_id in GROUPS.items():
            await process_group(client, group_name, chat_id, me.id, since_utc)

    print(f"\n[{myanmar_now()}] 🎉 Hoàn thành!")


if __name__ == "__main__":
    asyncio.run(main())
