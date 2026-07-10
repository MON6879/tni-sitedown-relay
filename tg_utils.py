"""
tg_utils.py
===========
Tiện ích chung cho tất cả scripts báo cáo:
- tg_send_fresh(): xóa tin cũ, gửi tin mới, lưu message_id vào GAS BotState
- tg_delete(): xóa tin theo message_id
- get_msg_id() / set_msg_id(): đọc/ghi state từ GAS
"""
import os, requests, logging

logger = logging.getLogger(__name__)

# ── Cấu hình chung ─────────────────────────────────────────────────────────

def _bot_token():
    return (
        os.environ.get("REFUEL_BOT_TOKEN") or
        os.environ.get("SEND_BOT_TOKEN") or
        "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME"
    ).strip()

def _gas_url():
    return (
        os.environ.get("REFUEL_APPS_SCRIPT_URL") or
        os.environ.get("APPS_SCRIPT_URL") or
        ""
    ).strip()

# ── GAS BotState: lưu/đọc message_id ──────────────────────────────────────

def get_msg_id(key: str) -> str:
    """Đọc message_id đã lưu từ GAS BotState sheet."""
    gas_url = _gas_url()
    if not gas_url:
        return ""
    try:
        r = requests.post(gas_url, json={"action": "get_msg_id", "key": key}, timeout=10)
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
        requests.post(gas_url, json={"action": "set_msg_id", "key": key, "msg_id": str(msg_id)}, timeout=10)
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

def tg_send_fresh(chat_id: str, text: str, state_key: str = None, parse_mode: str = "HTML") -> int:
    """
    Xóa tin cũ (nếu có) → gửi tin mới → lưu message_id mới.
    state_key: khóa để tra cứu trong BotState (vd: 'report1_-5251698940')
    Trả về message_id mới hoặc 0 nếu lỗi.
    """
    # Bước 1: lấy và xóa tin cũ
    if state_key:
        old_id = get_msg_id(state_key)
        if old_id:
            tg_delete(chat_id, old_id)
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
            # Bước 3: lưu message_id mới
            if state_key:
                set_msg_id(state_key, new_id)
            return new_id
        else:
            logger.error(f"tg_send_fresh error: {result.get('description')}")
            return 0
    except Exception as e:
        logger.error(f"tg_send_fresh exception: {e}")
        return 0
