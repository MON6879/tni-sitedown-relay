"""
# api/refuel_collector.py (redeploy trigger)
========================
Vercel webhook handler cho @TNI_FUEL bot.
Thu thập tin nhắn từ group 9 TNI REQUEST REFUEL (-5469544739 / 6859790680)
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
PLAN_GROUP_ID       = "6859790680"   # ID group refuel (dạng số dương)

TZ_MM = timezone(timedelta(hours=6, minutes=30))


def classify(text: str) -> str | None:
    """Phân loại tin nhắn theo keyword."""
    t = text.lower()
    if "dg type" in t:
        return "REFUELED"
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


def process_update(update: dict):
    """Xử lý 1 Telegram update."""
    msg = update.get("message") or update.get("channel_post")
    if not msg:
        return

    chat    = msg.get("chat", {})
    chat_id = str(abs(chat.get("id", 0)))   # bỏ dấu - để so sánh
    text    = (msg.get("text") or msg.get("caption") or "").strip()

    if not text:
        return

    # Chỉ xử lý tin từ group refuel
    if chat_id != PLAN_GROUP_ID:
        logger.info(f"Skip chat_id={chat_id}")
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
    logger.info(f"[{category}] sender={sender} ({sender_id}) | GAS={result.get('status')} sites={result.get('sites',0)}")


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
