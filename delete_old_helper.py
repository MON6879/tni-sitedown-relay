"""
delete_old_helper.py
====================
Shared helper for delete-old-send-new pattern.
Lưu/đọc message_ids qua GAS PropertiesService,
xóa tin cũ trước khi gửi mới.

Dùng cho: cron_send.py, daily_plan_report.py, daily_read_report.py, check_read_status.py
"""

import requests


# ── GAS API helpers ─────────────────────────────────────────────

def get_old_msgids(gas_url: str, key: str) -> list[int]:
    """Đọc message_ids cũ từ GAS PropertiesService.
    Returns list of message_id (int). Rỗng nếu lỗi hoặc chưa có.
    """
    if not gas_url or not key:
        return []
    try:
        resp = requests.get(
            gas_url,
            params={"action": "get_msgids", "key": key},
            timeout=30,
            allow_redirects=True
        )
        if resp.status_code == 200:
            data = resp.json()
            raw = data.get("msgids", [])
            return [int(x) for x in raw]
    except Exception as ex:
        print(f"[delete_old] ⚠️ get_msgids({key}) lỗi: {ex}")
    return []


def save_msgids(gas_url: str, key: str, msgids: list[int]):
    """Lưu message_ids mới vào GAS PropertiesService."""
    if not gas_url or not key or not msgids:
        return
    try:
        resp = requests.post(
            gas_url,
            json={"action": "save_msgids", "key": key, "msgids": msgids},
            timeout=30,
            allow_redirects=True
        )
        if resp.status_code == 200:
            print(f"[delete_old] 💾 Saved {key} = {msgids}")
        else:
            print(f"[delete_old] ⚠️ save_msgids({key}) HTTP {resp.status_code}")
    except Exception as ex:
        print(f"[delete_old] ⚠️ save_msgids({key}) lỗi: {ex}")


# ── Bot API delete ──────────────────────────────────────────────

def delete_telegram_msg(bot_token: str, chat_id, message_id: int) -> bool:
    """Xóa 1 tin nhắn qua Telegram Bot API.
    Trả về True nếu xóa thành công hoặc tin nhắn đã bị xóa trước đó.
    """
    url = f"https://api.telegram.org/bot{bot_token}/deleteMessage"
    try:
        resp = requests.post(url, json={
            "chat_id": chat_id,
            "message_id": message_id
        }, timeout=10)
        data = resp.json()
        if data.get("ok"):
            print(f"[delete_old] 🗑️ msg_id={message_id} → {chat_id}")
            return True
        else:
            desc = data.get('description', '')
            # Nếu tin nhắn đã bị xóa trước đó, coi như thành công để gỡ khỏi bộ nhớ
            if "message to delete not found" in desc.lower():
                print(f"[delete_old] 🗑️ msg_id={message_id} đã được xóa trước đó (không tìm thấy)")
                return True
            print(f"[delete_old] ⚠️ msg_id={message_id}: {desc}")
            return False
    except Exception as ex:
        print(f"[delete_old] ❌ delete msg_id={message_id}: {ex}")
        return False


def delete_old_messages_bot(bot_token: str, chat_id, gas_url: str, key: str) -> int:
    """Xóa tất cả tin cũ của key. Dùng Bot API. Returns số tin đã xóa."""
    old_ids = get_old_msgids(gas_url, key)
    if not old_ids:
        return 0
    count = 0
    remaining_ids = []
    for mid in old_ids:
        if delete_telegram_msg(bot_token, chat_id, mid):
            count += 1
        else:
            remaining_ids.append(mid)
    
    # Cập nhật lại các ID chưa xóa được lên GAS
    save_msgids(gas_url, key, remaining_ids)
    print(f"[delete_old] 📊 {key}: xóa {count}/{len(old_ids)}")
    return count


# ── Telethon delete ─────────────────────────────────────────────

async def delete_old_messages_telethon(client, chat_id, gas_url: str, key: str) -> int:
    """Xóa tất cả tin cũ của key. Dùng Telethon client với revoke=True (xóa hẳn cho mọi người)."""
    old_ids = get_old_msgids(gas_url, key)
    if not old_ids:
        return 0
    count = 0
    remaining_ids = []
    for mid in old_ids:
        try:
            await client.delete_messages(chat_id, [mid], revoke=True)
            count += 1
            print(f"[delete_old] 🗑️ msg_id={mid} → {chat_id} (revoke=True)")
        except Exception as ex:
            err_str = str(ex).lower()
            if "not found" in err_str or "invalid" in err_str:
                count += 1
                print(f"[delete_old] 🗑️ msg_id={mid} đã được xóa trước đó")
            else:
                remaining_ids.append(mid)
                print(f"[delete_old] ⚠️ msg_id={mid}: {ex}")

    save_msgids(gas_url, key, remaining_ids)
    print(f"[delete_old] 📊 {key}: xóa {count}/{len(old_ids)}")
    return count


def _get_bot_user_id(bot_token: str) -> int:
    """Lấy user_id của bot từ token qua Bot API getMe."""
    try:
        r = requests.get(f"https://api.telegram.org/bot{bot_token}/getMe", timeout=10)
        return r.json()["result"]["id"]
    except Exception as ex:
        print(f"[delete_title] ⚠️ getMe lỗi: {ex}")
        return 0


async def delete_by_title_telethon(
    client,
    bot_token: str,
    chat_id,
    title_prefix: str,
    search_limit: int = 300,
) -> int:
    """
    Dùng Telethon tìm TẤT CẢ tin cũ cùng tiêu đề hoặc tin Note,
    sau đó xóa hẳn cho mọi người với revoke=True.
    """
    bot_id = _get_bot_user_id(bot_token)
    if not bot_id:
        return 0

    cid = int(chat_id)
    deleted = 0

    try:
        async for msg in client.iter_messages(cid, limit=search_limit):
            if not msg.text:
                continue

            # Xóa các tin Note chỉ đạo gửi từ @phongha79 (Telethon revoke=True kèm delay 0.4s tránh Spam Lock)
            if "Note: Above are the end-of-day work results" in msg.text:
                try:
                    await client.delete_messages(cid, [msg.id], revoke=True)
                    deleted += 1
                    print(f"[delete_title] 🗑️ Xóa hẳn Note msg_id={msg.id} (revoke=True)")
                    await asyncio.sleep(0.4)
                except Exception as ex:
                    print(f"[delete_title] ⚠️ Xóa Note lỗi: {ex}")
                continue

            # Lọc theo sender_id của Bot
            if msg.sender_id != bot_id:
                continue

            first_line = msg.text.split("\n")[0].strip()
            first_line_clean = first_line.replace("**", "").replace("__", "").replace("📦", "").strip()
            title_pfx_clean = title_prefix.replace("📦", "").strip()

            if not first_line_clean.startswith(title_pfx_clean):
                continue

            # Xóa tin của Bot qua Bot API trước (tránh dùng tài khoản user xóa tin Bot gây FloodWait)
            try:
                resp = requests.post(
                    f"https://api.telegram.org/bot{bot_token}/deleteMessage",
                    json={"chat_id": cid, "message_id": msg.id},
                    timeout=10,
                )
                if resp.json().get("ok"):
                    deleted += 1
                    print(f"[delete_title] 🗑️ Bot API xóa msg_id={msg.id} ('{title_prefix[:35]}...')")
                else:
                    # Fallback xóa qua Telethon nếu Bot API lỗi
                    await client.delete_messages(cid, [msg.id], revoke=True)
                    deleted += 1
                    await asyncio.sleep(0.4)
            except Exception as ex:
                print(f"[delete_title] ❌ delete msg_id={msg.id}: {ex}")
    except Exception as ex:
        print(f"[delete_title] ❌ iter_messages({cid}): {ex}")

    print(f"[delete_title] 📊 Xóa {deleted} tin '{title_prefix[:40]}' tại {cid}")
    return deleted

