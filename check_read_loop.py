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


async def build_status_text(client, entity, group_name, my_msgs, updated_at, all_members):
    """Tạo nội dung báo cáo — chỉ hiện ai CHƯA đọc."""
    lines = []
    lines.append(f"👁 <b>CHƯA ĐỌC — {group_name}</b>")
    lines.append(f"🔄 Cập nhật: <b>{updated_at}</b>")
    lines.append("━" * 26)

    # Map user_id → tên để tra nhanh
    member_map = {u.id: u for u in all_members}

    for msg in my_msgs:
        send_time = fmt_time(msg.date)
        preview   = (msg.text or "")[:50].replace("\n", " ")
        lines.append(f"\n📨 <b>[{send_time}]</b> {preview}...")

        try:
            readers = await client(GetMessageReadParticipantsRequest(
                peer   = entity,
                msg_id = msg.id
            ))
            reader_ids = {u.id for u in readers}

            # Ai chưa đọc = tất cả thành viên trừ người đã đọc
            unread = [u for uid, u in member_map.items() if uid not in reader_ids]

            if not unread:
                lines.append("  ✅ Tất cả đã đọc!")
            else:
                lines.append(f"  ❌ Chưa đọc: <b>{len(unread)}/{len(all_members)} người</b>")
                for user in unread:
                    full  = (user.first_name or "") + (" " + user.last_name if user.last_name else "")
                    uname = f" (@{user.username})" if user.username else ""
                    lines.append(f"  • {full.strip()}{uname}")

        except ChatAdminRequiredError:
            lines.append("  ⚠️ Cần quyền admin")
        except Exception as e:
            lines.append(f"  ⚠️ {str(e)[:50]}")

    return "\n".join(lines)



async def monitor_group(client, key, info, sent_msg_ids, is_first):
    """Gửi tin mới (lần đầu) hoặc edit tin cũ (các lần sau)."""
    entity      = info["_entity"]
    group_name  = info["name"]
    my_msgs     = info["_my_msgs"]
    all_members = info.get("_members", [])

    if not my_msgs:
        return

    now_str  = myanmar_now()
    text     = await build_status_text(client, entity, group_name, my_msgs, now_str, all_members)

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
                # Lấy danh sách thành viên để tính ai chưa đọc
                members = await client.get_participants(entity)
                # Bỏ qua bot và tài khoản mình
                me_id = (await client.get_me()).id
                info["_members"] = [u for u in members if not u.bot and u.id != me_id]
                print(f"  [{key}] ✅ {info['name']}: {len(info['_my_msgs'])} tin | {len(info['_members'])} thành viên")
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
