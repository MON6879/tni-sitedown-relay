"""
botlookup_relay.py
==================
Gửi lệnh /down_tni@auto_nocpro_bot vào nhóm BOT LOOKUP,
đọc phản hồi → gọi GAS webhook ghi Cột A → checkAndSend() gửi tổng hợp.
Sau đó @Phongha79 gửi Note (B2:B5) đến tất cả groups để theo dõi ai đọc.

Chạy qua GitHub Actions (triggered bởi GAS trigger mỗi 30p).
"""

import asyncio
import os
import random
import requests
from datetime import datetime, timezone, timedelta

from telethon import TelegramClient
from telethon.tl.functions.messages import GetHistoryRequest

# ── Cấu hình ──────────────────────────────────────────────────────
API_ID         = int(os.environ["TELEGRAM_API_ID"])
API_HASH       = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING = os.environ["TELEGRAM_SESSION"]

SOURCE_GROUP   = "Botlookup"
COMMAND        = "/down_tni@auto_nocpro_bot"

# Nhóm nhận Note từ @Phongha79 (để theo dõi ai đọc)
ALL_GROUPS = {
    "CONTROL": -5251698940,
    "T1":      -5180992881,
    "T2":      -5188855349,
    "T3":      -5183480727,
    "T4":      -5238696719,
}
TARGET_CHAT_ID = ALL_GROUPS["CONTROL"]   # fallback error messages

BOT_USERNAME   = "auto_nocpro_bot"
WAIT_REPLY_SEC = 35

ACTIVE_START   = (4, 0)
ACTIVE_END     = (21, 30)

MIN_DELAY_SEC  = 3 * 60   # 3 phút
MAX_DELAY_SEC  = 8 * 60   # 8 phút
SKIP_DELAY     = os.environ.get("SKIP_DELAY", "0") == "1"
# ──────────────────────────────────────────────────────────────────

def myanmar_now() -> str:
    tz = timezone(timedelta(hours=6, minutes=30))
    return datetime.now(tz).strftime("%H:%M %d/%m/%Y")


def in_active_window() -> bool:
    tz  = timezone(timedelta(hours=6, minutes=30))
    now = datetime.now(tz)
    return ACTIVE_START <= (now.hour, now.minute) <= ACTIVE_END


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

        gas_url = os.environ.get("APPS_SCRIPT_URL", "")

        if not bot_messages:
            err = f"⚠️ [{myanmar_now()}] @{BOT_USERNAME} không phản hồi trong {WAIT_REPLY_SEC}s"
            print(err)
            await client.send_message(TARGET_CHAT_ID, err)
            # Không return sớm! Vẫn gửi Note B2:B5 bên dưới

        raw_text = "\n".join(bot_messages) if bot_messages else ""

        # ── 9. Gọi GAS webhook → ghi Cột A → checkAndSend() gửi tổng hợp ──
        # Chỉ gọi nếu có data (bot phản hồi)
        if raw_text and gas_url:
            try:
                resp = requests.post(
                    gas_url,
                    json={"action": "store_site_down", "text": raw_text},
                    timeout=120
                )
                print(f"[{myanmar_now()}] ✅ GAS webhook: {resp.status_code} — {resp.text[:200]}")
            except Exception as ex:
                print(f"[{myanmar_now()}] ⚠️ GAS webhook lỗi: {ex}")
        elif not raw_text:
            print(f"[{myanmar_now()}] ℹ️ Không có data bot — bỏ qua ghi Cột A")


        # ── 10. Đọc Note (B2:B5) từ GAS ─────────────────────────
        note_text = ""
        if gas_url:
            try:
                note_resp = requests.get(
                    gas_url,
                    params={"action": "get_note_b2b5"},
                    timeout=30
                )
                raw_note = note_resp.text.strip()
                # Guard: bỏ qua nếu GAS trả về JSON (error/status) HOẶC HTML (404/lỗi server)
                # HTML page bắt đầu bằng <!DOCTYPE hoặc <html
                is_json    = raw_note.startswith("{") or raw_note.startswith("[")
                is_html    = raw_note.lower().startswith("<!doctype") or raw_note.lower().startswith("<html")
                is_invalid = not raw_note or is_json or is_html or note_resp.status_code != 200
                if not is_invalid:
                    note_text = raw_note
                    print(f"[{myanmar_now()}] 📝 Note B2:B5: {note_text[:100]}")
                else:
                    print(f"[{myanmar_now()}] ⚠️ Note response không hợp lệ (HTML/JSON/trống/lỗi HTTP {note_resp.status_code}) — bỏ qua. GAS cần redeploy!")
            except Exception as ex:
                print(f"[{myanmar_now()}] ⚠️ Lấy Note lỗi: {ex}")


        # ── 11. @Phongha79 gửi Note đến TẤT CẢ groups — REPLY vào tin alarm ──
        # Gửi từ tài khoản cá nhân → Telegram cho phép xem ai đã đọc
        # Xóa Note cũ trước khi gửi mới → tránh loãng group
        if note_text:
            print(f"[{myanmar_now()}] ⏳ Chờ 5s để alarm kịp vào các nhóm...")
            await asyncio.sleep(5)

            # ── 11a. Đọc Note message_ids cũ từ GAS ──
            old_note_ids = {}
            if gas_url:
                try:
                    nr = requests.get(gas_url, params={"action": "get_note_msgids"}, timeout=30, allow_redirects=True)
                    print(f"[{myanmar_now()}] 📋 get_note_msgids HTTP {nr.status_code} | body={nr.text[:300]}")
                    if nr.status_code == 200:
                        nd = nr.json()
                        old_note_ids = nd.get("msgids", {})
                        if old_note_ids:
                            print(f"[{myanmar_now()}] 📋 Note cũ cần xóa: {old_note_ids}")
                        else:
                            print(f"[{myanmar_now()}] ℹ️ Không có Note cũ lưu trong GAS (lần đầu hoặc bị mất)")
                    else:
                        print(f"[{myanmar_now()}] ⚠️ get_note_msgids HTTP lỗi: {nr.status_code}")
                except Exception as ex:
                    print(f"[{myanmar_now()}] ⚠️ Đọc Note cũ lỗi: {ex}")

            # ── 11b. Xóa Note cũ + Gửi Note mới ──
            new_note_ids = {}
            deleted_count = 0
            print(f"[{myanmar_now()}] 📨 Gửi Note từ @{me.username} đến {len(ALL_GROUPS)} nhóm (reply vào alarm)...")
            for gname, gid in ALL_GROUPS.items():
                try:
                    # Xóa Note cũ trong nhóm này
                    old_id = old_note_ids.get(gname)
                    if old_id:
                        try:
                            result = await client.delete_messages(gid, [int(old_id)])
                            deleted_count += 1
                            print(f"[{myanmar_now()}] 🗑️ Xóa Note cũ msg_id={old_id} trong {gname} → OK")
                        except Exception as ex_del:
                            print(f"[{myanmar_now()}] ⚠️ Xóa Note {gname} msg_id={old_id} lỗi: {ex_del}")
                    else:
                        print(f"[{myanmar_now()}] ℹ️ {gname}: không có Note cũ để xóa")

                    # Tìm tin alarm mới nhất trong nhóm để reply vào
                    reply_to_id = None
                    try:
                        grp_hist = await client(GetHistoryRequest(
                            peer=gid, limit=15,
                            offset_date=None, offset_id=0,
                            max_id=0, min_id=0, add_offset=0, hash=0,
                        ))
                        for m in grp_hist.messages:
                            if m.message and (
                                "SITE_DOWN" in m.message.upper() or
                                "site down" in m.message.lower() or
                                "Site down" in m.message
                            ):
                                reply_to_id = m.id
                                print(f"[{myanmar_now()}] 🔗 Tìm thấy alarm msg_id={reply_to_id} trong {gname}")
                                break
                    except Exception as ex_hist:
                        print(f"[{myanmar_now()}] ⚠️ Đọc lịch sử {gname} lỗi: {ex_hist}")

                    sent_msg = await client.send_message(gid, note_text, reply_to=reply_to_id)
                    new_note_ids[gname] = sent_msg.id
                    status = f"reply→{reply_to_id}" if reply_to_id else "standalone"
                    print(f"[{myanmar_now()}] ✅ Note → {gname} ({status}) msg_id={sent_msg.id}")
                    await asyncio.sleep(1)
                except Exception as ex:
                    print(f"[{myanmar_now()}] ⚠️ Note → {gname} lỗi: {ex}")

            print(f"[{myanmar_now()}] 📊 Xóa Note cũ: {deleted_count}/{len(ALL_GROUPS)} | Gửi mới: {len(new_note_ids)}/{len(ALL_GROUPS)}")

            # ── 11c. Lưu Note message_ids mới vào GAS ──
            if new_note_ids and gas_url:
                try:
                    save_resp = requests.post(
                        gas_url,
                        json={"action": "save_note_msgids", "msgids": new_note_ids},
                        timeout=30,
                        allow_redirects=True
                    )
                    print(f"[{myanmar_now()}] 💾 save_note_msgids HTTP {save_resp.status_code} | body={save_resp.text[:200]}")
                    # Verify: đọc lại để xác nhận lưu thành công
                    try:
                        verify_resp = requests.get(gas_url, params={"action": "get_note_msgids"}, timeout=15, allow_redirects=True)
                        if verify_resp.status_code == 200:
                            vd = verify_resp.json()
                            saved = vd.get("msgids", {})
                            if saved == new_note_ids:
                                print(f"[{myanmar_now()}] ✅ Verify OK — msgids lưu đúng: {saved}")
                            else:
                                print(f"[{myanmar_now()}] ⚠️ Verify MISMATCH! Saved={saved} vs Expected={new_note_ids}")
                    except Exception as vex:
                        print(f"[{myanmar_now()}] ⚠️ Verify đọc lại lỗi: {vex}")
                except Exception as ex:
                    print(f"[{myanmar_now()}] ⚠️ Lưu Note msgids lỗi: {ex}")
        else:
            print(f"[{myanmar_now()}] ℹ️ B2:B5 trống — bỏ qua gửi Note")


        print(f"[{myanmar_now()}] ✅ Xong tất cả.")


if __name__ == "__main__":
    asyncio.run(main())
