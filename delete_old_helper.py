"""
delete_old_helper.py
====================
Shared helper for delete-old-send-new pattern.
Lưu/đọc message_ids qua GAS PropertiesService,
xóa tin cũ trước khi gửi mới.

Dùng cho: cron_send.py, daily_plan_report.py, daily_read_report.py, check_read_status.py

FIXES (25/07/2026):
  - delete_telegram_msg: phân biệt 4 trạng thái: ok / not_found / chat_not_found / error
  - delete_old_messages_bot: khi chat_not_found → clear GAS state thay vì save lại (tránh loop vô tận)
  - save_msgids: cho phép empty list để clear GAS state
  - Thêm clear_msgids() helper
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
            return [int(x) for x in raw if str(x).strip()]
    except Exception as ex:
        print(f"[delete_old] ⚠️ get_msgids({key}) lỗi: {ex}")
    return []


def save_msgids(gas_url: str, key: str, msgids: list[int]):
    """Lưu message_ids vào GAS PropertiesService.
    Truyền [] để xóa (clear) state của key.
    """
    if not gas_url or not key:
        return
    try:
        resp = requests.post(
            gas_url,
            json={"action": "save_msgids", "key": key, "msgids": msgids},
            timeout=30,
            allow_redirects=True
        )
        if resp.status_code == 200:
            if msgids:
                print(f"[delete_old] 💾 Saved {key} = {msgids}")
            else:
                print(f"[delete_old] 🗑️ Cleared {key}")
        else:
            print(f"[delete_old] ⚠️ save_msgids({key}) HTTP {resp.status_code}")
    except Exception as ex:
        print(f"[delete_old] ⚠️ save_msgids({key}) lỗi: {ex}")


def clear_msgids(gas_url: str, key: str):
    """Xóa key khỏi GAS PropertiesService (lưu list rỗng)."""
    save_msgids(gas_url, key, [])


# ── Bot API delete ──────────────────────────────────────────────

def delete_telegram_msg(bot_token: str, chat_id, message_id: int) -> str:
    """Xóa 1 tin nhắn qua Telegram Bot API.

    Returns:
        'ok'             – xóa thành công
        'not_found'      – tin nhắn đã bị xóa trước đó (coi như ok)
        'chat_not_found' – bot không có trong nhóm (KHÔNG nên retry)
        'error'          – lỗi khác
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
            return "ok"
        desc = data.get("description", "").lower()
        if "message to delete not found" in desc:
            print(f"[delete_old] 🗑️ msg_id={message_id} đã được xóa trước đó (không tìm thấy)")
            return "not_found"
        if "chat not found" in desc or "bot is not a member" in desc or "bot was kicked" in desc:
            print(f"[delete_old] ⚠️ msg_id={message_id}: {data.get('description')}")
            return "chat_not_found"
        print(f"[delete_old] ⚠️ msg_id={message_id}: {data.get('description')}")
        return "error"
    except Exception as ex:
        print(f"[delete_old] ❌ delete msg_id={message_id}: {ex}")
        return "error"


def delete_old_messages_bot(bot_token: str, chat_id, gas_url: str, key: str) -> int:
    """Xóa tất cả tin cũ của key. Dùng Bot API. Returns số tin đã xóa.

    Logic:
    - ok / not_found  → đếm là đã xóa, bỏ ra khỏi state
    - chat_not_found  → bot bị kick/không có trong nhóm → CLEAR toàn bộ state (không retry)
    - error           → giữ lại trong state để retry lần sau
    """
    old_ids = get_old_msgids(gas_url, key)
    if not old_ids:
        return 0

    count = 0
    remaining_ids = []
    chat_not_found = False

    for mid in old_ids:
        result = delete_telegram_msg(bot_token, chat_id, mid)
        if result in ("ok", "not_found"):
            count += 1
        elif result == "chat_not_found":
            chat_not_found = True
            # Không add vào remaining — bot không có trong nhóm, không retry
        else:
            remaining_ids.append(mid)

    if chat_not_found:
        # Bot bị kick hoặc không có trong nhóm → xóa state để tránh retry vô tận
        print(f"[delete_old] ⚠️ {key}: Bot không có trong chat {chat_id} → clear state")
        clear_msgids(gas_url, key)
    elif remaining_ids:
        # Còn ID chưa xóa được (lỗi tạm thời) → lưu lại để retry
        save_msgids(gas_url, key, remaining_ids)
    else:
        # Tất cả đã xóa → clear state
        clear_msgids(gas_url, key)

    print(f"[delete_old] 📊 {key}: xóa {count}/{len(old_ids)}")
    return count


# ── Telethon delete ─────────────────────────────────────────────

async def delete_old_messages_telethon(client, chat_id, gas_url: str, key: str) -> int:
    """Xóa tất cả tin cũ của key. Dùng Telethon client. Returns số tin đã xóa."""
    old_ids = get_old_msgids(gas_url, key)
    if not old_ids:
        return 0
    count = 0
    remaining_ids = []
    for mid in old_ids:
        try:
            await client.delete_messages(chat_id, [mid])
            count += 1
            print(f"[delete_old] 🗑️ msg_id={mid} → {chat_id}")
        except Exception as ex:
            err_str = str(ex).lower()
            if "not found" in err_str or "invalid" in err_str:
                count += 1
                print(f"[delete_old] 🗑️ msg_id={mid} đã được xóa trước đó (không tìm thấy)")
            else:
                remaining_ids.append(mid)
                print(f"[delete_old] ⚠️ msg_id={mid}: {ex}")

    if remaining_ids:
        save_msgids(gas_url, key, remaining_ids)
    else:
        clear_msgids(gas_url, key)
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
    Dùng Telethon để tìm TẤT CẢ tin cũ từ bot có cùng tiêu đề,
    sau đó xóa chúng qua Bot API (bot xóa tin của chính mình).
    """
    bot_id = _get_bot_user_id(bot_token)
    if not bot_id:
        return 0

    cid = int(chat_id)
    deleted = 0

    try:
        async for msg in client.iter_messages(cid, limit=search_limit):
            if msg.sender_id != bot_id:
                continue
            if not msg.text:
                continue
            first_line = msg.text.split("\n")[0].strip()
            first_line_clean = first_line.replace("**", "").replace("__", "").strip()
            if not first_line_clean.startswith(title_prefix):
                continue
            try:
                resp = requests.post(
                    f"https://api.telegram.org/bot{bot_token}/deleteMessage",
                    json={"chat_id": cid, "message_id": msg.id},
                    timeout=10,
                )
                result = resp.json()
                if result.get("ok"):
                    deleted += 1
                    print(f"[delete_title] 🗑️ Xóa msg_id={msg.id} ('{title_prefix[:35]}...')")
                else:
                    desc = result.get("description", "")
                    if "message to delete not found" in desc.lower():
                        deleted += 1
                    else:
                        print(f"[delete_title] ⚠️ msg_id={msg.id}: {desc}")
            except Exception as ex:
                print(f"[delete_title] ❌ delete msg_id={msg.id}: {ex}")
    except Exception as ex:
        print(f"[delete_title] ❌ iter_messages({cid}): {ex}")

    print(f"[delete_title] 📊 Xóa {deleted} tin '{title_prefix[:40]}' tại {cid}")
    return deleted
