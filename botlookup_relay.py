"""
botlookup_relay.py
==================
Gửi lệnh /down_tni@auto_nocpro_bot vào nhóm Botlookup,
đọc phản hồi rồi forward sang nhóm CONTROL (-5251698940).

Chạy tự động qua GitHub Actions mỗi 30 phút.
Chỉ hoạt động trong khung giờ 04:30 – 21:30 Myanmar (UTC+6:30).
Thêm delay ngẫu nhiên 3–21 phút để trông tự nhiên.
"""

import asyncio
import os
import random
import time
from datetime import datetime, timezone, timedelta

from telethon import TelegramClient
from telethon.tl.functions.messages import GetHistoryRequest

# ── Cấu hình ──────────────────────────────────────────────────────
API_ID         = int(os.environ["TELEGRAM_API_ID"])        # 38060453
API_HASH       = os.environ["TELEGRAM_API_HASH"]           # 49dbb07f...
SESSION_STRING = os.environ["TELEGRAM_SESSION"]            # chuỗi session

SOURCE_GROUP   = "Botlookup"                               # t.me/Botlookup
COMMAND        = "/down_tni@auto_nocpro_bot"
TARGET_CHAT_ID = -5251698940                               # 5 TNI TECHNICA DEP CONTROL SITE

BOT_USERNAME   = "auto_nocpro_bot"                        # bot phản hồi trong Botlookup
WAIT_REPLY_SEC = 20                                        # chờ bot phản hồi (giây)

# Khung giờ hoạt động (giờ Myanmar UTC+6:30)
ACTIVE_START   = (4, 30)    # 04:30
ACTIVE_END     = (21, 30)   # 21:30

# Delay ngẫu nhiên 3–21 phút (tính bằng giây)
# Đặt env SKIP_DELAY=1 để bỏ qua delay (dùng khi test)
MIN_DELAY_SEC  = 3  * 60    #  3 phút
MAX_DELAY_SEC  = 21 * 60    # 21 phút
SKIP_DELAY     = os.environ.get("SKIP_DELAY", "0") == "1"
# ──────────────────────────────────────────────────────────────────

def myanmar_now() -> str:
    """Giờ hiện tại theo múi giờ Myanmar (UTC+6:30)."""
    tz = timezone(timedelta(hours=6, minutes=30))
    return datetime.now(tz).strftime("%H:%M:%S %d/%m/%Y")


def in_active_window() -> bool:
    """Kiểm tra giờ Myanmar hiện tại có trong 04:30–21:30 không."""
    tz  = timezone(timedelta(hours=6, minutes=30))
    now = datetime.now(tz)
    cur = (now.hour, now.minute)
    return ACTIVE_START <= cur <= ACTIVE_END


async def main():
    tz = timezone(timedelta(hours=6, minutes=30))

    # ── 0. Kiểm tra khung giờ hoạt động ──────────────────────────
    if not in_active_window():
        now_str = datetime.now(tz).strftime("%H:%M")
        print(f"[{myanmar_now()}] 🌙 Ngoài khung giờ ({now_str} Myanmar). Hoạt động 04:30–21:30. Kết thúc.")
        return

    # ── 1. Delay ngẫu nhiên 3–21 phút ────────────────────────────
    if SKIP_DELAY:
        print(f"[{myanmar_now()}] ⚡ Chế độ TEST — bỏ qua delay!")
    else:
        delay_sec = random.randint(MIN_DELAY_SEC, MAX_DELAY_SEC)
        delay_min = delay_sec // 60
        delay_rem = delay_sec % 60
        print(f"[{myanmar_now()}] ⏳ Đợi ngẫu nhiên {delay_min} phút {delay_rem} giây trước khi gửi...")
        await asyncio.sleep(delay_sec)
        print(f"[{myanmar_now()}] ✅ Hết delay — bắt đầu relay!")

    # ── 2. Kết nối Telegram bằng tài khoản cá nhân ───────────────
    from telethon.sessions import StringSession
    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    async with client:
        me = await client.get_me()
        print(f"[{myanmar_now()}] 🔑 Đăng nhập: @{me.username} ({me.first_name})")

        # ── 3. Lấy entity của nhóm Botlookup ─────────────────────
        try:
            source = await client.get_entity(SOURCE_GROUP)
            print(f"[{myanmar_now()}] 📌 Nhóm nguồn: {source.title} (id={source.id})")
        except Exception as e:
            print(f"[{myanmar_now()}] ❌ Không tìm được nhóm '{SOURCE_GROUP}': {e}")
            return

        # ── 4. Ghi nhớ thời điểm TRƯỚC KHI gửi lệnh ─────────────
        send_time = datetime.now(timezone.utc)

        # ── 5. Gửi lệnh vào nhóm Botlookup ──────────────────────
        print(f"[{myanmar_now()}] 📤 Gửi lệnh: {COMMAND}")
        await client.send_message(source, COMMAND)

        # ── 6. Chờ bot phản hồi ───────────────────────────────────
        print(f"[{myanmar_now()}] ⏳ Chờ {WAIT_REPLY_SEC}s bot phản hồi...")
        await asyncio.sleep(WAIT_REPLY_SEC)

        # ── 7. Đọc lịch sử nhóm Botlookup sau khi gửi lệnh ──────
        history = await client(GetHistoryRequest(
            peer       = source,
            limit      = 30,           # lấy 30 tin nhắn gần nhất
            offset_date= None,
            offset_id  = 0,
            max_id     = 0,
            min_id     = 0,
            add_offset = 0,
            hash       = 0,
        ))

        # ── 8. Lọc tin nhắn từ @auto_nocpro_bot sau thời điểm gửi lệnh ──
        bot_messages = []
        for msg in history.messages:
            # Chỉ lấy tin nhắn SAU khi ta gửi lệnh
            if msg.date < send_time:
                continue
            sender = await client.get_entity(msg.sender_id) if msg.sender_id else None
            if not sender:
                continue
            uname = getattr(sender, "username", "") or ""
            if uname.lower() == BOT_USERNAME.lower() and msg.message:
                bot_messages.append(msg.message)
                print(f"[{myanmar_now()}] ✅ Tìm thấy tin nhắn từ @{BOT_USERNAME} ({len(msg.message)} ký tự)")

        if not bot_messages:
            print(f"[{myanmar_now()}] ⚠️  Không tìm thấy phản hồi từ @{BOT_USERNAME}. Kết thúc.")
            return

        # ── 9. Gửi sang nhóm CONTROL ─────────────────────────────
        header = f"📊 Dữ liệu TNI — {myanmar_now()}\n\n"

        for text in bot_messages:
            full_msg = header + text
            # Chia nhỏ nếu > 4000 ký tự
            chunks = split_message(full_msg, 4000)
            for chunk in chunks:
                await client.send_message(TARGET_CHAT_ID, chunk)
                await asyncio.sleep(0.5)
            print(f"[{myanmar_now()}] ✅ Đã gửi sang CONTROL ({len(chunks)} phần)!")

        print(f"[{myanmar_now()}] 🎉 Hoàn thành!")


def split_message(text: str, max_len: int) -> list[str]:
    """Chia tin nhắn dài thành nhiều phần."""
    if len(text) <= max_len:
        return [text]
    parts = []
    while text:
        if len(text) <= max_len:
            parts.append(text)
            break
        # Ưu tiên cắt theo dòng
        cut = text.rfind("\n", 0, max_len)
        if cut == -1:
            cut = max_len
        parts.append(text[:cut])
        text = text[cut:].lstrip("\n")
    return parts


if __name__ == "__main__":
    asyncio.run(main())
