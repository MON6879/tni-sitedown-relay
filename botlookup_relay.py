"""
botlookup_relay.py
==================
Gửi lệnh /down_tni@auto_nocpro_bot vào nhóm BOT LOOKUP,
đọc phản hồi rồi:
  1. Forward toàn bộ sang nhóm CONTROL (-5251698940)
  2. Lọc theo team → gửi tin riêng cho từng nhóm T1/T2/T3/T4

Chạy tự động qua GitHub Actions mỗi 30 phút.
Chỉ hoạt động trong khung giờ 04:30 – 21:30 Myanmar (UTC+6:30).
Thêm delay ngẫu nhiên 3–8 phút để trông tự nhiên.
"""

import asyncio
import os
import random
import re
from datetime import datetime, timezone, timedelta

from telethon import TelegramClient
from telethon.tl.functions.messages import GetHistoryRequest

# ── Cấu hình ──────────────────────────────────────────────────────
API_ID         = int(os.environ["TELEGRAM_API_ID"])
API_HASH       = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING = os.environ["TELEGRAM_SESSION"]

SOURCE_GROUP   = "Botlookup"
COMMAND        = "/down_tni@auto_nocpro_bot"
TARGET_CHAT_ID = -5251698940           # 5 TNI TECHNICA DEP CONTROL SITE

# Nhóm Team để gửi tin lọc theo team
TEAMS = {
    "T1": {"id": -5180992881, "name": "Team 1 (Dawei)",       "pats": [r"\|\s*T1\s*\|"]},
    "T2": {"id": -5188855349, "name": "Team 2 (Myeik/T2+T5)", "pats": [r"\|\s*T[25]\s*\|"]},
    "T3": {"id": -5183480727, "name": "Team 3 (Bokpyin)",      "pats": [r"\|\s*T3\s*\|"]},
    "T4": {"id": -5238696719, "name": "Team 4 (Kawthoung)",    "pats": [r"\|\s*T4\s*\|"]},
}
TEAM_EMOJI = {"T1": "🔵", "T2": "🟡", "T3": "🟢", "T4": "🔴"}

BOT_USERNAME   = "auto_nocpro_bot"
WAIT_REPLY_SEC = 35

ACTIVE_START   = (4, 30)
ACTIVE_END     = (21, 30)

MIN_DELAY_SEC  = 3 * 60   # 3 phút  (tối thiểu)
MAX_DELAY_SEC  = 8 * 60   # 8 phút  (tối đa)
SKIP_DELAY     = os.environ.get("SKIP_DELAY", "0") == "1"
# ──────────────────────────────────────────────────────────────────

def myanmar_now() -> str:
    tz = timezone(timedelta(hours=6, minutes=30))
    return datetime.now(tz).strftime("%H:%M %d/%m/%Y")


def in_active_window() -> bool:
    tz  = timezone(timedelta(hours=6, minutes=30))
    now = datetime.now(tz)
    return ACTIVE_START <= (now.hour, now.minute) <= ACTIVE_END


def build_team_msg(team_key: str, raw_text: str, ts: str) -> str:
    """Lọc header + dòng summary team + các site của team từ raw_text."""
    info = TEAMS[team_key]
    pats = info["pats"]
    lines = raw_text.splitlines()

    headers = []   # dòng header/tổng (không phải dòng site số thứ tự)
    sites   = []   # dòng site thuộc team này

    for line in lines:
        s = line.strip()
        if not s:
            continue
        if re.match(r"^\d+\s*[:.]", s):
            # Dòng site: chỉ lấy nếu khớp team
            if any(re.search(p, s, re.IGNORECASE) for p in pats):
                sites.append(s)
        else:
            # Dòng header/tổng: lấy tất cả (Total, Team X:, TNI Site...)
            headers.append(s)

    emoji = TEAM_EMOJI.get(team_key, "")
    title = f"{emoji} TNI Site Down — {info['name']} — {ts}"
    sep   = "─" * 32

    if sites:
        body = "\n".join(headers) + f"\n{sep}\n" + "\n".join(sites)
    else:
        body = "\n".join(headers) + f"\n{sep}\nKhông có site down."

    return f"{title}\n{sep}\n{body}"


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


async def send_chunks(client, target, text, label):
    chunks = split_message(text, 4000)
    for chunk in chunks:
        await client.send_message(target, chunk)
        await asyncio.sleep(0.5)
    print(f"[{myanmar_now()}] ✅ Gửi {label} ({len(chunks)} phần)")


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

        ts = myanmar_now()

        # ── 9. Gửi toàn bộ sang CONTROL ──────────────────────────
        header = f"📊 Dữ liệu TNI — {ts}\n{'─'*30}\n\n"
        for text in bot_messages:
            await send_chunks(client, TARGET_CHAT_ID, header + text, "→ CONTROL")

        # ── 10. Lọc và gửi từng Team ─────────────────────────────
        print(f"[{myanmar_now()}] 📨 Phân phát theo Team...")
        raw = "\n".join(bot_messages)
        for key, info in TEAMS.items():
            try:
                team_text = build_team_msg(key, raw, ts)
                await send_chunks(client, info["id"], team_text, f"→ {key} {info['name']}")
                await asyncio.sleep(1)
            except Exception as e:
                print(f"[{myanmar_now()}] ❌ Lỗi gửi {key}: {e}")

        print(f"[{myanmar_now()}] 🎉 Hoàn thành!")


if __name__ == "__main__":
    asyncio.run(main())
