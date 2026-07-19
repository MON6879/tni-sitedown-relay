"""
tg_utils.py
===========
Tiện ích chung cho tất cả scripts báo cáo:
- tg_send_fresh(): xóa tin cũ, gửi tin mới, lưu message_id vào GAS BotState
- tg_delete(): xóa tin theo message_id
- tg_delete_by_title(): xóa TẤT CẢ tin cũ cùng tiêu đề qua Telethon
- get_msg_id() / set_msg_id(): đọc/ghi state từ GAS
"""
import os, asyncio, requests, logging

logger = logging.getLogger(__name__)

# ── Cấu hình Telethon ──────────────────────────────────────────────────────

def _tg_api_id()   -> int: return int(os.environ.get("TELEGRAM_API_ID", "0"))
def _tg_api_hash() -> str: return os.environ.get("TELEGRAM_API_HASH", "")
def _tg_session()  -> str: return os.environ.get("TELEGRAM_SESSION", "")


# ── Cấu hình chung ─────────────────────────────────────────────────────────


def _bot_token():
    return (
        os.environ.get("REFUEL_BOT_TOKEN") or
        os.environ.get("SEND_BOT_TOKEN") or
        "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME"
    ).strip()

def _gas_url():
    return (
        os.environ.get("APPS_SCRIPT_URL") or
        os.environ.get("REFUEL_APPS_SCRIPT_URL") or
        ""
    ).strip()

# ── GAS BotState: lưu/đọc message_id ──────────────────────────────────────

def get_msg_id(key: str) -> str:
    """Đọc message_id đã lưu từ GAS BotState sheet."""
    gas_url = _gas_url()
    if not gas_url:
        return ""
    try:
        r = requests.post(gas_url, json={"action": "get_msg_id", "key": key}, timeout=25)
        return r.json().get("msg_id", "")
    except Exception as e:
        logger.warning(f"get_msg_id error: {e}")
        return ""

def set_msg_id(key: str, msg_id):
    """Lưu message_id mới vào GAS BotState sheet."""
    gas_url = _gas_url()
    if not gas_url:
        return
    try:
        requests.post(gas_url, json={"action": "set_msg_id", "key": key, "msg_id": str(msg_id)}, timeout=25)
    except Exception as e:
        logger.warning(f"set_msg_id error: {e}")

# ── Telegram helpers ───────────────────────────────────────────────────────

def tg_delete(chat_id: str, msg_id):
    """Xóa tin nhắn cũ theo message_id. Bỏ qua nếu không có."""
    if not msg_id:
        return
    try:
        token = _bot_token()
        r = requests.post(
            f"https://api.telegram.org/bot{token}/deleteMessage",
            json={"chat_id": chat_id, "message_id": int(msg_id)},
            timeout=10
        )
        if not r.json().get("ok"):
            logger.info(f"tg_delete: {r.json().get('description')} (msg_id={msg_id})")
    except Exception as e:
        logger.warning(f"tg_delete error: {e}")


def tg_delete_by_title(chat_id: str, title_prefix: str, search_limit: int = 300) -> int:
    """
    Dùng Telethon để scan lịch sử chat, tìm TẤT CẢ tin nhắn từ bot
    có cùng tiêu đề (title_prefix), xóa hết qua Bot API.
    Fallback: không làm gì nếu không có Telethon session.
    """
    api_id   = _tg_api_id()
    api_hash = _tg_api_hash()
    session  = _tg_session()
    token    = _bot_token()

    if not (api_id and api_hash and session and token):
        logger.warning("tg_delete_by_title: thiếu Telethon credentials, bỏ qua.")
        return 0

    async def _run():
        from telethon import TelegramClient
        from telethon.sessions import StringSession
        deleted = 0
        # Lấy bot user_id
        try:
            me_r = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=10)
            bot_id = me_r.json()["result"]["id"]
        except Exception as ex:
            logger.warning(f"tg_delete_by_title: getMe lỗi: {ex}")
            return 0

        async with TelegramClient(StringSession(session), api_id, api_hash) as client:
            async for msg in client.iter_messages(int(chat_id), limit=search_limit):
                # Lọc tin nhắn từ bot theo sender_id (không cần cache entity)
                if msg.sender_id != bot_id:
                    continue
                if not msg.text:
                    continue
                first_line = msg.text.split("\n")[0].strip()
                # Telethon render <b>text</b> thành **text** — cần strip trước khi so sánh
                first_line_clean = first_line.replace("**", "").replace("__", "").strip()
                if not first_line_clean.startswith(title_prefix):
                    continue
                try:
                    resp = requests.post(
                        f"https://api.telegram.org/bot{token}/deleteMessage",
                        json={"chat_id": int(chat_id), "message_id": msg.id},
                        timeout=10,
                    )
                    result = resp.json()
                    if result.get("ok") or "not found" in result.get("description", "").lower():
                        deleted += 1
                        logger.info(f"[del_title] Xóa msg_id={msg.id} ('{title_prefix[:30]}'...)")
                    else:
                        logger.warning(f"[del_title] ⚠️ msg_id={msg.id}: {result.get('description')}")
                except Exception as ex:
                    logger.warning(f"[del_title] ❌ msg_id={msg.id}: {ex}")
        return deleted

    try:
        deleted = asyncio.run(_run())
        logger.info(f"[del_title] Tổng xóa {deleted} tin '{title_prefix[:40]}' tại {chat_id}")
        return deleted
    except Exception as ex:
        logger.warning(f"tg_delete_by_title exception: {ex}")
        return 0

def tg_send_fresh(chat_id: str, text: str, state_key: str = None,
                  parse_mode: str = "HTML", title_prefix: str = "") -> int:
    """
    Xóa tin cũ → gửi tin mới → lưu message_id mới.
    Đưu tiên dùng Telethon xóa theo tiêu đề (nếu có title_prefix),
    fallback về GAS msg_id nếu không có Telethon session.
    """
    # Bước 1: xóa tin cũ
    if title_prefix:
        tg_delete_by_title(chat_id, title_prefix)  # Telethon xóa tất cả cùng tiêu đề
    elif state_key:
        old_id = get_msg_id(state_key)
        if old_id:
            tg_delete(chat_id, old_id)             # Fallback: xóa 1 tin theo GAS msg_id
            logger.info(f"Deleted old msg {old_id} for key={state_key}")

    # Bước 2: gửi tin mới
    try:
        token = _bot_token()
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
            timeout=20
        )
        result = r.json()
        if result.get("ok"):
            new_id = result["result"]["message_id"]
            logger.info(f"Sent new msg {new_id} to {chat_id}")
            if state_key:
                set_msg_id(state_key, new_id)      # Vẫn lưu để fallback
            return new_id
        else:
            logger.error(f"tg_send_fresh error: {result.get('description')}")
            return 0
    except Exception as e:
        logger.error(f"tg_send_fresh exception: {e}")
        return 0
