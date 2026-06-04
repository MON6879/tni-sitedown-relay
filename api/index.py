import os, re, io, html, json, asyncio, logging, requests, pandas as pd
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler
from telegram import Bot, Update

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TOKEN          = os.environ.get("TELEGRAM_TOKEN", "")
APPS_SCRIPT_URL = os.environ.get("APPS_SCRIPT_URL", "")
COLLECTOR_BOT_TOKEN = os.environ.get("COLLECTOR_BOT_TOKEN", "")

SPREADSHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
BASE_URL       = (f"https://docs.google.com/spreadsheets/d/"
                  f"{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=")
GID_SITE, GID_TASK, GID_WO = "1095689918", "1755404595", "1429089905"
MAX_LEN = 4096

TZ_VN = timezone(timedelta(hours=7))

COLLECTOR_KEYWORDS = ["order:", "revoke:", "export:", "move:"]


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


# ── send to Google Sheet via Apps Script (POST JSON) ─────────────────────
def send_to_sheet(action: str, payload: dict):
    """Send a POST request to Google Apps Script with JSON body."""
    if not APPS_SCRIPT_URL:
        logger.error("APPS_SCRIPT_URL not configured.")
        return None
    try:
        body = {"action": action, **payload}
        resp = requests.post(APPS_SCRIPT_URL, json=body, timeout=15)
        resp.raise_for_status()
        logger.info(f"Apps Script response: {resp.text[:200]}")
        return resp.json()
    except Exception as e:
        logger.error(f"Apps Script error: {e}")
        return None


# ── detect collector command and extract fields ───────────────────────────
def parse_collector(text: str):
    """
    Parse a collector command message.
    Detects keywords: Order, Revoke, Export, Move
    Returns dict with detected fields or None if not a collector message.
    """
    lower = text.lower()
    if not any(k in lower for k in COLLECTOR_KEYWORDS):
        return None

    fields = {}
    for line in text.strip().splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            fields[k.strip().lower()] = v.strip()
    return fields


# ── core handler ─────────────────────────────────────────────────────────
async def handle(data):
    # Use COLLECTOR_BOT_TOKEN if configured, fallback to TOKEN
    token_to_use = COLLECTOR_BOT_TOKEN if COLLECTOR_BOT_TOKEN else TOKEN

    async with Bot(token=token_to_use) as bot:
        update = Update.de_json(data, bot)
        if not update.message or not update.message.text: return
        text    = update.message.text.strip()
        chat_id = update.message.chat_id

        # Get sender info
        user = update.message.from_user
        sender_name = (user.full_name if user else "") or ""
        username    = (f"@{user.username}" if user and user.username else "") or ""

        # ── /start ───────────────────────────────────────────────────────
        if text.startswith("/start"):
            await bot.send_message(chat_id,
                "👋 <b>TNI Lookup Bot</b>\n\n"
                "📌 Send a TNI code, e.g.: <code>TNI0154</code>\n\n"
                "Bot returns:\n• 📍 Site Info\n• 📋 Task\n• 🔧 WO\n\n"
                "📦 Also accepts asset commands:\n"
                "<code>Order: TNI0001 detail</code>\n"
                "<code>Revoke: TNI0001 detail</code>\n"
                "<code>Export: TNI0001 detail</code>\n"
                "<code>Move: from TNI0001 to TNI0002</code>\n\n"
                "✅ Reply <code>Done: #ID</code> to mark a request as done.\n\n"
                "👤 /myid — Xem ID Telegram của bạn\n"
                "💬 /id   — Xem ID chat này",
                parse_mode="HTML")
            return

        # ── /myid — trả về ID cá nhân + lưu vào sheet ───────────────────
        if text.startswith("/myid"):
            user_id   = str(user.id) if user else str(chat_id)
            full_name = (user.full_name or user.first_name or "Unknown") if user else "Unknown"
            msg_extra = ""
            if APPS_SCRIPT_URL:
                try:
                    r = requests.post(APPS_SCRIPT_URL, json={
                        "action":    "register_user",
                        "user_id":   user_id,
                        "user_name": full_name,
                    }, timeout=15)
                    res = r.json()
                    if res.get("status") == "ok":
                        msg_extra = "\n✅ Đã lưu vào danh sách"
                    elif res.get("status") == "duplicate":
                        msg_extra = "\n⚠️ Bạn đã có trong danh sách rồi"
                except Exception as ex:
                    logger.error(f"register_user error: {ex}")
            await bot.send_message(chat_id,
                f"👤 <b>{html.escape(full_name)}</b>\n"
                f"🔑 ID: <code>{user_id}</code>"
                + msg_extra,
                parse_mode="HTML")
            return

        # ── /id — trả về ID chat hiện tại ────────────────────────────────
        if text.startswith("/id"):
            chat      = update.message.chat
            title     = chat.title or chat.full_name or "Private"
            reg_by    = (user.full_name or user.first_name or str(user.id)) if user else "Unknown"
            msg_extra = ""
            if APPS_SCRIPT_URL:
                try:
                    r = requests.post(APPS_SCRIPT_URL, json={
                        "action":     "register_chat",
                        "chat_id":    str(chat.id),
                        "chat_title": title,
                        "chat_type":  chat.type,
                        "reg_by":     reg_by,
                    }, timeout=15)
                    res = r.json()
                    if res.get("status") == "ok":
                        msg_extra = "\n✅ Đã lưu vào sheet <b>Chat IDs</b>"
                    elif res.get("status") == "duplicate":
                        msg_extra = "\n⚠️ Đã có trong sheet rồi"
                except Exception as ex:
                    logger.error(f"register_chat error: {ex}")
            await bot.send_message(chat_id,
                f"💬 <b>{html.escape(title)}</b>\n"
                f"🔑 <code>{chat.id}</code>\n"
                f"📍 Type: {chat.type}"
                + msg_extra,
                parse_mode="HTML")
            return

        # ── Handle 'Done: #ID' reply ──────────────────────────────────────
        done_match = re.match(r"^done[:\s]+#?(\d+)", text, re.IGNORECASE)
        if done_match:
            ref_id = done_match.group(1)
            now = datetime.now(TZ_VN)
            result = send_to_sheet("done", {
                "ref_id":    ref_id,
                "done":      "Done",
                "done_date": now.strftime("%d/%m/%Y"),
                "done_time": now.strftime("%H:%M"),
                "chat_id":   str(chat_id),   # ID of who pressed Done — checked against Config tab
            })
            if result and result.get("status") == "ok":
                await bot.send_message(chat_id,
                    f"✅ <b>Marked as Done</b> – Request <b>#{ref_id}</b>",
                    parse_mode="HTML")
            elif result and result.get("status") == "denied":
                await bot.send_message(chat_id,
                    f"🚫 <b>Not authorised.</b>\n"
                    f"Your Telegram ID <code>{chat_id}</code> is not in the allowed list.\n"
                    f"Ask your admin to add your ID to the <b>Config</b> sheet.",
                    parse_mode="HTML")
            else:
                err_msg = result.get("message", "unknown error") if result else "no response from Apps Script"
                await bot.send_message(chat_id,
                    f"⚠️ Could not mark #{ref_id} as done: {html.escape(str(err_msg))}",
                    parse_mode="HTML")
            return


        # ── Collector commands: Order / Revoke / Export / Move ────────────
        fields = parse_collector(text)
        if fields is not None:
            now = datetime.now(TZ_VN)
            result = send_to_sheet("add", {
                "date":    now.strftime("%d/%m/%Y %H:%M"),  # A: Date+Time
                "chat_id": str(chat_id),                    # B: Telegram ID
                "msg":     text,                            # C: Full content
            })
            if result and result.get("status") == "ok":
                row_id = result.get("row", "?")
                await bot.send_message(chat_id,
                    f"✅ <b>Recorded</b> – Request <b>#{row_id}</b>\n"
                    f"📅 {now.strftime('%d/%m/%Y %H:%M')}\n\n"
                    f"📦 {html.escape(text)}\n\n"
                    f"When done, reply:\n<code>Done: #{row_id}</code>",
                    parse_mode="HTML")
            else:
                err_msg = result.get("message", "unknown error") if result else "no response from Apps Script"
                logger.error(f"Sheet error: {err_msg}")
                await bot.send_message(chat_id,
                    f"⚠️ Failed to record command.\n<i>{html.escape(str(err_msg))}</i>",
                    parse_mode="HTML")
            return

        # ── TNI lookup ───────────────────────────────────────────────────

        m = re.search(r"(TNI\w+)", text, re.IGNORECASE)
        if not m: return
        tni = m.group(1).upper()
        logger.info(f"Lookup: {tni}")

        wait = await bot.send_message(chat_id,
            f"⏳ Looking up <b>{html.escape(tni)}</b>...", parse_mode="HTML")
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
