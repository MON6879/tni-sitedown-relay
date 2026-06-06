"""
English Collector Bot webhook (Vercel)
Receives messages with optional fields Order, Revoke, Export, Move.
User sends message like:
Order: something
Revoke: something
Export: something
Move: something
Fields can be omitted. Bot replies with a confirmation containing a row ID.
When the user replies to that confirmation with `Done: ...` the bot marks the row as done.
"""
import os, re, json, asyncio, logging, requests
from datetime import datetime, timezone, timedelta
from telegram import Bot, Update

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables (set in Vercel)
COLLECTOR_BOT_TOKEN = os.getenv("COLLECTOR_BOT_TOKEN", "")
APPS_SCRIPT_URL     = os.getenv("APPS_SCRIPT_URL", "")
# Vietnam timezone (+6:30)
TZ_VN = timezone(timedelta(hours=6, minutes=30))

# Fixed keyword list (English)
KEYWORDS = ["Order", "Revoke", "Export", "Move"]

def parse_message(text: str) -> dict:
    """Parse a message and return a dict of the found fields.
    Each field is optional. The regex looks for lines like
    `Order: <value>` (case‑insensitive) and captures the value.
    """
    result = {}
    # Build pattern that matches any of the keywords followed by ':'
    kw_pattern = "|".join(re.escape(k) for k in KEYWORDS)
    pattern = rf"({kw_pattern})\s*:\s*(.+?)(?=(?:{kw_pattern})\s*:|$)"
    for key, value in re.findall(pattern, text, flags=re.IGNORECASE | re.DOTALL):
        result[key.lower()] = value.strip()
    return result

def post_to_sheet(payload: dict) -> dict:
    """Send payload to Google Apps Script webhook.
    Expected response: {"status": "ok", "row": <row number>}
    """
    try:
        r = requests.post(APPS_SCRIPT_URL, json=payload, timeout=10)
        return r.json()
    except Exception as e:
        return {"status": "error", "message": str(e)}

async def handle_update(data: dict):
    async with Bot(token=COLLECTOR_BOT_TOKEN) as bot:
        update = Update.de_json(data, bot)
        if not update.message or not update.message.text:
            return
        msg = update.message
        user = msg.from_user
        text = msg.text.strip()
        now = datetime.now(TZ_VN)
        name = user.full_name or "Unknown"
        username = f"@{user.username}" if user.username else str(user.id)

        # `/start` command – send usage example
        if text.startswith("/start"):
            example = "\n".join([f"{k}: <value>" for k in KEYWORDS])
            await bot.send_message(
                chat_id=msg.chat_id,
                text=("👋 Hello! I am the data‑collection bot.\n\n"
                      "📌 Send me any of the following fields (you may omit any):\n" +
                      f"```\n{example}\n```\n"
                      "🔁 You can reply with `Done: <your note>` to mark a row as completed."),
                parse_mode="Markdown",
            )
            return

        # If this is a reply to a bot message and contains "Done:"
        if msg.reply_to_message and re.search(r"done\s*:", text, re.IGNORECASE):
            # Extract the row ID from the original bot message (expects #xxxxx)
            original = msg.reply_to_message.text or ""
            match = re.search(r"#(\d+)", original)
            row_id = match.group(1) if match else None
            payload = {
                "action": "done",
                "ref_id": row_id,
                "done": text,
                "done_date": now.strftime("%d/%m/%Y"),
                "done_time": now.strftime("%H:%M"),
                "chat_id": str(user.id),
            }
            result = post_to_sheet(payload)
            if result.get("status") == "ok":
                await bot.send_message(
                    chat_id=msg.chat_id,
                    text=f"✅ Row #{row_id} marked as done!\n{now.strftime('%d/%m/%Y %H:%M')}",
                )
            else:
                await bot.send_message(
                    chat_id=msg.chat_id,
                    text=f"❌ Failed to mark as done: {result.get('message','unknown error')}",
                )
            return

        # Normal data entry – parse fields
        fields = parse_message(text)
        if not fields:
            example = "\n".join([f"{k}: <value>" for k in KEYWORDS])
            await bot.send_message(
                chat_id=msg.chat_id,
                text=("❓ I couldn't find any of the expected fields.\n"
                      "Please use the format:\n" + f"```\n{example}\n```"),
                parse_mode="Markdown",
            )
            return

        payload = {
            "action": "add",
            "date": now.strftime("%d/%m/%Y"),
            "time": now.strftime("%H:%M"),
            "sender_name": name,
            "username": username,
            "chat_id": str(user.id),
            "fields": fields,
        }
        result = post_to_sheet(payload)
        if result.get("status") == "ok":
            row_id = str(result.get("row", "???")).zfill(5)
            # Build a friendly confirmation message
            lines = [f"✅ Received — 🆔 #{row_id}", f"📅 {now.strftime('%d/%m/%Y %H:%M')}"]
            icons = {"order": "📦", "revoke": "↩️", "export": "📤", "move": "🚚"}
            for k, v in fields.items():
                if v:
                    lines.append(f"{icons.get(k, '🔹')} {k.capitalize()}: {v}")
            lines.append("\n_Reply with `Done: <your note>` to mark this row as completed_")
            await bot.send_message(chat_id=msg.chat_id, text="\n".join(lines))
        else:
            await bot.send_message(
                chat_id=msg.chat_id,
                text=f"❌ Error saving data: {result.get('message','unknown')}",
            )

# ── Vercel entry point ────────────────────────────────────────
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length))
            asyncio.run(handle_update(data))
        except Exception as e:
            logger.error(f"Webhook error: {e}")
        finally:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Collector Bot EN OK")

    def log_message(self, *args):
        # silence default logging
        return
"
