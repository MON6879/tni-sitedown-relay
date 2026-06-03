import os, re, io, html, json, asyncio, logging, requests, pandas as pd
from http.server import BaseHTTPRequestHandler
from telegram import Bot, Update

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TOKEN          = os.environ.get("TELEGRAM_TOKEN", "")
SPREADSHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
BASE_URL       = (f"https://docs.google.com/spreadsheets/d/"
                  f"{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=")
GID_SITE, GID_TASK, GID_WO = "1095689918", "1755404595", "1429089905"
MAX_LEN = 4096


# ── helpers ──────────────────────────────────────────────────────────────
def fetch(gid):
    r = requests.get(BASE_URL + gid,
                     headers={"User-Agent": "Mozilla/5.0"}, timeout=25)
    r.raise_for_status()
    return pd.read_csv(io.StringIO(r.content.decode("utf-8", "replace")),
                       header=None, dtype=str, on_bad_lines="skip")

def sv(row, i):
    try:
        v = row.iloc[i]
        s = "" if pd.isna(v) else str(v).strip()
        return "" if s.lower() in ("nan","none") else s
    except: return ""

def site_info(df, tni):
    try:
        lbl  = df.iloc[0]
        rows = df.iloc[1:]
        hit  = rows[rows.iloc[:,1].str.upper() == tni.upper()]
        if hit.empty: return ""
        row, parts = hit.iloc[0], []
        for i in [17,19,20,21,24,26]:
            l, v = sv(lbl,i), sv(row,i)
            if not l or v in ("","0","0.0"): continue
            try:
                n = round(float(v),1)
                if n: parts.append(f"{l}: {n}")
            except: parts.append(f"{l}: {v}") if v else None
        return ", ".join(parts)
    except Exception as e:
        logger.error(f"site_info:{e}"); return ""

def tasks(df, tni):
    out = []
    try:
        for _, r in df.iloc[2:].iterrows():
            if sv(r,19).upper()!=tni.upper() or sv(r,9): continue
            out.append(f"{sv(r,3)} : {sv(r,4)} : {sv(r,10)} + {sv(r,7)}")
    except Exception as e: logger.error(f"tasks:{e}")
    return out

def wos(df, tni):
    out = []
    try:
        for _, r in df.iloc[3:].iterrows():
            if sv(r,4).upper()!=tni.upper(): continue
            out.append(f"{sv(r,0)} + {sv(r,1)} : {sv(r,2)} + {sv(r,5)}")
    except Exception as e: logger.error(f"wos:{e}")
    return out

def build_reply(tni):
    e = html.escape
    ds = fetch(GID_SITE); dt = fetch(GID_TASK); dw = fetch(GID_WO)
    si = site_info(ds, tni)
    tk = tasks(dt, tni)
    wo = wos(dw, tni)
    lines = [f"🔍 <b>{e(tni)}</b>\n━━━━━━━━━━━━━━━━━━━━"]
    if si: lines.append(f"\n📍 <b>Site Info</b>\n{e(si)}")
    lines.append(f"\n📋 <b>Task ({len(tk)})</b>")
    lines += [f"• {e(t)}" for t in tk] or ["• No see"]
    lines.append(f"\n🔧 <b>WO ({len(wo)})</b>")
    lines += [f"• {e(w)}" for w in wo] or ["• No see"]
    lines.append("━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)

def chunks(text):
    parts, cur = [], ""
    for line in text.split("\n"):
        cand = (cur+"\n"+line) if cur else line
        if len(cand)<=MAX_LEN: cur=cand
        else:
            if cur: parts.append(cur)
            while len(line)>MAX_LEN: parts.append(line[:MAX_LEN]); line=line[MAX_LEN:]
            cur=line
    if cur: parts.append(cur)
    return parts


# ── core handler ─────────────────────────────────────────────────────────
async def handle(data):
    async with Bot(token=TOKEN) as bot:
        update = Update.de_json(data, bot)
        if not update.message or not update.message.text: return
        text    = update.message.text.strip()
        chat_id = update.message.chat_id

        if text.startswith("/start"):
            await bot.send_message(chat_id,
                "👋 <b>Bot tra cứu TNI</b>\n\n"
                "📌 Gõ mã TNI, ví dụ: <code>TNI0154</code>\n\n"
                "Bot trả về:\n• 📍 Site Info\n• 📋 Task\n• 🔧 WO",
                parse_mode="HTML")
            return

        m = re.search(r"(TNI\w+)", text, re.IGNORECASE)
        if not m: return
        tni = m.group(1).upper()
        logger.info(f"Lookup: {tni}")

        wait = await bot.send_message(chat_id,
            f"⏳ Đang tìm <b>{html.escape(tni)}</b>...", parse_mode="HTML")
        try:
            reply  = build_reply(tni)
            parts  = chunks(reply)
            await bot.edit_message_text(parts[0], chat_id=chat_id,
                                        message_id=wait.message_id, parse_mode="HTML")
            for p in parts[1:]:
                await bot.send_message(chat_id, p, parse_mode="HTML")
        except Exception as err:
            logger.error(f"Error[{tni}]:{err}")
            await bot.edit_message_text(
                f"❌ <b>Fail</b> – {html.escape(tni)}\n<i>{html.escape(str(err))}</i>",
                chat_id=chat_id, message_id=wait.message_id, parse_mode="HTML")


# ── Vercel entry point ───────────────────────────────────────────────────
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
        self.wfile.write(b"TNI Bot OK")

    def log_message(self, *a): pass
