"""
botlookup_relay.py
==================
Gửi lệnh /down_tni@auto_nocpro_bot vào nhóm Botlookup,
đọc phản hồi rồi forward sang nhóm CONTROL (-5251698940).

Tính năng:
  - Mỗi lần gửi: kiểm tra tin trước ai đã đọc → ghi vào đầu tin mới
  - Gửi bằng tài khoản cá nhân (Telethon) để thấy read receipts

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

SOURCE_GROUP   = "Botlookup"                               # t.me/Botlookup
COMMAND        = "/down_tni@auto_nocpro_bot"
TARGET_CHAT_ID = -5251698940                               # 5 TNI TECHNICA DEP CONTROL SITE

BOT_USERNAME   = "auto_nocpro_bot"                        # bot phản hồi trong Botlookup
WAIT_REPLY_SEC = 35                                        # chờ bot phản hồi (giây)

# Khung giờ hoạt động (giờ Myanmar UTC+6:30)
ACTIVE_START   = (4, 30)    # 04:30
ACTIVE_END     = (21, 30)   # 21:30

# Delay ngẫu nhiên 3–21 phút
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
    cur = (now.hour, now.minute)
    return ACTIVE_START <= cur <= ACTIVE_END


async def get_read_status(client, me_id: int) -> str:
    """
    Tìm tin nhắn GẦN NHẤT do tài khoản cá nhân gửi vào CONTROL,
    rồi lấy danh sách người đã đọc (GetMessageReadParticipants).
    Trả về chuỗi hiển thị, ví dụ:
      '👁 Tin trước đã đọc (3): Phong, Aung, Kyaw'
    """
    try:
        history = await client(GetHistoryRequest(
            peer       = TARGET_CHAT_ID,
            limit      = 50,
            offset_date= None,
            offset_id  = 0,
            max_id     = 0,
            min_id     = 0,
            add_offset = 0,
            hash       = 0,
        ))

        # Tìm tin nhắn mới nhất do chính mình gửi
        last_msg_id = None
        for msg in history.messages:
            sender_id = getattr(msg.from_id, "user_id", None)
            if sender_id == me_id and msg.message:
                last_msg_id = msg.id
                break

        if not last_msg_id:
            return "👁 Chưa có tin trước"

        # Lấy danh sách người đã đọc
        readers = await client(GetMessageReadParticipantsRequest(
            peer   = TARGET_CHAT_ID,
            msg_id = last_msg_id,
        ))

        if not readers:
            return "👁 Tin trước: chưa có ai đọc"

        # Lấy tên từng người
        names = []
        for r in readers:
            try:
                uid = getattr(r, "user_id", None)
                if not uid or uid == me_id:
                    continue
                user = await client.get_entity(uid)
                name = user.first_name or ""
                if getattr(user, "last_name", None):
                    name += f" {user.last_name}"
                names.append(name.strip() or str(uid))
            except Exception:
                pass

        if not names:
            return "👁 Tin trước: chưa có ai đọc"

        return f"👁 Tin trước đã đọc ({len(names)}): {', '.join(names)}"

    except Exception as e:
        print(f"[read_status] ⚠️ Lỗi lấy read status: {e}")
        return "👁 Không lấy được read status"


async def main():
    tz = timezone(timedelta(hours=6, minutes=30))

    # ── 0. Kiểm tra khung giờ ────────────────────────────────────
    if not in_active_window():
        now_str = datetime.now(tz).strftime("%H:%M")
        print(f"[{myanmar_now()}] 🌙 Ngoài khung giờ ({now_str}). Hoạt động 04:30–21:30. Kết thúc.")
        return

    # ── 1. Delay ngẫu nhiên ───────────────────────────────────────
    if SKIP_DELAY:
        print(f"[{myanmar_now()}] ⚡ Chế độ TEST — bỏ qua delay!")
    else:
        delay_sec = random.randint(MIN_DELAY_SEC, MAX_DELAY_SEC)
        print(f"[{myanmar_now()}] ⏳ Đợi {delay_sec//60}p {delay_sec%60}s...")
        await asyncio.sleep(delay_sec)
        print(f"[{myanmar_now()}] ✅ Hết delay — bắt đầu!")

    # ── 2. Kết nối Telegram ───────────────────────────────────────
    from telethon.sessions import StringSession
    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    async with client:
        me = await client.get_me()
        print(f"[{myanmar_now()}] 🔑 Đăng nhập: @{me.username} ({me.first_name})")

        # ── 3. Lấy read status tin nhắn trước ────────────────────
        read_status_line = await get_read_status(client, me.id)
        print(f"[{myanmar_now()}] {read_status_line}")

        # ── 4. Lấy entity nhóm Botlookup ─────────────────────────
        try:
            source = await client.get_entity(SOURCE_GROUP)
            print(f"[{myanmar_now()}] 📌 Nhóm nguồn: {source.title}")
        except Exception as e:
            print(f"[{myanmar_now()}] ❌ Không tìm được '{SOURCE_GROUP}': {e}")
            await client.send_message(
                TARGET_CHAT_ID,
                f"❌ [{myanmar_now()}] Relay lỗi: không tìm được nhóm Botlookup\n{e}"
            )
            return

        # ── 5. Ghi nhớ thời điểm trước khi gửi lệnh ─────────────
        send_time = datetime.now(timezone.utc)

        # ── 6. Gửi lệnh vào Botlookup ────────────────────────────
        print(f"[{myanmar_now()}] 📤 Gửi: {COMMAND}")
        await client.send_message(source, COMMAND)

        # ── 7. Chờ bot phản hồi ───────────────────────────────────
        print(f"[{myanmar_now()}] ⏳ Chờ {WAIT_REPLY_SEC}s...")
        await asyncio.sleep(WAIT_REPLY_SEC)

        # ── 8. Đọc lịch sử Botlookup ─────────────────────────────
        history = await client(GetHistoryRequest(
            peer       = source,
            limit      = 30,
            offset_date= None,
            offset_id  = 0,
            max_id     = 0,
            min_id     = 0,
            add_offset = 0,
            hash       = 0,
        ))

        # ── 9. Lọc tin từ @auto_nocpro_bot sau khi gửi lệnh ──────
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
            err_msg = (
                f"⚠️ [{myanmar_now()}] Relay chạy nhưng @{BOT_USERNAME} không phản hồi "
                f"trong {WAIT_REPLY_SEC}s\n"
                f"{read_status_line}"
            )
            print(f"[{myanmar_now()}] {err_msg}")
            await client.send_message(TARGET_CHAT_ID, err_msg)
            return

        # ── 10. Gửi sang CONTROL ──────────────────────────────────
        header = (
            f"📊 Dữ liệu TNI — {myanmar_now()}\n"
            f"{read_status_line}\n"
            f"{'─'*30}\n\n"
        )

        for text in bot_messages:
            full_msg = header + text
            chunks = split_message(full_msg, 4000)
            for chunk in chunks:
                await client.send_message(TARGET_CHAT_ID, chunk)
                await asyncio.sleep(0.5)
            print(f"[{myanmar_now()}] ✅ Đã gửi sang CONTROL ({len(chunks)} phần)")

        print(f"[{myanmar_now()}] 🎉 Hoàn thành!")


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
