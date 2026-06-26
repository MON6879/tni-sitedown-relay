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
    """Xóa 1 tin nhắn qua Telegram Bot API."""
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
            print(f"[delete_old] ⚠️ msg_id={message_id}: {data.get('description', '')}")
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
    for mid in old_ids:
        if delete_telegram_msg(bot_token, chat_id, mid):
            count += 1
    print(f"[delete_old] 📊 {key}: xóa {count}/{len(old_ids)}")
    return count


# ── Telethon delete ─────────────────────────────────────────────

async def delete_old_messages_telethon(client, chat_id, gas_url: str, key: str) -> int:
    """Xóa tất cả tin cũ của key. Dùng Telethon client. Returns số tin đã xóa."""
    old_ids = get_old_msgids(gas_url, key)
    if not old_ids:
        return 0
    count = 0
    for mid in old_ids:
        try:
            await client.delete_messages(chat_id, [mid])
            count += 1
            print(f"[delete_old] 🗑️ msg_id={mid} → {chat_id}")
        except Exception as ex:
            print(f"[delete_old] ⚠️ msg_id={mid}: {ex}")
    print(f"[delete_old] 📊 {key}: xóa {count}/{len(old_ids)}")
    return count
