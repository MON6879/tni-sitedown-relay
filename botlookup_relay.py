"""
botlookup_relay.py
==================
Gửi lệnh /down_tni@auto_nocpro_bot vào nhóm Botlookup,
đọc phản hồi rồi forward sang nhóm CONTROL (-5251698940).

Báo cáo ai đã đọc: chạy riêng lúc 21:00 Myanmar qua daily_read_report.py

Chạy tự động qua GitHub Actions mỗi 30 phút.
Chỉ hoạt động trong khung giờ 04:30 – 21:30 Myanmar (UTC+6:30).
Thêm delay ngẫu nhiên 3–21 phút để trông tự nhiên.
"""

import asyncio
import os
import random
from datetime import datetime, timezone, timedelta

from telethon import TelegramClient
from telethon.tl.functions.messages import GetHistoryRequest

# ── Cấu hình ──────────────────────────────────────────────────────
API_ID         = int(os.environ["TELEGRAM_API_ID"])
API_HASH       = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING = os.environ["TELEGRAM_SESSION"]

SOURCE_GROUP   = "Botlookup"
COMMAND        = "/down_tni@auto_nocpro_bot"
TARGET_CHAT_ID = -5251698940                 # 5 TNI TECHNICA DEP CONTROL SITE

BOT_USERNAME   = "auto_nocpro_bot"
WAIT_REPLY_SEC = 35

ACTIVE_START   = (4, 30)
ACTIVE_END     = (21, 30)

MIN_DELAY_SEC  = 3  * 60   # 3 phút  (tối thiểu)
MAX_DELAY_SEC  = 8  * 60   # 8 phút  (tối đa) — setup~4p + 8p = 12p, an toàn trong timeout 28p
SKIP_DELAY     = os.environ.get("SKIP_DELAY", "0") == "1"
# ──────────────────────────────────────────────────────────────────

def myanmar_now() -> str:
    tz = timezone(timedelta(hours=6, minutes=30))
    return datetime.now(tz).strftime("%H:%M %d/%m/%Y")


def in_active_window() -> bool:
    tz  = timezone(timedelta(hours=6, minutes=30))
    now = datetime.now(tz)
    return ACTIVE_START <= (now.hour, now.minute) <= ACTIVE_END


async def main():
    # ── 0. Kiểm tra khung giờ ────────────────────────────────────
    if not in_active_window():
        print(f"[{myanmar_now()}] 🌙 Ngoài khung giờ 04:30–21:30. Kết thúc.")
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
            err = f"⚠️ [{myanmar_now()}] @{BOT_USERNAME} không phản hồi trong {WAIT_REPLY_SEC}s"
            print(err)
            await client.send_message(TARGET_CHAT_ID, err)
            return

        # ── 9. Gửi sang CONTROL ───────────────────────────────────
        header = f"📊 Dữ liệu TNI — {myanmar_now()}\n{'─'*30}\n\n"
        for text in bot_messages:
            chunks = split_message(header + text, 4000)
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
