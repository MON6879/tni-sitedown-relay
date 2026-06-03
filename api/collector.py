"""
Vercel webhook handler cho Collector Bot.
Nhận Order/Revoke/Export/Move từ nhân viên → ghi Google Sheet.
URL: https://your-app.vercel.app/api/collector
"""
import os, re, json, asyncio, logging, requests
from http.server import BaseHTTPRequestHandler
from telegram import Bot, Update
from datetime import datetime, timezone, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

COLLECTOR_BOT_TOKEN = os.environ.get("COLLECTOR_BOT_TOKEN", "")
APPS_SCRIPT_URL     = os.environ.get("APPS_SCRIPT_URL", "")
TZ_VN = timezone(timedelta(hours=7))


def fetch_keywords():
    try:
        resp = requests.get(APPS_SCRIPT_URL, timeout=10)
        data = resp.json()
        if data.get("status") == "ok":
            return data.get("keywords", ["Order","Revoke","Export","Move"])
    except Exception:
        pass
    return ["Order","Revoke","Export","Move"]


def parse_msg(text, keywords):
    result     = {}
    kw_pattern = "|".join(re.escape(k) for k in keywords) + "|done"
    pattern    = rf"({kw_pattern})\s*:\s*(.+?)(?=(?:{kw_pattern})\s*:|$)"
    for key, value in re.findall(pattern, text, re.IGNORECASE | re.DOTALL):
        result[key.lower()] = value.strip()
    return result


def post_sheet(payload):
    try:
        return requests.post(APPS_SCRIPT_URL, json=payload, timeout=10).json()
    except Exception as e:
        return {"status":"error","message":str(e)}


async def handle(data):
    async with Bot(token=COLLECTOR_BOT_TOKEN) as bot:
        update = Update.de_json(data, bot)
        if not update.message or not update.message.text:
            return

        msg      = update.message
        user     = msg.from_user
        text     = msg.text.strip()
        now      = datetime.now(TZ_VN)
        keywords = fetch_keywords()
        name     = user.full_name or "Unknown"
        uname    = f"@{user.username}" if user.username else str(user.id)

        # /start
        if text.startswith("/start"):
            kw_lines = "\n".join(f"{k}: ..." for k in keywords)
            await bot.send_message(msg.chat_id,
                f"👋 *မင်္ဂလာပါ!*\n\n📌 *ပုံစံ:*\n```\n{kw_lines}\n```\n\n"
                f"✅ ပြီးပါက Bot ၏ reply ကို Reply ပြု၍ `Done: ...` ပို့ပါ",
                parse_mode="Markdown")
            return

        # Done reply
        if msg.reply_to_message and re.search(r"done\s*:", text, re.IGNORECASE):
            parsed   = parse_msg(text, keywords)
            done_txt = parsed.get("done", text)
            orig     = msg.reply_to_message.text or ""
            ref      = re.search(r"#(\d+)", orig)
            ref_id   = ref.group(1) if ref else None
            result   = post_sheet({"action":"done","ref_id":ref_id,"done":done_txt,
                                   "done_date":now.strftime("%d/%m/%Y"),
                                   "done_time":now.strftime("%H:%M"),
                                   "chat_id":str(user.id)})
            if result.get("status") == "ok":
                await bot.send_message(msg.chat_id,
                    f"✅ *#{ref_id} ပြီးစီးပြီ!*\n📝 {done_txt}\n🕐 {now.strftime('%d/%m/%Y %H:%M')}",
                    parse_mode="Markdown")
            return

        # Tin thường
        parsed = parse_msg(text, keywords)
        if not parsed:
            kw_lines = "\n".join(f"{k}: ..." for k in keywords)
            await bot.send_message(msg.chat_id,
                f"❓ *မမှတ်မိပါ။* ပုံစံ:\n```\n{kw_lines}\n```",
                parse_mode="Markdown")
            return

        fields = {k:v for k,v in parsed.items() if k != "done"}
        result = post_sheet({"action":"add","date":now.strftime("%d/%m/%Y"),
                             "time":now.strftime("%H:%M"),"sender_name":name,
                             "username":uname,"chat_id":str(user.id),"fields":fields})

        if result.get("status") == "ok":
            ref_id = str(result.get("row","???")).zfill(5)
            icons  = {"order":"📦","revoke":"↩️","export":"📤","move":"🚚",
                      "install":"🔧","check":"🔍","repair":"🛠️"}
            lines  = [f"✅ *လက်ခံပြီး — 🆔 #{ref_id}*\n📅 {now.strftime('%d/%m/%Y %H:%M')}\n"]
            for k,v in fields.items():
                if v: lines.append(f"{icons.get(k,'▪️')} {k.capitalize()}: {v}")
            lines.append("\n_Reply ပြု၍_ `Done: ...` _ပို့ပါ_")
            await bot.send_message(msg.chat_id, "\n".join(lines), parse_mode="Markdown")
        else:
            await bot.send_message(msg.chat_id, f"❌ Error: `{result.get('message','')}`",
                                   parse_mode="Markdown")


# ── Vercel entry point ───────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data   = json.loads(self.rfile.read(length))
            asyncio.run(handle(data))
        except Exception as e:
            logger.error(f"Webhook:{e}")
        finally:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Collector Bot OK")

    def log_message(self, *a): pass
