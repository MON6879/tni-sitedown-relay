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

COLLECTOR_BOT_TOKEN = os.environ.get("COLLECTOR_BOT_TOKEN", "").strip().strip("\ufeff")
APPS_SCRIPT_URL     = os.environ.get("APPS_SCRIPT_URL", "").strip().strip("\ufeff")
TZ_VN = timezone(timedelta(hours=7))

KEYWORDS_DEFAULT = ["order", "revoke", "export", "move", "asset sent", "destroys"]
_keywords_cache = None

def get_keywords() -> list:
    """Load keywords from Config sheet col A (text before ':'), cache result."""
    global _keywords_cache
    if _keywords_cache is not None:
        return _keywords_cache
    try:
        url = (
            "https://docs.google.com/spreadsheets/d/"
            "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
            "/gviz/tq?tqx=out:csv&gid=1236389870&tq=select+A+limit+30"
        )
        resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        import csv, io
        rows = list(csv.reader(io.StringIO(resp.text)))
        kws = []
        for row in rows[1:]:  # skip header
            val = (row[0] if row else "").strip()
            if ":" in val:
                kw = val.split(":")[0].strip().lower()
                if kw and kw not in kws:
                    kws.append(kw)
        if kws:
            _keywords_cache = kws
            logger.info(f"Keywords from Config: {kws}")
            return kws
    except Exception as e:
        logger.warning(f"Config keyword load failed: {e}, using defaults")
    _keywords_cache = KEYWORDS_DEFAULT
    return _keywords_cache



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
    return any(f"{k}:" in lower for k in get_keywords())


# ── Main async handler ────────────────────────────────────────────────────
async def handle(data: dict):
    async with Bot(token=COLLECTOR_BOT_TOKEN) as bot:
        update = Update.de_json(data, bot)
        if not update.message:
            return

        msg     = update.message
        user    = msg.from_user
        chat_id = msg.chat_id
        now     = datetime.now(TZ_VN)
        sender_name = (user.full_name if user else "") or ""
        username    = (f"@{user.username}" if user and user.username else str(user.id)) if user else ""

        # ── Photo messages ─────────────────────────────────────────────
        if msg.photo:
            largest   = msg.photo[-1]          # highest resolution
            file_info = await bot.get_file(largest.file_id)
            tg_url    = (
                f"https://api.telegram.org/file/bot{COLLECTOR_BOT_TOKEN}/"
                f"{file_info.file_path}"
            )
            post_sheet({
                "action":  "add_photo",
                "user_id": str(user.id if user else ""),
                "tg_url":  tg_url,
                "date":    now.strftime("%d/%m/%Y %H:%M"),
            })
            return

        # ── Text only from here ────────────────────────────────────────
        if not msg.text:
            return

        text    = msg.text.strip()

        # ── /start ────────────────────────────────────────────────────────
        if text.startswith("/start"):
            kws = get_keywords()
            kw_lines = "\n".join(f"<code>{k.title()}: TNI0001 detail</code>" for k in kws)
            await bot.send_message(
                chat_id,
                f"👋 <b>Asset Request Bot</b>\n"
                f"📌 Send asset commands in this format:\n"
                f"{kw_lines}",
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
                # 2) Extract #ID or REF:ID from reply_to_message
                reply = msg.reply_to_message
                if reply:
                    reply_text = reply.text or reply.caption or ""
                    if reply_text:
                        # Try #00010 or REF:00010 format
                        id_in_reply = (
                            re.search(r"#(\d+)", reply_text) or
                            re.search(r"REF:(\d+)", reply_text)
                        )
                        if id_in_reply:
                            ref_id = id_in_reply.group(1)
                        else:
                            # 3) Fallback: use Apps Script "find" to search
                            #    by original message content in sheet
                            logger.info(f"[Done] Fallback find: {reply_text[:80]}")
                            find_result = post_sheet({
                                "action": "find",
                                "text":   reply_text.strip()
                            })
                            if find_result.get("status") == "ok":
                                ref_id = str(find_result.get("row", ""))
                                logger.info(f"[Done] Found ref_id={ref_id} via sheet find")

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
                "done":      done_detail,
                "done_date": now.strftime("%d/%m/%Y"),
                "done_time": now.strftime("%H:%M"),
                "chat_id":   str(user.id if user else chat_id),
                "sender_name": sender_name,
            })
            status = result.get("status")
            if status == "ok":
                ref_padded = str(ref_id).zfill(5)
                # 2 dòng: dòng 1 = REF, dòng 2 = Done + ngày
                line1 = f"REQUEST_BOT ✅ Recorded — 🆔 #{ref_padded} 🏷️"
                line2 = "Done"
                if done_detail:
                    line2 += ": " + html.escape(done_detail)
                line2 += f" 📅 {now.strftime('%d/%m/%Y %H:%M')}"
                await bot.send_message(chat_id, f"{line1}\n{line2}", parse_mode="HTML")
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

        # ── Unknown message — ignore silently in groups ─────────────────
        # Only reply in private chat to avoid spam in groups
        if msg.chat.type == "private":
            kws = get_keywords()
            kw_list = ", ".join(k.title() + ":" for k in kws)
            await bot.send_message(
                chat_id,
                f"❓ <b>Command not recognised.</b>\n"
                f"Use: {kw_list}\n"
                f"Send <code>/start</code> for help.",
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
