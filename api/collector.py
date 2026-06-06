"""
Vercel webhook handler for Collector Bot (TNIAsset_BO).
Receives Order/Revoke/Export/Move commands → writes to Google Sheet.
Webhook URL: https://<your-app>.vercel.app/api/collector
"""
import os, re, json, asyncio, logging, requests, html
from http.server import BaseHTTPRequestHandler
from telegram import Bot, Update
from datetime import datetime, timezone, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

COLLECTOR_BOT_TOKEN = os.environ.get("COLLECTOR_BOT_TOKEN", "")
APPS_SCRIPT_URL     = os.environ.get("APPS_SCRIPT_URL", "")
TZ_VN = timezone(timedelta(hours=7))

KEYWORDS = ["order", "revoke", "export", "move"]


# ── Send data to Google Sheet via Apps Script ─────────────────────────────
def post_sheet(payload: dict):
    """POST JSON to Apps Script Web App."""
    if not APPS_SCRIPT_URL:
        logger.error("APPS_SCRIPT_URL not set.")
        return {"status": "error", "message": "APPS_SCRIPT_URL not configured"}
    try:
        resp = requests.post(APPS_SCRIPT_URL, json=payload, timeout=15)
        resp.raise_for_status()
        logger.info(f"Apps Script response: {resp.text[:300]}")
        return resp.json()
    except Exception as e:
        logger.error(f"Apps Script POST error: {e}")
        return {"status": "error", "message": str(e)}


# ── Detect collector keyword in message ───────────────────────────────────
def is_collector_msg(text: str) -> bool:
    lower = text.lower()
    return any(f"{k}:" in lower for k in KEYWORDS)


# ── Main async handler ────────────────────────────────────────────────────
async def handle(data: dict):
    async with Bot(token=COLLECTOR_BOT_TOKEN) as bot:
        update = Update.de_json(data, bot)
        if not update.message or not update.message.text:
            return

        msg     = update.message
        user    = msg.from_user
        text    = msg.text.strip()
        chat_id = msg.chat_id
        now     = datetime.now(TZ_VN)

        sender_name = (user.full_name if user else "") or ""
        username    = (f"@{user.username}" if user and user.username else str(user.id)) if user else ""

        # ── /start ────────────────────────────────────────────────────────
        if text.startswith("/start"):
            await bot.send_message(
                chat_id,
                "👋 <b>Asset Request Bot</b>\n"
                "📌 Send asset commands in this format:\n"
                "<code>Order: TNI0001 detail</code>\n"
                "<code>Revoke: TNI0001 detail</code>\n"
                "<code>Export: TNI0001 detail</code>\n"
                "<code>Move: from TNI0001 to TNI0002 detail</code>\n"
                "<code>......: TNI0000 Detail</code>",
                parse_mode="HTML"
            )
            return

        # ── Done ──────────────────────────────────────────────────────────
        if re.match(r"^done\b", text, re.IGNORECASE):
            # 1) Extract #ID from user's text: "Done: #00008" or "Done: #8"
            id_in_text = re.search(r"#(\d+)", text)
            ref_id = None

            if id_in_text:
                ref_id = id_in_text.group(1)
            else:
                # 2) Extract #ID from reply_to_message (bot's confirmation)
                reply = msg.reply_to_message
                if reply and reply.text:
                    id_in_reply = re.search(r"#(\d+)", reply.text)
                    if id_in_reply:
                        ref_id = id_in_reply.group(1)
                    else:
                        # 3) Fallback: search sheet column C for reply text
                        try:
                            import csv, io
                            sheet_url = (
                                "https://docs.google.com/spreadsheets/d/"
                                "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
                                "/gviz/tq?tqx=out:csv&gid=199426270"
                            )
                            resp = requests.get(sheet_url, timeout=10)
                            rows = list(csv.reader(io.StringIO(resp.text)))
                            reply_lower = reply.text.strip().lower()
                            for i, row in enumerate(rows[1:], start=1):
                                if len(row) >= 3 and row[2].strip().lower() == reply_lower:
                                    ref_id = str(i)
                                    break
                        except Exception as ex:
                            logger.error(f"CSV search error: {ex}")

            if not ref_id:
                await bot.send_message(
                    chat_id,
                    "Receive Done (Only asset or Team leader reply Done or Done detail)",
                    parse_mode="HTML"
                )
                return

            # Extract done detail: "Done: fixed it" → "fixed it"
            done_detail = re.sub(r"^done\s*:?\s*#?\d*\s*", "", text, flags=re.IGNORECASE).strip()

            result = post_sheet({
                "action":    "done",
                "ref_id":    ref_id,
                "done":      done_detail or "Done",
                "done_date": now.strftime("%d/%m/%Y"),
                "done_time": now.strftime("%H:%M"),
                "chat_id":   str(user.id if user else chat_id),
                "sender_name": sender_name,
            })
            status = result.get("status")
            if status == "ok":
                detail_txt = f" — {html.escape(done_detail)}" if done_detail else ""
                await bot.send_message(
                    chat_id,
                    f"REQUEST_BOT ✅ Done #{ref_id}{detail_txt}📅 {now.strftime('%d/%m/%Y %H:%M')}",
                    parse_mode="HTML"
                )
            elif status == "denied":
                await bot.send_message(
                    chat_id,
                    f"🚫 ID <code>{user.id if user else chat_id}</code> not authorised.",
                    parse_mode="HTML"
                )
            else:
                err = html.escape(result.get("message", "unknown error"))
                await bot.send_message(chat_id, f"⚠️ Error: {err}", parse_mode="HTML")
            return


        # ── Collector commands ─────────────────────────────────────────────
        if is_collector_msg(text):
            result = post_sheet({
                "action":  "add",
                "date":    now.strftime("%d/%m/%Y %H:%M"),   # Column A
                "chat_id": str(user.id if user else chat_id),# Column B
                "msg":     text,                              # Column C
            })

            if result.get("status") == "ok":
                row_id = str(result.get("row", "???")).zfill(5)
                await bot.send_message(
                    chat_id,
                    f"REQUEST_BOT ✅ Recorded — 🆔 #{row_id}📅 {now.strftime('%d/%m/%Y %H:%M')}",
                    parse_mode="HTML"
                )
            else:
                err = html.escape(result.get("message", "no response from Apps Script"))
                logger.error(f"Sheet error: {err}")
                await bot.send_message(
                    chat_id,
                    f"⚠️ <b>Failed to record.</b>\n<i>{err}</i>",
                    parse_mode="HTML"
                )
            return

        # ── Unknown message ────────────────────────────────────────────────
        await bot.send_message(
            chat_id,
            "❓ <b>Command not recognised.</b>\n\n"
            "Please use one of:\n"
            "<code>Order: ...</code>\n"
            "<code>Revoke: ...</code>\n"
            "<code>Export: ...</code>\n"
            "<code>Move: ...</code>\n\n"
            "Or send <code>/start</code> for help.",
            parse_mode="HTML"
        )


# ── Vercel entry point ────────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data   = json.loads(self.rfile.read(length))
            asyncio.run(handle(data))
        except Exception as e:
            logger.error(f"Webhook error: {e}")
        finally:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")

    def do_GET(self):
        token_ok  = "SET" if COLLECTOR_BOT_TOKEN else "MISSING"
        script_ok = "SET" if APPS_SCRIPT_URL else "MISSING"
        self.send_response(200)
        self.end_headers()
        self.wfile.write(
            f"Collector Bot OK | TOKEN:{token_ok} | SCRIPT_URL:{script_ok}".encode()
        )


    def log_message(self, *a): pass
