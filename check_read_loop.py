"""
check_read_loop.py
==================
Kiểm tra ai đã đọc / chưa đọc tin nhắn trong T1/T2/T3/T4.
Loại trừ thành viên thuộc nhóm CONTROL (phòng ban) khỏi danh sách đếm.
Edit lại mỗi 15 phút trong DURATION_HOURS giờ.

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

MYANMAR_TZ     = timezone(timedelta(hours=6, minutes=30))
LOOP_INTERVAL  = 15 * 60          # Edit mỗi 15 phút
DURATION_HOURS = float(os.environ.get("DURATION_HOURS", "2"))
CHECK_LAST_N   = 3                # Kiểm tra N tin nhắn gần nhất

# CONTROL = phòng ban → dùng để loại trừ khỏi T1/T2/T3/T4
CONTROL_ID = -5251698940

TEAMS = {
    "T1": {"name": "Team 1",         "id": -5180992881},
    "T2": {"name": "Team 2 (T2+T5)", "id": -5188855349},
    "T3": {"name": "Team 3",         "id": -5183480727},
    "T4": {"name": "Team 4",         "id": -5238696719},
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


async def build_status_text(client, entity, team_name, my_msgs, updated_at, team_members):
    """Hiện cả ai đã đọc và ai chưa đọc (chỉ tính team members, bỏ CONTROL)."""
    lines = []
    lines.append(f"📋 <b>{team_name}</b>")
    lines.append(f"🔄 Cập nhật: <b>{updated_at}</b>")
    lines.append(f"👥 Tổng: <b>{len(team_members)} người</b> (đã bỏ phòng ban CONTROL)")
    lines.append("━" * 26)

    member_map = {u.id: u for u in team_members}

    for msg in my_msgs:
        send_time = fmt_time(msg.date)
        preview   = (msg.text or "")[:45].replace("\n", " ")
        lines.append(f"\n📨 <b>[{send_time}]</b> {preview}...")

        try:
            readers = await client(GetMessageReadParticipantsRequest(
                peer   = entity,
                msg_id = msg.id
            ))
            # ReadParticipantDate chỉ có .user_id và .date — không có first_name
            reader_ids = {u.user_id for u in readers}

            # Lọc theo team members (không tính CONTROL)
            read_members   = [u for uid, u in member_map.items() if uid in reader_ids]
            unread_members = [u for uid, u in member_map.items() if uid not in reader_ids]

            # Ai đã đọc
            if read_members:
                lines.append(f"  ✅ Đã đọc ({len(read_members)}):")
                for u in read_members:
                    full  = (u.first_name or "") + (" " + u.last_name if u.last_name else "")
                    uname = f" (@{u.username})" if u.username else ""
                    lines.append(f"    • {full.strip()}{uname}")
            else:
                lines.append("  ✅ Đã đọc: (chưa có)")

            # Ai chưa đọc
            if unread_members:
                lines.append(f"  ❌ Chưa đọc ({len(unread_members)}):")
                for u in unread_members:
                    full  = (u.first_name or "") + (" " + u.last_name if u.last_name else "")
                    uname = f" (@{u.username})" if u.username else ""
                    lines.append(f"    • {full.strip()}{uname}")
            else:
                lines.append("  ✅ Tất cả đã đọc!")

        except ChatAdminRequiredError:
            lines.append("  ⚠️ Cần quyền admin để xem")
        except Exception as e:
            lines.append(f"  ⚠️ {str(e)[:60]}")

    return "\n".join(lines)


async def monitor_team(client, key, info, sent_msg_ids, is_first):
    entity      = info["_entity"]
    team_name   = info["name"]
    my_msgs     = info["_my_msgs"]
    team_members = info.get("_members", [])

    if not my_msgs:
        return

    now_str = myanmar_now()
    text    = await build_status_text(client, entity, team_name, my_msgs, now_str, team_members)

    if is_first:
        try:
            sent = await client.send_message(entity, text, parse_mode="html")
            sent_msg_ids[key] = sent.id
            print(f"  [{key}] 📤 Gửi tin mới (id={sent.id})")
        except Exception as e:
            print(f"  [{key}] ❌ Gửi thất bại: {e}")
    else:
        msg_id = sent_msg_ids.get(key)
        if not msg_id:
            return
        try:
            await client.edit_message(entity, msg_id, text, parse_mode="html")
            print(f"  [{key}] ✏️  Đã edit lúc {now_str}")
        except MessageNotModifiedError:
            print(f"  [{key}] ⏭️  Không đổi — bỏ qua")
        except Exception as e:
            print(f"  [{key}] ❌ Edit thất bại: {e}")


async def main():
    duration_sec = DURATION_HOURS * 3600
    print(f"🚀 Read Status LIVE — {myanmar_now()}")
    print(f"⏱️  Chạy {DURATION_HOURS} giờ, edit mỗi {LOOP_INTERVAL//60} phút")
    print(f"🚫 Loại trừ thành viên CONTROL khỏi đếm T1/T2/T3/T4\n")

    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    async with client:
        me    = await client.get_me()
        me_id = me.id
        print(f"🔑 Tài khoản: @{me.username} ({me.first_name})\n")

        # ── Lấy danh sách CONTROL members (phòng ban) ─────────
        print("📥 Lấy danh sách CONTROL members (phòng ban)...")
        try:
            ctrl_entity  = await client.get_entity(CONTROL_ID)
            ctrl_members = await client.get_participants(ctrl_entity)
            ctrl_ids     = {u.id for u in ctrl_members}
            print(f"  ✅ CONTROL: {len(ctrl_ids)} người (sẽ loại khỏi đếm team)\n")
        except Exception as e:
            ctrl_ids = set()
            print(f"  ⚠️ Không lấy được CONTROL members: {e}\n")

        # ── Khởi tạo từng team ─────────────────────────────────
        print("📥 Khởi tạo teams...")
        for key, info in TEAMS.items():
            try:
                entity = await client.get_entity(info["id"])
                info["_entity"] = entity

                # Tin nhắn do mình gửi
                msgs = await client.get_messages(entity, limit=30)
                info["_my_msgs"] = [m for m in msgs if m.out and m.text][:CHECK_LAST_N]

                # Thành viên team: bỏ bot, bỏ mình, bỏ CONTROL members
                all_members = await client.get_participants(entity)
                info["_members"] = [
                    u for u in all_members
                    if not u.bot
                    and u.id != me_id
                    and u.id not in ctrl_ids   # ← loại phòng ban CONTROL
                ]
                print(f"  [{key}] ✅ {info['name']}: "
                      f"{len(info['_my_msgs'])} tin | "
                      f"{len(info['_members'])} thành viên (sau khi bỏ CONTROL)")
            except Exception as e:
                info["_entity"]  = None
                info["_my_msgs"] = []
                info["_members"] = []
                print(f"  [{key}] ❌ {e}")

        # ── Vòng lặp chính ─────────────────────────────────────
        sent_msg_ids = {}
        start_time   = time.time()
        iteration    = 0

        while time.time() - start_time < duration_sec:
            elapsed  = int(time.time() - start_time)
            remain   = int(duration_sec - elapsed)
            is_first = (iteration == 0)

            print(f"\n{'─'*40}")
            print(f"🔄 Lần {iteration+1} — {myanmar_now()} (còn {remain//60} phút)")

            for key, info in TEAMS.items():
                if info.get("_entity") is None:
                    continue
                await monitor_team(client, key, info, sent_msg_ids, is_first)
                await asyncio.sleep(0.5)

            iteration += 1

            # Chờ đến lần tiếp theo
            next_check = time.time() + LOOP_INTERVAL
            while time.time() < next_check:
                if duration_sec - (time.time() - start_time) <= 0:
                    break
                await asyncio.sleep(15)

    print(f"\n✅ Kết thúc — {myanmar_now()}")


if __name__ == "__main__":
    asyncio.run(main())
