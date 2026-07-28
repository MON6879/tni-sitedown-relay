"""
# api/refuel_collector.py (redeploy trigger)
========================
Vercel webhook handler cho @TNI_FUEL bot.
Thu thập tin nhắn từ group 9 TNI REQUEST REFUEL (chat_id: -5469544739)
Phân loại:
  - Chứa "DG Type"  → REFUELED  (đổ xăng thực tế)
  - Chứa "Plan"     → PLAN      (kế hoạch đổ)
  - Chứa "request"  → REQUEST   (yêu cầu từ trạm)
Lưu vào Google Sheet qua REFUEL_PLAN_GAS_URL.

Webhook URL: https://tni-bot.vercel.app/api/refuel_collector
"""
import os, json, logging, requests
from http.server import BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REFUEL_BOT_TOKEN    = os.environ.get("REFUEL_BOT_TOKEN", "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME").strip()
REFUEL_PLAN_GAS_URL = (
    os.environ.get("REFUEL_APPS_SCRIPT_URL") or   # GitHub Actions secret name
    os.environ.get("REFUEL_PLAN_GAS_URL") or       # Vercel env var name (fallback)
    ""
).strip()

# Tự động chuyển đổi nếu URL chứa deployment cũ đã bị Google lưu trữ (archive)
if not REFUEL_PLAN_GAS_URL or "AKfycbzZmFw" in REFUEL_PLAN_GAS_URL:
    REFUEL_PLAN_GAS_URL = "https://script.google.com/macros/s/AKfycbwHyzulEMVGjslfjN_m38HzpFZHRfk2qwbQmdwb6MMqBM8xNm20JJxxzW_4zTNzp3n24Q/exec"

PLAN_GROUP_ID       = "5469544739"   # ID group 9 TNI REQUEST REFUEL (dạng số dương, không có dấu -)

TZ_MM = timezone(timedelta(hours=6, minutes=30))


def classify(text: str) -> str | None:
    """Phân loại tin nhắn theo keyword."""
    t = text.lower()
    if ("name of ft staff member" in t and "supervise" in t) or "follow monitor" in t or "follow moniter" in t:
        return "FT_MONITOR"
    if "dg type" in t:
        return "REFUELED"
    # Letter Submit: "letter" + "submit"/"submitted"
    if "letter" in t and ("submit" in t or "submitted" in t):
        return "LETTER_SUBMIT"
    # Letter Approved: "letter" + "approved"
    if "letter" in t and "approved" in t:
        return "LETTER_APPROVED"
    if "plan" in t:
        return "PLAN"
    if "request" in t:
        return "REQUEST"
    return None


def post_gas(payload: dict) -> dict:
    """POST dữ liệu lên Refuel Plan GAS."""
    if not REFUEL_PLAN_GAS_URL:
        logger.error("REFUEL_PLAN_GAS_URL not configured")
        return {"status": "error", "message": "REFUEL_PLAN_GAS_URL not set"}
    try:
        r = requests.post(REFUEL_PLAN_GAS_URL, json=payload, timeout=15)
        r.raise_for_status()
        if not r.text or not r.text.strip():
            return {"status": "error", "message": "Empty GAS response"}
        try:
            return r.json()
        except ValueError:
            return {"status": "error", "message": f"Non-JSON: {r.text[:80]}"}
    except Exception as e:
        logger.error(f"GAS POST error: {e}")
        return {"status": "error", "message": str(e)}


def tg_reply(chat_id: str, text: str):
    """Gửi tin nhắn vào group Telegram."""
    try:
        cid = str(chat_id).strip()
        if not cid.startswith("-") and cid.isdigit():
            cid = "-" + cid
        url = f"https://api.telegram.org/bot{REFUEL_BOT_TOKEN}/sendMessage"
        r = requests.post(url, json={
            "chat_id": cid,
            "text": text,
            "parse_mode": "HTML"
        }, timeout=10)
        logger.info(f"tg_reply to {cid}: status={r.status_code}, resp={r.text[:80]}")
    except Exception as e:
        logger.error(f"tg_reply error: {e}")


def answer_inline(query_id: str, query: str):
    """Phản hồi inline query bằng các template."""
    today_str = datetime.now(TZ_MM).strftime("%d/%m/%Y")
    tomorrow_str = (datetime.now(TZ_MM) + timedelta(days=1)).strftime("%d/%m/%Y")
    
    results = [
        {
            "type": "article",
            "id": "refuel",
            "title": "Báo cáo đã đổ dầu (Refueled)",
            "description": "Chèn mẫu báo cáo đã đổ dầu xong (REFUELED)",
            "input_message_content": {
                "message_text": (
                    f"DG Type\n"
                    f"Date: {today_str}\n"
                    f"DG ID: TNIXXXX\n"
                    f"Team: Team X\n"
                    f"Running Hour: \n"
                    f"KWH Hour: \n\n"
                    f"Before:\n"
                    f"CSU Reading (L): \n"
                    f"Level %: \n"
                    f"Liter/cm - ()\n\n"
                    f"After:\n"
                    f"CSU Reading (L): \n"
                    f"Level %: \n"
                    f"Liter/cm - ()\n\n"
                    f"Actual Filled Qty (L): \n"
                    f"Partner price = "
                )
            }
        },
        {
            "type": "article",
            "id": "plan",
            "title": "Kế hoạch đổ dầu (Plan)",
            "description": "Chèn mẫu kế hoạch đổ dầu (PLAN)",
            "input_message_content": {
                "message_text": (
                    f"Plan refuel\n"
                    f"Date: {tomorrow_str}\n"
                    f"Team X\n"
                    f"TNIXXXX 440L\n"
                    f"TNIXXXX 220L"
                )
            }
        },
        {
            "type": "article",
            "id": "request",
            "title": "Yêu cầu cấp dầu (Request)",
            "description": "Chèn mẫu yêu cầu cấp dầu (REQUEST)",
            "input_message_content": {
                "message_text": (
                    f"Request refuel\n"
                    f"Date: {tomorrow_str}\n"
                    f"Team X\n"
                    f"TNIXXXX: 440 L\n"
                    f"TNIXXXX: 220 L"
                )
            }
        },
        {
            "type": "article",
            "id": "letter",
            "title": "Công văn Trình/Duyệt (Letter)",
            "description": "Chèn mẫu công văn trình/duyệt",
            "input_message_content": {
                "message_text": (
                    f"Letter Submit: {today_str}\n"
                    f"Approved Letter: {today_str}"
                )
            }
        }
    ]
    
    # Lọc kết quả theo từ khóa
    q = query.lower().strip()
    if q:
        results = [r for r in results if q in r["title"].lower() or q in r["id"]]
        
    try:
        url = f"https://api.telegram.org/bot{REFUEL_BOT_TOKEN}/answerInlineQuery"
        requests.post(url, json={
            "inline_query_id": query_id,
            "results": results,
            "cache_time": 60
        }, timeout=10)
    except Exception as e:
        logger.error(f"answer_inline error: {e}")


def process_update(update: dict):
    """Xử lý 1 Telegram update."""
    # ── Xử lý Inline Query ──
    if "inline_query" in update:
        iq = update["inline_query"]
        answer_inline(iq["id"], iq.get("query", ""))
        return

    msg = update.get("message") or update.get("channel_post")
    if not msg:
        return

    chat        = msg.get("chat", {})
    raw_chat_id = chat.get("id", 0)
    chat_id     = str(abs(raw_chat_id))
    chat_title  = chat.get("title", "")
    text        = (msg.get("text") or msg.get("caption") or "").strip()

    if not text:
        return

    logger.info(f"Received msg from raw_chat_id={raw_chat_id} (title='{chat_title}'): {text[:50]}")

    if text.startswith("/id") or text.startswith("/chatid") or text.startswith("/start"):
        tg_reply(str(raw_chat_id), f"<b>Chat Title:</b> {chat_title}\n<b>Chat ID:</b> <code>{raw_chat_id}</code>")
        return

    # Chỉ xử lý tin từ group refuel chính
    if chat_id != PLAN_GROUP_ID and "cross check" not in chat_title.lower() and "9.1" not in chat_title:
        logger.info(f"Skip chat_id={chat_id}")
        return

    # Xử lý các lệnh lấy template
    if text.startswith("/"):
        cmd = text.split()[0].split("@")[0].lower()
        
        if cmd == "/refuel":
            today_str = datetime.now(TZ_MM).strftime("%d/%m/%Y")
            reply_text = (
                "📝 <b>Template: Refueled Report</b>\n"
                "<i>(Tap the code block below to copy)</i>\n\n"
                f"<pre><code>DG Type\n"
                f"Date: {today_str}\n"
                f"DG ID: TNIXXXX\n"
                f"Team: Team X\n"
                f"Running Hour: \n"
                f"KWH Hour: \n\n"
                f"Before:\n"
                f"CSU Reading (L): \n"
                f"Level %: \n"
                f"Liter/cm - ()\n\n"
                f"After:\n"
                f"CSU Reading (L): \n"
                f"Level %: \n"
                f"Liter/cm - ()\n\n"
                f"Actual Filled Qty (L): \n"
                f"Partner price = </code></pre>"
            )
            tg_reply(chat_id, reply_text)
            return
            
        elif cmd == "/plan":
            tomorrow_str = (datetime.now(TZ_MM) + timedelta(days=1)).strftime("%d/%m/%Y")
            reply_text = (
                "📝 <b>Template: Refuel Plan</b>\n"
                "<i>(Tap the code block below to copy)</i>\n\n"
                f"<pre><code>Team X Plan refuel {tomorrow_str} : TNIXXXX 440L + TNIXXXX 220L</code></pre>"
            )
            tg_reply(chat_id, reply_text)
            return
            
        elif cmd == "/request":
            tomorrow_str = (datetime.now(TZ_MM) + timedelta(days=1)).strftime("%d/%m/%Y")
            reply_text = (
                "📝 <b>Template: Refuel Request</b>\n"
                "<i>(Tap the code block below to copy)</i>\n\n"
                f"<pre><code>Team X request {tomorrow_str}: TNIXXXX: 440L + TNIXXXX: 220L</code></pre>"
            )
            tg_reply(chat_id, reply_text)
            return
            
        elif cmd == "/letter":
            today_str = datetime.now(TZ_MM).strftime("%d/%m/%Y")
            reply_text = (
                "📝 <b>Template: Transport Letter</b>\n"
                "<i>(Tap the code lines below to copy)</i>\n\n"
                "• Submit Letter:\n"
                f"<pre><code>Letter Submit: {today_str}</code></pre>\n"
                "• Approved Letter:\n"
                f"<pre><code>Approved Letter: {today_str}</code></pre>"
            )
            tg_reply(chat_id, reply_text)
            return

        elif cmd == "/monitor":
            today_str = datetime.now(TZ_MM).strftime("%d/%m/%Y")
            reply_text = (
                "📝 <b>Template: FT Follow Monitor</b>\n"
                "<i>(Tap the code block below to copy)</i>\n\n"
                f"<pre><code>Name of FT staff member accompanying to supervise the quality of premium oil and ensure the correct quantity is poured according to the plan: Paung Aung Soe - {today_str} TNI0213 + 660L, TNI0129 + 660L</code></pre>"
            )
            tg_reply(chat_id, reply_text)
            return
            
        elif cmd in ("/start", "/help"):
            reply_text = (
                "👋 <b>Welcome to TNI Refuel Bot!</b>\n\n"
                "Available template commands:\n"
                "• /refuel - Refueled Report template\n"
                "• /plan - Refuel Plan template\n"
                "• /request - Refuel Request template\n"
                "• /letter - Transport Letter template\n"
                "• /monitor - FT Follow Monitor template\n\n"
                "<i>Tap any command to receive the template, then copy and fill out.</i>"
            )
            tg_reply(chat_id, reply_text)
            return

        logger.info(f"Unknown command {cmd} — skip")
        return

    category = classify(text)
    if not category:
        logger.info("No keyword match — skip")
        return

    # Lấy tên và ID người gởi
    sender = ""
    sender_id = ""
    if msg.get("from"):
        f = msg["from"]
        sender = f"{f.get('first_name','')} {f.get('last_name','')}".strip()
        sender_id = str(f.get("id", ""))

    now    = datetime.now(TZ_MM)
    result = post_gas({
        "action":   "collect_message",
        "group_id": chat_id,
        "text":     text,
        "sender":   sender,
        "sender_id": sender_id,
        "date":     now.strftime("%d/%m/%Y %H:%M"),
    })
    logger.info(f"[{category}] sender={sender} | GAS={result.get('status')} def={result.get('def','')}")

    # Gửi reply 2 dòng xác nhận khi ghi thành công
    if result.get("status") == "ok":
        ts = result.get("time", now.strftime("%d/%m/%Y %H:%M"))

        if category == "LETTER_SUBMIT":
            reply_text = (
                f"📋 <b>Letter Submit</b> ✅ Recorded — 🪪 <code>{result.get('def', '')}</code>\n"
                f"📅 Date: <b>{result.get('date', ts)}</b>"
            )
        elif category == "LETTER_APPROVED":
            reply_text = (
                f"✅ <b>Letter Approved</b> ✅ Recorded — 🪪 <code>{result.get('def', '')}</code>\n"
                f"📅 Date: <b>{result.get('date', ts)}</b>"
            )
        else:
            def_id    = result.get("def", "")
            cat_label = {
                "PLAN":    "Plan refuel",
                "REQUEST": "Team request",
                "REFUELED":"Refueled",
                "FT_MONITOR": "FT follow monitor",
            }.get(category, category)
            reply_text = (
                f"<b>{cat_label}</b> ✅ Recorded — 🪪 <code>{def_id}</code>\n"
                f"Done 📅 {ts}"
            )
        tg_reply(chat_id, reply_text)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body   = self.rfile.read(length)
            update = json.loads(body)
            process_update(update)
        except Exception as e:
            logger.error(f"Webhook error: {e}")
        finally:
            # Luôn trả 200 để Telegram không retry
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode())

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "service": "TNI Refuel Collector"}).encode())

    def log_message(self, fmt, *args):
        logger.info(fmt % args)
