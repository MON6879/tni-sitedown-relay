"""
botlookup_relay.py
==================
Gửi lệnh /down_tni@auto_nocpro_bot vào nhóm Botlookup,
đọc phản hồi rồi forward sang nhóm CONTROL (-5251698940).

Sau 15 phút → gửi báo cáo ai đã đọc / chưa đọc vào CONTROL.

Chạy tự động qua GitHub Actions mỗi 30 phút.
Chỉ hoạt động trong khung giờ 04:30 – 21:30 Myanmar (UTC+6:30).
Thêm delay ngẫu nhiên 3–21 phút để trông tự nhiên.
"""

import asyncio
import os
import random
from datetime import datetime, timezone, timedelta

from telethon import TelegramClient
from telethon.tl.functions.messages import (
    GetHistoryRequest,
    GetMessageReadParticipantsRequest,
)

# ── Cấu hình ──────────────────────────────────────────────────────
API_ID         = int(os.environ["TELEGRAM_API_ID"])
API_HASH       = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING = os.environ["TELEGRAM_SESSION"]

SOURCE_GROUP   = "Botlookup"
COMMAND        = "/down_tni@auto_nocpro_bot"
TARGET_CHAT_ID = -5251698940                 # 5 TNI TECHNICA DEP CONTROL SITE

BOT_USERNAME   = "auto_nocpro_bot"
WAIT_REPLY_SEC = 35                          # chờ bot phản hồi
READ_WAIT_MIN  = 15                          # chờ 15 phút rồi check ai đã đọc

# Khung giờ hoạt động (Myanmar UTC+6:30)
ACTIVE_START   = (4, 30)
ACTIVE_END     = (21, 30)

MIN_DELAY_SEC  = 3  * 60
MAX_DELAY_SEC  = 21 * 60
SKIP_DELAY     = os.environ.get("SKIP_DELAY", "0") == "1"
# ──────────────────────────────────────────────────────────────────

def myanmar_now() -> str:
    tz = timezone(timedelta(hours=6, minutes=30))
    return datetime.now(tz).strftime("%H:%M %d/%m/%Y")


def in_active_window() -> bool:
    tz  = timezone(timedelta(hours=6, minutes=30))
    now = datetime.now(tz)
    return ACTIVE_START <= (now.hour, now.minute) <= ACTIVE_END


async def send_read_report(client, me_id: int, msg_id: int, sent_at: str):
    """
    Đợi READ_WAIT_MIN phút → kiểm tra ai đã đọc tin msg_id trong CONTROL
    → gửi báo cáo "Đã đọc / Chưa đọc" vào CONTROL.
    """
    print(f"[{myanmar_now()}] ⏳ Đợi {READ_WAIT_MIN} phút để check ai đã đọc...")
    await asyncio.sleep(READ_WAIT_MIN * 60)
    print(f"[{myanmar_now()}] 🔍 Đang lấy danh sách người đọc...")

    # ── Lấy danh sách người đã đọc ───────────────────────────────
    reader_ids = set()
    try:
        readers = await client(GetMessageReadParticipantsRequest(
            peer   = TARGET_CHAT_ID,
            msg_id = msg_id,
        ))
        for r in readers:
            uid = getattr(r, "user_id", None)
            if uid:
                reader_ids.add(uid)
        print(f"[{myanmar_now()}] 👁 Số người đã đọc: {len(reader_ids)}")
    except Exception as e:
        print(f"[{myanmar_now()}] ❌ Lỗi GetMessageReadParticipants: {e}")
        return

    # ── Lấy tất cả thành viên group (trừ bot và mình) ────────────
    all_members = []
    try:
        participants = await client.get_participants(TARGET_CHAT_ID)
        for p in participants:
            if getattr(p, "bot", False):
                continue
            if p.id == me_id:
                continue
            name = (getattr(p, "first_name", "") or "").strip()
            last = (getattr(p, "last_name", "") or "").strip()
            if last:
                name = f"{name} {last}".strip()
            all_members.append({"id": p.id, "name": name or str(p.id)})
        print(f"[{myanmar_now()}] 👥 Tổng thành viên (trừ bot/mình): {len(all_members)}")
    except Exception as e:
        print(f"[{myanmar_now()}] ❌ Lỗi get_participants: {e}")
        # Nếu không lấy được members, chỉ gửi danh sách đã đọc
        all_members = []

    # ── Phân loại đã đọc / chưa đọc ──────────────────────────────
    read_names   = [m["name"] for m in all_members if m["id"] in reader_ids]
    unread_names = [m["name"] for m in all_members if m["id"] not in reader_ids]

    # ── Tạo báo cáo ───────────────────────────────────────────────
    divider = "─" * 28
    if all_members:
        report = (
            f"👁 BÁO CÁO ĐÃ XEM — {myanmar_now()}\n"
            f"📨 Tin gửi lúc: {sent_at}\n"
            f"{divider}\n"
            f"✅ Đã đọc ({len(read_names)}): "
            f"{', '.join(read_names) if read_names else 'Chưa có ai'}\n"
            f"❌ Chưa đọc ({len(unread_names)}): "
            f"{', '.join(unread_names) if unread_names else 'Tất cả đã đọc ✅'}\n"
            f"{divider}"
        )
    else:
        # Fallback: chỉ có danh sách người đọc
        report = (
            f"👁 BÁO CÁO ĐÃ XEM — {myanmar_now()}\n"
            f"📨 Tin gửi lúc: {sent_at}\n"
            f"{divider}\n"
            f"✅ Đã đọc ({len(reader_ids)}): "
            f"{', '.join([str(uid) for uid in reader_ids]) if reader_ids else 'Chưa có ai'}"
        )

    await client.send_message(TARGET_CHAT_ID, report)
    print(f"[{myanmar_now()}] ✅ Đã gửi báo cáo đọc tin!")


async def main():
    tz = timezone(timedelta(hours=6, minutes=30))

    # ── 0. Kiểm tra khung giờ ────────────────────────────────────
    if not in_active_window():
        print(f"[{myanmar_now()}] 🌙 Ngoài khung giờ. Hoạt động 04:30–21:30. Kết thúc.")
        return

    # ── 1. Delay ngẫu nhiên ───────────────────────────────────────
    if SKIP_DELAY:
        print(f"[{myanmar_now()}] ⚡ TEST — bỏ qua delay!")
    else:
        delay_sec = random.randint(MIN_DELAY_SEC, MAX_DELAY_SEC)
        print(f"[{myanmar_now()}] ⏳ Delay {delay_sec//60}p {delay_sec%60}s...")
        await asyncio.sleep(delay_sec)
        print(f"[{myanmar_now()}] ✅ Hết delay!")

    # ── 2. Kết nối Telegram ───────────────────────────────────────
    from telethon.sessions import StringSession
    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    async with client:
        me = await client.get_me()
        print(f"[{myanmar_now()}] 🔑 Đăng nhập: @{me.username} ({me.first_name})")

        # ── 3. Lấy entity nhóm Botlookup ─────────────────────────
        try:
            source = await client.get_entity(SOURCE_GROUP)
            print(f"[{myanmar_now()}] 📌 Nhóm: {source.title}")
        except Exception as e:
            err = f"❌ [{myanmar_now()}] Relay lỗi: không tìm được '{SOURCE_GROUP}': {e}"
            print(err)
            await client.send_message(TARGET_CHAT_ID, err)
            return

        # ── 4. Ghi nhớ thời điểm gửi lệnh ───────────────────────
        send_time = datetime.now(timezone.utc)
        sent_str  = myanmar_now()

        # ── 5. Gửi lệnh ──────────────────────────────────────────
        print(f"[{myanmar_now()}] 📤 Gửi: {COMMAND}")
        await client.send_message(source, COMMAND)

        # ── 6. Chờ bot phản hồi ───────────────────────────────────
        print(f"[{myanmar_now()}] ⏳ Chờ {WAIT_REPLY_SEC}s...")
        await asyncio.sleep(WAIT_REPLY_SEC)

        # ── 7. Đọc lịch sử Botlookup ─────────────────────────────
        history = await client(GetHistoryRequest(
            peer=source, limit=30,
            offset_date=None, offset_id=0,
            max_id=0, min_id=0, add_offset=0, hash=0,
        ))

        # ── 8. Lọc tin từ @auto_nocpro_bot ───────────────────────
        bot_messages = []
        for msg in history.messages:
            if msg.date < send_time:
                continue
            sender = None
            if msg.sender_id:
                try:
                    sender = await client.get_entity(msg.sender_id)
                except Exception:
                    pass
            if not sender:
                continue
            uname = getattr(sender, "username", "") or ""
            if uname.lower() == BOT_USERNAME.lower() and msg.message:
                bot_messages.append(msg.message)
                print(f"[{myanmar_now()}] ✅ Tin từ @{BOT_USERNAME} ({len(msg.message)} ký tự)")

        if not bot_messages:
            err = (
                f"⚠️ [{myanmar_now()}] @{BOT_USERNAME} không phản hồi "
                f"trong {WAIT_REPLY_SEC}s"
            )
            print(err)
            await client.send_message(TARGET_CHAT_ID, err)
            return

        # ── 9. Gửi sang CONTROL, lấy msg_id tin đầu tiên ─────────
        header = f"📊 Dữ liệu TNI — {sent_str}\n{'─'*30}\n\n"
        first_msg_id = None

        for text in bot_messages:
            chunks = split_message(header + text, 4000)
            for i, chunk in enumerate(chunks):
                sent_msg = await client.send_message(TARGET_CHAT_ID, chunk)
                if first_msg_id is None:
                    first_msg_id = sent_msg.id   # lưu ID tin đầu để check read
                await asyncio.sleep(0.5)
            print(f"[{myanmar_now()}] ✅ Đã gửi sang CONTROL ({len(chunks)} phần)")

        print(f"[{myanmar_now()}] 🎉 Gửi xong! msg_id={first_msg_id}")

        # ── 10. Sau 15 phút → báo cáo ai đã đọc ─────────────────
        if first_msg_id:
            await send_read_report(client, me.id, first_msg_id, sent_str)


def split_message(text: str, max_len: int) -> list[str]:
    if len(text) <= max_len:
        return [text]
    parts = []
    while text:
        if len(text) <= max_len:
            parts.append(text)
            break
        cut = text.rfind("\n", 0, max_len)
        if cut == -1:
            cut = max_len
        parts.append(text[:cut])
        text = text[cut:].lstrip("\n")
    return parts


if __name__ == "__main__":
    asyncio.run(main())
