"""
refuel_photo_collector.py
=========================
Thu thập ảnh refuel từ group 9 TNI REQUEST REFUEL (-5469544739).
- Chấp nhận File/Document (Timemark / Timecamera) — KHÔNG phải ảnh nén thường
- Tối đa 12 ảnh/ngày, mỗi sender_id chỉ được 1 ảnh trong window 30 phút
- Cùng sender_id gửi text hoặc ảnh lần 2 trong 30 phút → bỏ qua
- Đọc EXIF GPS → Lng (V), Lat (W)
- Phát hiện ảnh chỉnh sửa Photoshop → cột AA: ORIGINAL / EDITED / SUSPECT
- POST dữ liệu lên GAS action=collect_photo để ghi vào sheet Refueled

Chạy: python refuel_photo_collector.py
"""

import os
import io
import re
import time
import math
import struct
import logging
import requests
from datetime import datetime, timezone, timedelta
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("RefuelPhoto")

# ── Config ────────────────────────────────────────────────────────────────────
REFUEL_BOT_TOKEN = os.getenv("REFUEL_BOT_TOKEN", "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME")
REFUEL_CHAT_ID   = os.getenv("REFUEL_CHAT_ID", "-5469544739")   # group 9 TNI REQUEST REFUEL
REFUEL_GAS_URL   = os.getenv(
    "REFUEL_APPS_SCRIPT_URL",
    os.getenv("APPS_SCRIPT_URL", "")
)

MAX_PHOTOS_PER_DAY   = 12       # Tối đa 12 ảnh/ngày
DEDUP_WINDOW_MINUTES = 30       # Cùng sender_id: 1 ảnh/30 phút
TZ_MM = timezone(timedelta(hours=6, minutes=30))  # Myanmar UTC+6:30

# ── In-memory state ───────────────────────────────────────────────────────────
# { sender_id (str) → datetime of first photo/text received today }
_sender_last_time: dict[str, datetime] = {}
# Danh sách ảnh đã thu thập hôm nay
_photos_today: list[dict]  = []
_today_date: str = ""  # "dd/MM/yyyy"


def _reset_if_new_day():
    """Reset bộ nhớ nếu sang ngày mới."""
    global _sender_last_time, _photos_today, _today_date
    now_str = datetime.now(TZ_MM).strftime("%d/%m/%Y")
    if now_str != _today_date:
        _sender_last_time = {}
        _photos_today = []
        _today_date = now_str
        log.info(f"🌅 New day: {now_str}. State reset.")


# ── EXIF GPS parsing ──────────────────────────────────────────────────────────

def _rational_to_float(rational_bytes: bytes, offset: int) -> float:
    """Chuyển rational (numerator/denominator) EXIF → float."""
    num = struct.unpack_from("<I", rational_bytes, offset)[0]
    den = struct.unpack_from("<I", rational_bytes, offset + 4)[0]
    return num / den if den else 0.0


def _parse_exif_gps_and_software(raw_bytes: bytes) -> dict:
    """
    Phân tích EXIF từ raw JPEG bytes.
    Trả về:
      { "lat": float|None, "lng": float|None,
        "software": str, "datetime_original": str, "datetime": str }
    """
    result = {
        "lat": None, "lng": None,
        "software": "", "datetime_original": "", "datetime": ""
    }
    try:
        from PIL import Image, ExifTags
        import io as _io

        img = Image.open(_io.BytesIO(raw_bytes))
        exif_raw = img._getexif()  # type: ignore
        if not exif_raw:
            return result

        # Build tag name → value dict
        exif = {ExifTags.TAGS.get(k, k): v for k, v in exif_raw.items()}

        result["software"]          = str(exif.get("Software", ""))
        result["datetime_original"] = str(exif.get("DateTimeOriginal", ""))
        result["datetime"]          = str(exif.get("DateTime", ""))

        gps_info = exif.get("GPSInfo")
        if gps_info:
            # GPSInfo keys are numeric
            gps = {ExifTags.GPSTAGS.get(k, k): v for k, v in gps_info.items()}

            def to_deg(vals):
                d, m, s = vals
                return float(d) + float(m) / 60 + float(s) / 3600

            if "GPSLatitude" in gps and "GPSLongitude" in gps:
                lat = to_deg(gps["GPSLatitude"])
                lng = to_deg(gps["GPSLongitude"])
                if gps.get("GPSLatitudeRef") == "S":
                    lat = -lat
                if gps.get("GPSLongitudeRef") == "W":
                    lng = -lng
                result["lat"] = round(lat, 7)
                result["lng"] = round(lng, 7)

    except ImportError:
        log.warning("⚠️  Pillow not installed. Run: pip install Pillow")
    except Exception as e:
        log.debug(f"EXIF parse error: {e}")

    return result


def _detect_authenticity(exif: dict) -> str:
    """
    Kiểm tra tính xác thực của ảnh.
    - EDITED   : EXIF Software chứa 'Adobe' / 'Photoshop' / 'GIMP' / 'Lightroom'
    - SUSPECT  : Không có GPS (có thể đã strip metadata)
    - ORIGINAL : Có GPS và không có dấu hiệu chỉnh sửa
    """
    software = exif.get("software", "").lower()
    edit_keywords = ["adobe", "photoshop", "gimp", "lightroom", "snapseed",
                     "facetune", "meitu", "picsart"]
    for kw in edit_keywords:
        if kw in software:
            return "EDITED"
    if exif.get("lat") is None:
        return "SUSPECT"
    return "ORIGINAL"


# ── QI4 code extraction ───────────────────────────────────────────────────────

def _extract_qi4_from_caption(caption: str) -> str:
    """
    Lấy 3 ký tự cuối của chuỗi khớp pattern TNIXXXX_NQI4 trong caption.
    VD: 'TNI0233_1QI4' → 'QI4'
    Nếu không tìm thấy → trả về ''
    """
    m = re.search(r'TNI\d{4}_\d+([A-Z0-9]{3})$', caption.strip(), re.IGNORECASE)
    if m:
        return m.group(1).upper()
    # Fallback: tìm 3 ký tự cuối bất kỳ pattern _XYZ
    m2 = re.search(r'_([A-Z0-9]{3})(?:\s|$)', caption.strip(), re.IGNORECASE)
    if m2:
        return m2.group(1).upper()
    return ""


def _match_qi4(caption: str, dg_id_from_sheet: str, qi4_code: str) -> str:
    """
    So sánh caption ảnh với DG ID từ sheet.
    Trả về: 'MATCH' / 'NEAR' / 'NO'
    """
    if not caption:
        return "NO"
    caption_u = caption.upper().strip()
    qi4_u = qi4_code.upper() if qi4_code else "QI4"
    dg_u  = dg_id_from_sheet.upper().strip() if dg_id_from_sheet else ""

    # MATCH: caption chứa đúng pattern TNIXXXX_NQI4 và DG ID khớp
    pattern_exact = rf'{re.escape(dg_u)}_\d+{re.escape(qi4_u)}'
    if dg_u and re.search(pattern_exact, caption_u):
        return "MATCH"

    # NEAR: không đúng DG ID nhưng có QI4 ở cuối
    if qi4_u and qi4_u in caption_u:
        return "NEAR"

    return "NO"


# ── Telegram API helpers ──────────────────────────────────────────────────────

def _tg_get(method: str, params: dict) -> dict:
    url = f"https://api.telegram.org/bot{REFUEL_BOT_TOKEN}/{method}"
    try:
        r = requests.get(url, params=params, timeout=30)
        return r.json()
    except Exception as e:
        log.error(f"TG GET {method} error: {e}")
        return {}


def _tg_post_json(method: str, payload: dict) -> dict:
    url = f"https://api.telegram.org/bot{REFUEL_BOT_TOKEN}/{method}"
    try:
        r = requests.post(url, json=payload, timeout=30)
        return r.json()
    except Exception as e:
        log.error(f"TG POST {method} error: {e}")
        return {}


def _send_reply(chat_id: str, text: str, reply_to: Optional[int] = None):
    """Gửi tin nhắn phản hồi (không cần lưu message_id)."""
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_to:
        payload["reply_to_message_id"] = reply_to
    _tg_post_json("sendMessage", payload)


def _download_file(file_id: str) -> Optional[bytes]:
    """Download file từ Telegram, trả về bytes hoặc None nếu lỗi."""
    info = _tg_get("getFile", {"file_id": file_id})
    if not info.get("ok"):
        log.error(f"getFile failed: {info}")
        return None
    file_path = info["result"]["file_path"]
    url = f"https://api.telegram.org/file/bot{REFUEL_BOT_TOKEN}/{file_path}"
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        return r.content
    except Exception as e:
        log.error(f"Download error: {e}")
        return None


# ── GAS API call ──────────────────────────────────────────────────────────────

def _post_to_gas(payload: dict) -> dict:
    """Gửi dữ liệu ảnh lên Google Apps Script để ghi sheet."""
    if not REFUEL_GAS_URL:
        log.error("❌ REFUEL_APPS_SCRIPT_URL not set")
        return {}
    try:
        r = requests.post(REFUEL_GAS_URL, json=payload, timeout=60)
        return r.json()
    except Exception as e:
        log.error(f"GAS POST error: {e}")
        return {}


# ── Core photo handler ────────────────────────────────────────────────────────

def handle_document(message: dict):
    """
    Xử lý khi nhận được Document (File) từ group 9.
    Timemark/Timecamera gửi ảnh dạng Document để giữ EXIF.
    """
    _reset_if_new_day()

    chat_id   = str(message.get("chat", {}).get("id", ""))
    msg_id    = message.get("message_id")
    sender_id = str(message.get("from", {}).get("id", ""))
    sender_nm = message.get("from", {}).get("first_name", "") + \
                " " + message.get("from", {}).get("last_name", "")
    sender_nm = sender_nm.strip()
    caption   = (message.get("caption") or "").strip()
    doc       = message.get("document", {})
    mime      = doc.get("mime_type", "")
    file_id   = doc.get("file_id", "")

    # Chỉ xử lý từ group 9
    if chat_id != REFUEL_CHAT_ID:
        return

    # Chỉ xử lý JPEG/PNG (ảnh thực)
    if mime not in ("image/jpeg", "image/png", "image/jpg"):
        log.debug(f"Skip non-image document: {mime}")
        return

    now = datetime.now(TZ_MM)

    # ── Kiểm tra giới hạn 12 ảnh/ngày ──────────────────────────────────────
    if len(_photos_today) >= MAX_PHOTOS_PER_DAY:
        log.info(f"⛔ Max {MAX_PHOTOS_PER_DAY} photos reached for today. Skip.")
        _send_reply(chat_id,
            f"⛔ Maximum {MAX_PHOTOS_PER_DAY} photos already collected today.\n"
            f"📊 Total: <b>{len(_photos_today)}/{MAX_PHOTOS_PER_DAY}</b>",
            reply_to=msg_id)
        return

    # ── Kiểm tra dedup 30 phút / sender ─────────────────────────────────────
    if sender_id in _sender_last_time:
        delta = (now - _sender_last_time[sender_id]).total_seconds() / 60
        if delta < DEDUP_WINDOW_MINUTES:
            remaining = DEDUP_WINDOW_MINUTES - delta
            log.info(f"⏭ Dedup: sender {sender_id} already sent within {DEDUP_WINDOW_MINUTES} min. Skip.")
            _send_reply(chat_id,
                f"⏭ <b>{sender_nm}</b>: Photo already collected.\n"
                f"Please wait <b>{remaining:.0f} min</b> before sending again.",
                reply_to=msg_id)
            return

    # ── Ghi nhận sender_id vào window ───────────────────────────────────────
    _sender_last_time[sender_id] = now
    log.info(f"📥 Receiving photo from {sender_nm} (ID: {sender_id}), caption: '{caption}'")

    # ── Download + phân tích EXIF ────────────────────────────────────────────
    raw_bytes = _download_file(file_id)
    if not raw_bytes:
        _send_reply(chat_id, "❌ Failed to download photo. Please try again.", reply_to=msg_id)
        return

    exif      = _parse_exif_gps_and_software(raw_bytes)
    auth      = _detect_authenticity(exif)
    lat_photo = exif.get("lat")   # float or None
    lng_photo = exif.get("lng")   # float or None

    # ── Cảnh báo nếu EDITED ──────────────────────────────────────────────────
    if auth == "EDITED":
        sw = exif.get("software", "")
        log.warning(f"⚠️ EDITED photo detected! Software: {sw}")
        _send_reply(chat_id,
            f"⚠️ <b>WARNING</b>: This photo appears to have been edited!\n"
            f"🔧 Software detected: <code>{sw}</code>\n"
            f"📋 Please send the original, unedited photo from Timemark/Timecamera.",
            reply_to=msg_id)
    elif auth == "SUSPECT":
        log.warning(f"⚠️ SUSPECT photo (no GPS). sender={sender_id}")
        _send_reply(chat_id,
            "⚠️ <b>WARNING</b>: No GPS found in this photo.\n"
            "📌 Please send photo as <b>File/Document</b> from Timemark or Timecamera "
            "(do NOT send as compressed photo).",
            reply_to=msg_id)

    # ── Lấy QI4 code của ngày từ caption ────────────────────────────────────
    qi4_code = _extract_qi4_from_caption(caption)

    # ── Build payload gửi GAS ────────────────────────────────────────────────
    date_str = now.strftime("%d/%m/%Y")
    time_str = now.strftime("%H:%M")

    payload = {
        "action":      "collect_photo",
        "sender_id":   sender_id,
        "sender_name": sender_nm,
        "date":        date_str,
        "time":        time_str,
        "file_id":     file_id,
        "caption":     caption,
        "qi4_code":    qi4_code,       # 3 ký tự cuối → ghi cột T
        "lat_photo":   lat_photo,      # GPS lat → cột W
        "lng_photo":   lng_photo,      # GPS lng → cột V
        "auth":        auth,           # ORIGINAL/EDITED/SUSPECT → cột AA
        "photo_index": len(_photos_today) + 1,
    }

    # ── POST lên GAS ─────────────────────────────────────────────────────────
    result = _post_to_gas(payload)
    if result.get("status") == "ok":
        _photos_today.append(payload)
        count = len(_photos_today)
        log.info(f"✅ Photo {count}/{MAX_PHOTOS_PER_DAY} saved. DG: {result.get('dg_id','?')}")

        # Build confirmation message
        match_result = result.get("match", "—")
        dg_id        = result.get("dg_id", "—")
        row_num      = result.get("row", "—")

        lines = [
            f"✅ <b>Photo #{count}/{MAX_PHOTOS_PER_DAY} received!</b>",
            f"👤 Sender: {sender_nm}",
            f"📋 DG ID: <code>{dg_id}</code>",
            f"🔑 QI4 Code: <code>{qi4_code or '—'}</code>",
            f"🎯 Match: <b>{match_result}</b>",
        ]
        if lat_photo and lng_photo:
            lines.append(f"📍 GPS: {lat_photo:.6f}, {lng_photo:.6f}")
        else:
            lines.append("📍 GPS: <i>Not found (send as File/Document)</i>")
        lines.append(f"🔍 Auth: <b>{auth}</b>")
        lines.append(f"📊 Row: {row_num}")

        _send_reply(chat_id, "\n".join(lines), reply_to=msg_id)
    else:
        log.error(f"GAS error: {result}")
        _send_reply(chat_id,
            f"❌ Failed to save photo to sheet.\n"
            f"Error: {result.get('message', 'Unknown')}",
            reply_to=msg_id)


def handle_photo_message(message: dict):
    """
    Khi nhận ảnh nén thường (không phải File) → nhắc user gửi lại dạng Document.
    """
    chat_id = str(message.get("chat", {}).get("id", ""))
    msg_id  = message.get("message_id")
    if chat_id != REFUEL_CHAT_ID:
        return
    sender_nm = (message.get("from", {}).get("first_name", "") + " " +
                 message.get("from", {}).get("last_name", "")).strip()
    log.info(f"📷 Compressed photo from {sender_nm} — requesting resend as File")
    _send_reply(chat_id,
        f"📌 <b>{sender_nm}</b>: Please send the photo as a <b>File/Document</b>\n"
        "to preserve GPS data (Timemark or Timecamera).\n\n"
        "How: Tap 📎 → File → Select photo (instead of Gallery).",
        reply_to=msg_id)


def handle_text_in_window(message: dict):
    """
    Nếu cùng sender_id gửi text lần 2 trong 30 phút → đăng ký vào window (không skip lần đầu text).
    """
    _reset_if_new_day()
    sender_id = str(message.get("from", {}).get("id", ""))
    chat_id   = str(message.get("chat", {}).get("id", ""))
    if chat_id != REFUEL_CHAT_ID:
        return

    now = datetime.now(TZ_MM)
    if sender_id in _sender_last_time:
        delta = (now - _sender_last_time[sender_id]).total_seconds() / 60
        if delta < DEDUP_WINDOW_MINUTES:
            log.debug(f"Text from {sender_id} in window — already tracked.")
    # Không ghi nhận text vào window (chỉ ảnh mới ghi nhận)


# ── Polling loop ──────────────────────────────────────────────────────────────

def run_polling():
    """Long-polling Telegram getUpdates."""
    log.info("🚀 Refuel Photo Collector started (polling mode)")
    log.info(f"   Group: {REFUEL_CHAT_ID}")
    log.info(f"   Max photos/day: {MAX_PHOTOS_PER_DAY}")
    log.info(f"   Dedup window: {DEDUP_WINDOW_MINUTES} min")

    offset = 0
    while True:
        try:
            resp = _tg_get("getUpdates", {
                "offset": offset,
                "timeout": 30,
                "allowed_updates": ["message"]
            })
            if not resp.get("ok"):
                log.warning(f"getUpdates error: {resp}")
                time.sleep(5)
                continue

            for upd in resp.get("result", []):
                offset = upd["update_id"] + 1
                msg = upd.get("message", {})
                if not msg:
                    continue

                # Route theo loại message
                if "document" in msg:
                    handle_document(msg)
                elif "photo" in msg:
                    handle_photo_message(msg)
                elif "text" in msg:
                    handle_text_in_window(msg)

        except KeyboardInterrupt:
            log.info("⛹ Stopped by user.")
            break
        except Exception as e:
            log.error(f"Polling error: {e}")
            time.sleep(5)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not REFUEL_BOT_TOKEN:
        print("❌ REFUEL_BOT_TOKEN not set in .env")
        exit(1)
    if not REFUEL_GAS_URL:
        print("❌ REFUEL_APPS_SCRIPT_URL not set in .env")
        exit(1)
    run_polling()
