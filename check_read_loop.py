"""
check_read_loop.py
==================
Gửi 1 tin "Read Status" vào mỗi nhóm,
sau đó EDIT lại mỗi 5 phút với danh sách mới nhất.
Chạy trong DURATION_HOURS giờ rồi tự dừng.

Kích hoạt: GitHub Actions → "Check Read Status (Live)" → Run workflow
"""

import asyncio
import os
import time
from datetime import datetime, timezone, timedelta

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.messages import GetMessageReadParticipantsRequest
from telethon.errors import ChatAdminRequiredError, MessageNotModifiedError

# ── Cấu hình ──────────────────────────────────────────────────
API_ID         = int(os.environ["TELEGRAM_API_ID"])
API_HASH       = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING = os.environ["TELEGRAM_SESSION"]

MYANMAR_TZ       = timezone(timedelta(hours=6, minutes=30))
LOOP_INTERVAL    = 15 * 60         # Edit mỗi 15 phút
DURATION_HOURS   = float(os.environ.get("DURATION_HOURS", "2"))  # Chạy bao lâu
CHECK_LAST_N     = 3               # Kiểm tra N tin nhắn gần nhất

GROUPS = {
    "CONTROL": {"name": "5 TNI TECHNICA DEP CONTROL", "id": -5251698940},
    "T1":      {"name": "Team 1",                      "id": -5180992881},
    "T2":      {"name": "Team 2 (T2+T5)",              "id": -5188855349},
    "T3":      {"name": "Team 3",                      "id": -5183480727},
    "T4":      {"name": "Team 4",                      "id": -5238696719},
}
# ──────────────────────────────────────────────────────────────

def myanmar_now():
    return datetime.now(MYANMAR_TZ).strftime("%H:%M %d/%m/%Y")

def fmt_time(dt):
    if dt is None:
        return "?"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(MYANMAR_TZ).strftime("%H:%M %d/%m")


async def build_status_text(client, entity, group_name, my_msgs, updated_at):
    """Tạo nội dung báo cáo read status."""
    lines = []
    lines.append(f"👁 <b>READ STATUS — {group_name}</b>")
    lines.append(f"🔄 Cập nhật: <b>{updated_at}</b>")
    lines.append("━" * 26)

    for msg in my_msgs:
        send_time = fmt_time(msg.date)
        preview   = (msg.text or "")[:50].replace("\n", " ")
        lines.append(f"\n📨 <b>[{send_time}]</b> {preview}...")

        try:
            readers = await client(GetMessageReadParticipantsRequest(
                peer   = entity,
                msg_id = msg.id
            ))
            if not readers:
                lines.append("  ❌ Chưa có ai đọc")
            else:
                lines.append(f"  ✅ Đã đọc: <b>{len(readers)} người</b>")
                for user in readers:
                    full = (user.first_name or "") + (" " + user.last_name if user.last_name else "")
                    uname = f" (@{user.username})" if user.username else ""
                    lines.append(f"  • {full.strip()}{uname}")

        except ChatAdminRequiredError:
            lines.append("  ⚠️ Cần quyền admin")
        except Exception as e:
            lines.append(f"  ⚠️ {str(e)[:50]}")

    return "\n".join(lines)


async def monitor_group(client, key, info, sent_msg_ids, is_first):
    """Gửi tin mới (lần đầu) hoặc edit tin cũ (các lần sau)."""
    entity     = info["_entity"]
    group_name = info["name"]
    my_msgs    = info["_my_msgs"]

    if not my_msgs:
        return

    now_str  = myanmar_now()
    text     = await build_status_text(client, entity, group_name, my_msgs, now_str)

    if is_first:
        # Gửi tin mới
        try:
            sent = await client.send_message(entity, text, parse_mode="html")
            sent_msg_ids[key] = sent.id
            print(f"  [{key}] 📤 Đã gửi tin mới (id={sent.id})")
        except Exception as e:
            print(f"  [{key}] ❌ Gửi thất bại: {e}")
    else:
        # Edit tin cũ
        msg_id = sent_msg_ids.get(key)
        if not msg_id:
            return
        try:
            await client.edit_message(entity, msg_id, text, parse_mode="html")
            print(f"  [{key}] ✏️  Đã edit (id={msg_id}) lúc {now_str}")
        except MessageNotModifiedError:
            print(f"  [{key}] ⏭️  Nội dung không đổi — bỏ qua")
        except Exception as e:
            print(f"  [{key}] ❌ Edit thất bại: {e}")


async def main():
    duration_sec = DURATION_HOURS * 3600
    print(f"🚀 Read Status LIVE — {myanmar_now()}")
    print(f"⏱️  Chạy trong {DURATION_HOURS} giờ, edit mỗi {LOOP_INTERVAL//60} phút\n")

    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    async with client:
        me = await client.get_me()
        print(f"🔑 Tài khoản: @{me.username} ({me.first_name})\n")

        # ── Khởi tạo: lấy entity + tin nhắn đã gửi ───────────
        print("📥 Đang lấy dữ liệu ban đầu...")
        for key, info in GROUPS.items():
            try:
                entity = await client.get_entity(info["id"])
                info["_entity"] = entity
                msgs = await client.get_messages(entity, limit=30)
                info["_my_msgs"] = [m for m in msgs if m.out and m.text][:CHECK_LAST_N]
                print(f"  [{key}] ✅ {info['name']}: {len(info['_my_msgs'])} tin của bạn")
            except Exception as e:
                info["_entity"]  = None
                info["_my_msgs"] = []
                print(f"  [{key}] ❌ {e}")

        # ── Vòng lặp chính ────────────────────────────────────
        sent_msg_ids = {}
        start_time   = time.time()
        iteration    = 0

        while time.time() - start_time < duration_sec:
            is_first = (iteration == 0)
            elapsed  = int(time.time() - start_time)
            remain   = int(duration_sec - elapsed)

            print(f"\n{'─'*40}")
            print(f"🔄 Lần {iteration+1} — {myanmar_now()} (còn {remain//60} phút)")

            for key, info in GROUPS.items():
                if info.get("_entity") is None:
                    continue
                await monitor_group(client, key, info, sent_msg_ids, is_first)
                await asyncio.sleep(0.5)

            iteration += 1

            # Chờ đến lần tiếp theo (hoặc dừng nếu hết giờ)
            next_check = time.time() + LOOP_INTERVAL
            while time.time() < next_check:
                remaining_total = duration_sec - (time.time() - start_time)
                if remaining_total <= 0:
                    break
                await asyncio.sleep(10)

    print(f"\n✅ Kết thúc giám sát — {myanmar_now()}")


if __name__ == "__main__":
    asyncio.run(main())
