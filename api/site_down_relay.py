"""
# api/site_down_relay.py
========================
Vercel webhook relay cho Bot 5 TNI_SITE_DOWN_CELL_ALARM.
Chuyển tiếp Webhook update từ Telegram đến Google Apps Script SD_APPS_SCRIPT_URL
và trả về HTTP 200 OK ngay lập tức cho Telegram để tránh lỗi 302 Found.

Webhook URL: https://tni-sitedown.vercel.app/api/site_down_relay
"""
import os, json, logging, threading, requests
from http.server import BaseHTTPRequestHandler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SD_APPS_SCRIPT_URL = os.environ.get(
    "SD_APPS_SCRIPT_URL",
    "https://script.google.com/macros/s/AKfycbxVi0BGDW7B_KBxcSEdw3yuHB9Rs2BemQEYeKDwsybJQdmQv-_0HqyGHjpZI6jupxll/exec"
).strip()

SD_BOT_TOKEN = os.environ.get("SD_BOT_TOKEN", "").strip()
WEBHOOK_URL  = "https://tni-sitedown.vercel.app/api/site_down_relay"

def ensure_webhook_locked_bg():
    """Tự động khóa lại Webhook Telegram cho Site Down Bot trong background."""
    if not SD_BOT_TOKEN:
        return
    def _do():
        try:
            requests.get(
                f"https://api.telegram.org/bot{SD_BOT_TOKEN}/setWebhook?url={WEBHOOK_URL}",
                timeout=5
            )
            logger.info(f"[SiteDown] Webhook locked → {WEBHOOK_URL}")
        except Exception as e:
            logger.error(f"[SiteDown] ensure_webhook_locked_bg error: {e}")
    threading.Thread(target=_do, daemon=True).start()

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Tự lock webhook mỗi khi bị ping
        ensure_webhook_locked_bg()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        token_ok = "SET" if SD_BOT_TOKEN else "MISSING"
        res = json.dumps({"ok": True, "status": "site_down_relay active", "SD_BOT_TOKEN": token_ok})
        self.wfile.write(res.encode("utf-8"))

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # Trả 200 OK ngay lập tức cho Telegram
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

        # Forward tới Apps Script ngầm
        try:
            update = json.loads(body.decode("utf-8"))
            msg = update.get("message") or update.get("channel_post") or {}
            chat = msg.get("chat", {})
            text = (msg.get("text") or "").strip()
            logger.info(f"[Relay] Forwarding msg from chat={chat.get('id')} title='{chat.get('title')}' len={len(text)}")
            requests.post(SD_APPS_SCRIPT_URL, json=update, timeout=15)
        except Exception as e:
            logger.error(f"[Relay] Forward error: {e}")

