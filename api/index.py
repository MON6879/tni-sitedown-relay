import os, re, io, html, json, logging, requests, pandas as pd
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TOKEN           = os.environ.get("TELEGRAM_TOKEN", "")
APPS_SCRIPT_URL = os.environ.get("APPS_SCRIPT_URL", "")

SPREADSHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
BASE_URL       = (f"https://docs.google.com/spreadsheets/d/"
                  f"{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=")
GID_SITE, GID_TASK, GID_WO = "1095689918", "1755404595", "1429089905"
MAX_LEN = 4096
TZ_MM   = timezone(timedelta(hours=6, minutes=30))


# ── Telegram helper: gửi tin nhắn ────────────────────────────────────────
def tg_send(chat_id, text, parse_mode="HTML"):
    if not TOKEN:
        logger.error("TELEGRAM_TOKEN chưa cấu hình")
        return
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
            timeout=15,
        )
        if not r.ok:
            logger.error(f"Telegram sendMessage lỗi: {r.text[:200]}")
    except Exception as e:
        logger.error(f"tg_send error: {e}")


# ── Google Sheet helpers ──────────────────────────────────────────────────
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
        return "" if s.lower() in ("nan", "none") else s
    except:
        return ""

def site_info(df, tni):
    try:
        lbl  = df.iloc[0]
        rows = df.iloc[1:]
        hit  = rows[rows.iloc[:, 1].str.upper() == tni.upper()]
        if hit.empty:
            return ""
        row, parts = hit.iloc[0], []
        for i in [17, 19, 20, 21, 24, 26]:
            l, v = sv(lbl, i), sv(row, i)
            if not l or v in ("", "0", "0.0"):
                continue
            try:
                n = round(float(v), 1)
                if n:
                    parts.append(f"{l}: {n}")
            except:
                if v:
                    parts.append(f"{l}: {v}")
        return ", ".join(parts)
    except Exception as e:
        logger.error(f"site_info: {e}")
        return ""

def get_tasks(df, tni):
    out = []
    try:
        for _, r in df.iloc[2:].iterrows():
            if sv(r, 19).upper() != tni.upper() or sv(r, 9):
                continue
            out.append(f"{sv(r,3)} : {sv(r,4)} : {sv(r,10)} + {sv(r,7)}")
    except Exception as e:
        logger.error(f"tasks: {e}")
    return out

def get_wos(df, tni):
    out = []
    try:
        for _, r in df.iloc[3:].iterrows():
            if sv(r, 4).upper() != tni.upper():
                continue
            out.append(f"{sv(r,0)} + {sv(r,1)} : {sv(r,2)} + {sv(r,5)}")
    except Exception as e:
        logger.error(f"wos: {e}")
    return out

def build_reply(tni):
    e  = html.escape
    ds = fetch(GID_SITE)
    dt = fetch(GID_TASK)
    dw = fetch(GID_WO)
    si = site_info(ds, tni)
    tk = get_tasks(dt, tni)
    wo = get_wos(dw, tni)
    lines = [f"🔍 <b>{e(tni)}</b>\n━━━━━━━━━━━━━━━━━━━━"]
    if si:
        lines.append(f"\n📍 <b>Site Info</b>\n{e(si)}")
    lines.append(f"\n📋 <b>Task ({len(tk)})</b>")
    lines += [f"• {e(t)}" for t in tk] or ["• No see"]
    lines.append(f"\n🔧 <b>WO ({len(wo)})</b>")
    lines += [f"• {e(w)}" for w in wo] or ["• No see"]
    lines.append("━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)

def split_chunks(text):
    parts, cur = [], ""
    for line in text.split("\n"):
        cand = (cur + "\n" + line) if cur else line
        if len(cand) <= MAX_LEN:
            cur = cand
        else:
            if cur:
                parts.append(cur)
            while len(line) > MAX_LEN:
                parts.append(line[:MAX_LEN])
                line = line[MAX_LEN:]
            cur = line
    if cur:
        parts.append(cur)
    return parts

def send_to_sheet(payload):
    if not APPS_SCRIPT_URL:
        return None
    try:
        r = requests.post(APPS_SCRIPT_URL, json=payload, timeout=15)
        return r.json()
    except Exception as e:
        logger.error(f"Apps Script error: {e}")
        return None


# ── Core message handler ──────────────────────────────────────────────────
def handle(data):
    msg = data.get("message") or data.get("edited_message")
    if not msg:
        return

    text    = (msg.get("text") or "").strip()
    chat_id = msg.get("chat", {}).get("id")
    user    = msg.get("from") or {}

    if not text or not chat_id:
        return

    user_id   = str(user.get("id", ""))
    full_name = " ".join(filter(None, [
        user.get("first_name", ""),
        user.get("last_name", ""),
    ])).strip() or user.get("username", "Unknown")

    logger.info(f"MSG chat={chat_id} user={user_id} text={text[:60]}")

    # ── /start ────────────────────────────────────────────────────────────
    if text.startswith("/start"):
        tg_send(chat_id,
            "👋 <b>Bot tra cứu TNI</b>\n\n"
            "📌 Gõ mã TNI, ví dụ: <code>TNI0154</code>\n\n"
            "Bot trả về:\n"
            "• 📍 Site Info (alarm)\n"
            "• 📋 Task còn tồn\n"
            "• 🔧 Work Orders\n\n"
            "👤 /myid — Xem Telegram ID của bạn\n"
            "💬 /id   — Xem ID chat này"
        )
        return

    # ── /myid ─────────────────────────────────────────────────────────────
    if text.startswith("/myid"):
        msg_extra = ""
        if APPS_SCRIPT_URL and user_id:
            res = send_to_sheet({
                "action":    "register_user",
                "user_id":   user_id,
                "user_name": full_name,
            })
            if res:
                if res.get("status") == "ok":
                    msg_extra = "\n✅ Đã lưu vào danh sách"
                elif res.get("status") == "duplicate":
                    msg_extra = "\n⚠️ Bạn đã có trong danh sách rồi"
        tg_send(chat_id,
            f"👤 <b>{html.escape(full_name)}</b>\n"
            f"🔑 ID: <code>{user_id}</code>"
            + msg_extra
        )
        return

    # ── /id ───────────────────────────────────────────────────────────────
    if text.startswith("/id"):
        chat      = msg.get("chat", {})
        title     = chat.get("title") or chat.get("username") or "Private"
        chat_type = chat.get("type", "")
        msg_extra = ""
        if APPS_SCRIPT_URL:
            res = send_to_sheet({
                "action":     "register_chat",
                "chat_id":    str(chat_id),
                "chat_title": title,
                "chat_type":  chat_type,
                "reg_by":     full_name,
            })
            if res:
                if res.get("status") == "ok":
                    msg_extra = "\n✅ Đã lưu vào sheet <b>Chat IDs</b>"
                elif res.get("status") == "duplicate":
                    msg_extra = "\n⚠️ Đã có trong sheet rồi"
        tg_send(chat_id,
            f"💬 <b>{html.escape(title)}</b>\n"
            f"🔑 <code>{chat_id}</code>\n"
            f"📍 Type: {chat_type}"
            + msg_extra
        )
        return

    # ── Done: #ID ─────────────────────────────────────────────────────────
    done_match = re.match(r"^done[:\s]+#?(\d+)", text, re.IGNORECASE)
    if done_match:
        ref_id = done_match.group(1)
        now    = datetime.now(TZ_MM)
        res    = send_to_sheet({
            "action":    "done",
            "ref_id":    ref_id,
            "done":      "Done",
            "done_date": now.strftime("%d/%m/%Y"),
            "done_time": now.strftime("%H:%M"),
            "chat_id":   user_id,
        })
        if res and res.get("status") == "ok":
            tg_send(chat_id, f"✅ <b>Marked as Done</b> – Request <b>#{ref_id}</b>")
        elif res and res.get("status") == "denied":
            tg_send(chat_id,
                f"🚫 <b>Not authorised.</b>\n"
                f"ID <code>{user_id}</code> chưa có trong danh sách Config."
            )
        else:
            err = res.get("message", "unknown") if res else "no response"
            tg_send(chat_id, f"⚠️ Không thể update #{ref_id}: {html.escape(str(err))}")
        return

    # ── Collector: Order/Revoke/Export/Move ───────────────────────────────
    COLLECTOR_KEYWORDS = ["order:", "revoke:", "export:", "move:"]
    if any(k in text.lower() for k in COLLECTOR_KEYWORDS):
        now = datetime.now(TZ_MM)
        res = send_to_sheet({
            "action":  "add",
            "date":    now.strftime("%d/%m/%Y %H:%M"),
            "chat_id": user_id,
            "msg":     text,
        })
        if res and res.get("status") == "ok":
            row_id = res.get("row", "?")
            tg_send(chat_id,
                f"✅ <b>Recorded</b> – Request <b>#{row_id}</b>\n"
                f"📅 {now.strftime('%d/%m/%Y %H:%M')}\n\n"
                f"📦 {html.escape(text)}\n\n"
                f"Khi xong, reply:\n<code>Done: #{row_id}</code>"
            )
        else:
            err = res.get("message", "unknown") if res else "no response"
            tg_send(chat_id, f"⚠️ Ghi thất bại: {html.escape(str(err))}")
        return

    # ── TNI lookup ────────────────────────────────────────────────────────
    m = re.search(r"(TNI\w+)", text, re.IGNORECASE)
    if not m:
        return

    tni = m.group(1).upper()
    logger.info(f"Lookup TNI: {tni} | chat={chat_id}")

    tg_send(chat_id, f"⏳ Đang tìm <b>{html.escape(tni)}</b>...")
    try:
        reply  = build_reply(tni)
        parts  = split_chunks(reply)
        # Gửi từng chunk
        for part in parts:
            tg_send(chat_id, part)
        # Log tìm kiếm lên sheet
        if APPS_SCRIPT_URL and user_id:
            now = datetime.now(TZ_MM)
            send_to_sheet({
                "action":    "log_search",
                "user_name": full_name,
                "user_id":   user_id,
                "tni_code":  tni,
                "date":      now.strftime("%d/%m/%Y"),
                "time":      now.strftime("%H:%M"),
            })
    except Exception as err:
        logger.error(f"TNI lookup error [{tni}]: {err}")
        tg_send(chat_id,
            f"❌ <b>Fail</b> – {html.escape(tni)}\n"
            f"<i>{html.escape(str(err))}</i>"
        )


# ── Vercel serverless entry point ─────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data   = json.loads(self.rfile.read(length))
            handle(data)
        except Exception as e:
            logger.error(f"Webhook error: {e}")
        finally:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"TNI Bot OK")

    def log_message(self, *a):
        pass
