"""
Vercel webhook handler — TNI Search Bot + Daily Report
Bot: @SEARCHTNITASKWOBOT
URL: https://tni-bot.vercel.app/api/search_bot

Chức năng:
  - TNI lookup: gõ mã TNI → tra Site/Task/WO
  - Daily report: tin nhắn có chữ 'daily' → lưu vào Sheet
  - Ảnh: gửi kèm báo cáo → lưu Drive qua GAS
  - /daily → gửi mẫu báo cáo
"""
import os, re, io, json, html, time, asyncio, logging, requests
import pandas as pd
from http.server import BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
TOKEN                 = os.environ.get("TELEGRAM_TOKEN", "").strip()
DAILY_APPS_SCRIPT_URL = os.environ.get("DAILY_APPS_SCRIPT_URL", "").strip()
APPS_SCRIPT_URL       = os.environ.get("APPS_SCRIPT_URL", "").strip()
SPREADSHEET_ID        = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
BASE_URL              = (
    f"https://docs.google.com/spreadsheets/d/"
    f"{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid="
)
GID_SITE = "1095689918"
GID_TASK = "1755404595"
GID_WO   = "1429089905"
GID_INFO = "171059303"   # Tab: Name Site / Site / Cable / Gpon / DIA

TZ_MM    = timezone(timedelta(hours=6, minutes=30))   # Myanmar UTC+6:30
MAX_LEN  = 4096

# ── Data cache (module-level, shared within Vercel instance) ──────────────────
_df_site: pd.DataFrame | None = None
_df_task: pd.DataFrame | None = None
_df_wo:   pd.DataFrame | None = None
_cache_ts: float = 0.0
CACHE_TTL = 1800   # 30 phút

# ── Daily fields cache ────────────────────────────────────────────────────────
_daily_fields: list[str] = []
_daily_fields_ts: float  = 0.0
DAILY_FIELDS_TTL = 600   # 10 phút

DAILY_FIELDS_DEFAULT = [
    "Daily report",
    "Transportation Used", "Full Name", "Detail WO", "Detail task",
    "Name Site rescue", "Name Cell rescue", "Resuce Cable",
    "Name and detail Site repair alarm",
    "Name Site follow partner refuel", "Other task",
    "Name and detail Site go busines trip start go",
    "Name and detail Site go busines trip end go",
    "Km moto bike start", "Km moto bike the end",
]

# ── Telegram API helper ───────────────────────────────────────────────────────
TG_API = f"https://api.telegram.org/bot{TOKEN}"

def tg_send(chat_id: int, text: str, parse_mode: str = "HTML") -> None:
    """Gửi tin nhắn Telegram, tự chia chunk nếu > 4096 ký tự."""
    chunks = split_messages(text)
    for chunk in chunks:
        try:
            requests.post(
                f"{TG_API}/sendMessage",
                json={"chat_id": chat_id, "text": chunk, "parse_mode": parse_mode},
                timeout=15,
            )
        except Exception as ex:
            logger.error(f"tg_send error: {ex}")

def tg_get_file(file_id: str) -> str | None:
    """Lấy file_path từ Telegram."""
    try:
        resp = requests.get(f"{TG_API}/getFile?file_id={file_id}", timeout=10)
        data = resp.json()
        if data.get("ok"):
            return data["result"]["file_path"]
    except Exception as ex:
        logger.error(f"tg_get_file: {ex}")
    return None

# ── CSV loader ────────────────────────────────────────────────────────────────
def fetch_csv(gid: str) -> pd.DataFrame:
    url  = BASE_URL + gid
    hdrs = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=hdrs, timeout=30, allow_redirects=True)
    resp.raise_for_status()
    content = resp.content.decode("utf-8", errors="replace")
    return pd.read_csv(io.StringIO(content), header=None, dtype=str, on_bad_lines="skip")

def load_all_sheets():
    global _df_site, _df_task, _df_wo, _cache_ts
    if time.time() - _cache_ts < CACHE_TTL and _df_site is not None:
        return
    try:
        logger.info("Loading sheets...")
        _df_site  = fetch_csv(GID_SITE)
        _df_task  = fetch_csv(GID_TASK)
        _df_wo    = fetch_csv(GID_WO)
        _cache_ts = time.time()
        logger.info(f"Loaded — Site:{len(_df_site)} Task:{len(_df_task)} WO:{len(_df_wo)}")
    except Exception as ex:
        logger.error(f"load_all_sheets: {ex}")

# ── TNI lookup helpers ────────────────────────────────────────────────────────
def safe(row, idx: int) -> str:
    try:
        v = row.iloc[idx]
        if pd.isna(v): return ""
        s = str(v).strip()
        return "" if s.lower() in ("nan", "none") else s
    except Exception:
        return ""

def get_site_info(tni: str) -> str:
    if _df_site is None or _df_site.empty: return ""
    try:
        label_row = _df_site.iloc[0]
        data      = _df_site.iloc[1:]
        matched   = data[data.iloc[:, 1].str.upper() == tni.upper()]
        if matched.empty: return ""
        row  = matched.iloc[0]
        parts = []
        for idx in [17, 19, 20, 21, 24, 26]:
            label = safe(label_row, idx)
            val   = safe(row, idx)
            if not label or val in ("", "0", "0.0"): continue
            try:
                num = round(float(val), 1)
                if num: parts.append(f"{label}: {num}")
            except ValueError:
                if val: parts.append(f"{label}: {val}")
        return ", ".join(parts)
    except Exception as ex:
        logger.error(f"get_site_info: {ex}")
        return ""

def get_tasks(tni: str) -> list:
    if _df_task is None or _df_task.empty: return []
    tasks = []
    try:
        for _, row in _df_task.iloc[2:].iterrows():
            if safe(row, 19).upper() != tni.upper(): continue
            if safe(row, 9): continue   # already done
            d = safe(row, 3); e = safe(row, 4)
            k = safe(row, 10); h = safe(row, 7)
            tasks.append(f"{d} : {e} : {k} + {h}")
    except Exception as ex:
        logger.error(f"get_tasks: {ex}")
    return tasks

def get_wos(tni: str) -> list:
    if _df_wo is None or _df_wo.empty: return []
    wos = []
    try:
        for _, row in _df_wo.iloc[3:].iterrows():
            if safe(row, 4).upper() != tni.upper(): continue
            a = safe(row, 0); b = safe(row, 1)
            c = safe(row, 2); f = safe(row, 5)
            wos.append(f"{a} + {b} : {c} + {f}")
    except Exception as ex:
        logger.error(f"get_wos: {ex}")
    return wos

def lookup_tni(tni: str) -> str:
    def e(s): return html.escape(str(s))
    lines = [f"🔍 <b>{e(tni)}</b>\n━━━━━━━━━━━━━━━━━━━━"]
    site_info = get_site_info(tni)
    if site_info:
        lines.append(f"\n📍 <b>Site Info</b>\n{e(site_info)}")
    tasks = get_tasks(tni)
    lines.append(f"\n📋 <b>Task ({len(tasks)})</b>")
    lines += [f"• {e(t)}" for t in tasks] if tasks else ["• No see"]
    wos = get_wos(tni)
    lines.append(f"\n🔧 <b>WO ({len(wos)})</b>")
    lines += [f"• {e(w)}" for w in wos] if wos else ["• No see"]
    lines.append("━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)

def split_messages(text: str) -> list:
    chunks, current = [], ""
    for line in text.split("\n"):
        candidate = (current + "\n" + line) if current else line
        if len(candidate) <= MAX_LEN:
            current = candidate
        else:
            if current: chunks.append(current)
            while len(line) > MAX_LEN:
                chunks.append(line[:MAX_LEN]); line = line[MAX_LEN:]
            current = line
    if current: chunks.append(current)
    return chunks

# ── Info lookup (Site/Cable/Gpon/DIA) ─────────────────────────────────────
def get_info(tni: str) -> dict | None:
    """Tìm TNI trong sheet gid=171059303, trả về Site/Cable/Gpon/DIA."""
    try:
        df = fetch_csv(GID_INFO)
        rows = df.iloc[1:] if len(df) > 1 else df
        for _, row in rows.iterrows():
            a = safe(row, 0)  # Col A = Name Site (TNI code)
            if a.upper() == tni.upper():
                return {
                    "site":  safe(row, 1),  # Col B
                    "cable": safe(row, 2),  # Col C
                    "gpon":  safe(row, 3),  # Col D
                    "dia":   safe(row, 4),  # Col E
                }
        return None
    except Exception as ex:
        logger.error(f"get_info error: {ex}")
        return None

def build_info_reply(tni: str, info: dict) -> str:
    e = html.escape
    lines = [f"📡 <b>Info: {e(tni)}</b>\n━━━━━━━━━━━━━━━━━━━━"]
    if info.get("site"):
        lines.append(f"\n🏢 <b>Site</b>\n{e(info['site'])}")
    if info.get("cable"):
        lines.append(f"\n🔌 <b>Cable</b>\n{e(info['cable'])}")
    if info.get("gpon"):
        lines.append(f"\n📶 <b>Gpon</b>\n{e(info['gpon'])}")
    if info.get("dia"):
        lines.append(f"\n🌐 <b>DIA</b>\n{e(info['dia'])}")
    lines.append("━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)

# ── Daily Report ──────────────────────────────────────────────────────────────
def fetch_daily_fields() -> list[str]:
    global _daily_fields, _daily_fields_ts
    now = time.time()
    if _daily_fields and (now - _daily_fields_ts) < DAILY_FIELDS_TTL:
        return _daily_fields
    if not DAILY_APPS_SCRIPT_URL:
        return DAILY_FIELDS_DEFAULT
    try:
        resp = requests.get(DAILY_APPS_SCRIPT_URL + "?action=get_fields", timeout=15)
        data = resp.json()
        if data.get("status") == "ok" and data.get("fields"):
            _daily_fields    = data["fields"]
            _daily_fields_ts = now
            return _daily_fields
    except Exception as ex:
        logger.warning(f"fetch_daily_fields: {ex}")
    return _daily_fields or DAILY_FIELDS_DEFAULT

def parse_daily_report(text: str, fields: list[str]) -> dict:
    result, cur_key, cur_val = {}, None, []

    def flush():
        if cur_key:
            result[cur_key] = " ".join(cur_val).strip()

    for line in text.splitlines():
        line = line.strip()
        if not line: continue
        if ":" in line:
            colon = line.index(":")
            label = line[:colon].strip()
            val   = line[colon + 1:].strip()
            matched = None
            label_l = label.lower()
            for f in fields:
                if f.lower() in label_l or label_l in f.lower():
                    matched = f; break
            if matched:
                flush(); cur_key = matched
                cur_val = [val] if val else []
                continue
        if cur_key: cur_val.append(line)
    flush()
    return result

def is_daily(text: str) -> bool:
    return "daily" in text.lower()

def send_daily_template(chat_id: int) -> None:
    fields = fetch_daily_fields()
    now_mm = datetime.now(TZ_MM)
    lines  = [f"Daily report: {now_mm.strftime('%d/%m/%Y')}"]
    for i, f in enumerate(fields[1:], start=1):
        lines.append(f"{i}. {f}:")
    template = "\n".join(lines)
    tg_send(chat_id,
        f"📋 <b>Mẫu Daily Report</b>\n"
        f"Copy → chỉnh sửa → gửi lại:\n\n"
        f"<pre>{html.escape(template)}</pre>",
    )

def submit_daily(chat_id: int, user_id: int, first_name: str, text: str) -> None:
    fields = fetch_daily_fields()
    parsed = parse_daily_report(text, fields)
    now_mm = datetime.now(TZ_MM)
    if "Daily report" not in parsed:
        parsed["Daily report"] = now_mm.strftime("%d/%m/%Y")
    if not DAILY_APPS_SCRIPT_URL:
        tg_send(chat_id, "❌ Bot chưa cấu hình DAILY_APPS_SCRIPT_URL")
        return
    try:
        resp   = requests.post(DAILY_APPS_SCRIPT_URL,
                               json={"action": "daily_add",
                                     "telegram_id": str(user_id),
                                     "fields": parsed},
                               timeout=45)
        result = resp.json()
        if result.get("status") == "ok":
            name = result.get("name") or first_name or str(user_id)
            tg_send(chat_id,
                f"✅ Đã lưu — {html.escape(name)}\n"
                f"📅 {now_mm.strftime('%d/%m/%Y %H:%M')}")
        else:
            tg_send(chat_id, f"❌ Lỗi lưu\n{result.get('message','')[:120]}")
    except Exception as ex:
        logger.error(f"submit_daily: {ex}")
        tg_send(chat_id, f"❌ Lỗi kết nối\n{str(ex)[:80]}")

def submit_photo(chat_id: int, user_id: int, file_id: str) -> None:
    """Gửi ảnh lên GAS để lưu Drive — GAS tự attach vào dòng gần nhất."""
    if not DAILY_APPS_SCRIPT_URL:
        return
    file_path = tg_get_file(file_id)
    if not file_path:
        tg_send(chat_id, "📷 ❌")
        return
    tg_url = f"https://api.telegram.org/file/bot{TOKEN}/{file_path}"
    try:
        resp   = requests.post(DAILY_APPS_SCRIPT_URL,
                               json={"action": "daily_photo",
                                     "telegram_id": str(user_id),
                                     "tg_url": tg_url},
                               timeout=60)
        result = resp.json()
        tg_send(chat_id, "📷 ✅" if result.get("status") == "ok" else "📷 ❌")
    except Exception as ex:
        logger.error(f"submit_photo: {ex}")
        tg_send(chat_id, "📷 ❌")

# ── Update handler ────────────────────────────────────────────────────────────
def handle(update: dict) -> None:
    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return

    chat_id    = msg["chat"]["id"]
    user       = msg.get("from", {})
    user_id    = user.get("id", 0)
    first_name = user.get("first_name", "")

    # ── PHOTO ──────────────────────────────────────────────────────────────
    if "photo" in msg:
        # Lấy ảnh chất lượng cao nhất
        file_id = msg["photo"][-1]["file_id"]
        submit_photo(chat_id, user_id, file_id)
        return

    text = (msg.get("text") or "").strip()
    if not text:
        return

    # ── COMMANDS ────────────────────────────────────────────────────────────
    if text.startswith("/"):
        cmd = text.split()[0].lower().split("@")[0]

        if cmd == "/start":
            tg_send(chat_id,
                "👋 <b>TNI Search Bot</b>\n\n"
                "• Gõ mã <code>TNI...</code> để tra cứu Task/WO\n"
                "• <code>Info: TNI...</code> tra cứu Site/Cable/DIA\n"
                "• Gửi báo cáo có chữ <b>Daily</b> để lưu\n"
                "• /daily — xem mẫu báo cáo")

        elif cmd == "/daily":
            send_daily_template(chat_id)

        elif cmd in ("/id", "/myid"):
            chat_title = msg["chat"].get("title") or first_name or "Private"
            chat_type  = msg["chat"].get("type", "private")
            msg_extra  = ""
            if APPS_SCRIPT_URL:
                try:
                    r = requests.post(APPS_SCRIPT_URL, json={
                        "action":     "register_chat" if cmd == "/id" else "register_user",
                        "chat_id":    str(chat_id),
                        "chat_title": chat_title,
                        "chat_type":  chat_type,
                        "reg_by":     first_name,
                        "user_id":    str(user_id),
                        "user_name":  first_name,
                    }, timeout=15)
                    res = r.json()
                    if res.get("status") == "ok":
                        msg_extra = "\n✅ Saved"
                    elif res.get("status") == "duplicate":
                        msg_extra = "\n⚠️ Already exists"
                except Exception:
                    pass
            tg_send(chat_id,
                f"👤 <b>{html.escape(first_name)}</b>\n"
                f"🔑 ID: <code>{user_id}</code>\n"
                f"💬 Chat: <code>{chat_id}</code>\n"
                f"📍 Type: {chat_type}"
                + msg_extra)

        elif cmd == "/reload":
            global _cache_ts
            _cache_ts = 0   # force reload
            load_all_sheets()
            tg_send(chat_id, "✅ Đã reload dữ liệu")

        elif cmd == "/help":
            tg_send(chat_id,
                "📖 <b>Hướng dẫn</b>\n\n"
                "• Gõ mã TNI (vd: <code>TNI0009</code>) → tra cứu Site/Task/WO\n"
                "• <code>Info: TNI0009</code> → tra cứu Site/Cable/Gpon/DIA\n"
                "• Gửi báo cáo Daily → tự lưu vào Sheet\n"
                "• /daily → xem mẫu báo cáo\n"
                "• /reload → cập nhật dữ liệu\n"
                "• /myid → xem Telegram ID")
        return

    # ── DAILY REPORT ────────────────────────────────────────────────────────
    if is_daily(text):
        submit_daily(chat_id, user_id, first_name, text)
        return

    # ── INFO: TNIxxxx — tra cứu Site/Cable/Gpon/DIA ────────────────────────
    info_match = re.match(r"^info[:\s]+\s*(TNI\w+)", text, re.IGNORECASE)
    if info_match:
        tni = info_match.group(1).upper()
        logger.info(f"Info lookup: {tni} | chat={chat_id}")
        tg_send(chat_id, f"⏳ Đang tìm thông tin <b>{html.escape(tni)}</b>...")
        try:
            info = get_info(tni)
            if info and any(info.values()):
                reply = build_info_reply(tni, info)
                for chunk in split_messages(reply):
                    tg_send(chat_id, chunk)
            else:
                tg_send(chat_id,
                    f"❌ Không tìm thấy <b>{html.escape(tni)}</b> trong danh sách Site Info."
                )
        except Exception as err:
            logger.error(f"Info error [{tni}]: {err}")
            tg_send(chat_id, f"❌ Lỗi tra cứu: {html.escape(str(err))}")

        # ── Ghi log tìm kiếm Info (fire & forget) ──
        if APPS_SCRIPT_URL:
            try:
                now_mm = datetime.now(TZ_MM)
                requests.post(APPS_SCRIPT_URL, json={
                    "action":    "log_search",
                    "user_name": first_name or str(user_id),
                    "user_id":   str(user_id),
                    "tni_code":  tni,
                    "date":      now_mm.strftime("%d/%m/%Y"),
                    "time":      now_mm.strftime("%H:%M"),
                }, timeout=15)
            except Exception:
                pass
        return

    # ── TNI LOOKUP ──────────────────────────────────────────────────────────
    m = re.search(r"(TNI\w+)", text, re.IGNORECASE)
    if not m:
        return

    tni = m.group(1).upper()
    load_all_sheets()
    result = lookup_tni(tni)
    for chunk in split_messages(result):
        tg_send(chat_id, chunk)

    # ── Ghi log tìm kiếm (fire & forget) ──
    if APPS_SCRIPT_URL:
        try:
            now_mm = datetime.now(TZ_MM)
            requests.post(APPS_SCRIPT_URL, json={
                "action":    "log_search",
                "user_name": first_name or str(user_id),
                "user_id":   str(user_id),
                "tni_code":  tni,
                "date":      now_mm.strftime("%d/%m/%Y"),
                "time":      now_mm.strftime("%H:%M"),
            }, timeout=15)
        except Exception:
            pass


# ── Vercel entry point ────────────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data   = json.loads(self.rfile.read(length))
            handle(data)
        except Exception as ex:
            logger.error(f"Webhook POST error: {ex}")
        finally:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")

    def do_GET(self):
        tok_ok  = "SET" if TOKEN else "MISSING"
        gas_ok  = "SET" if DAILY_APPS_SCRIPT_URL else "MISSING"
        msg = f"TNI Search Bot OK | TOKEN:{tok_ok} | DAILY_GAS:{gas_ok}"
        self.send_response(200)
        self.end_headers()
        self.wfile.write(msg.encode())

    def log_message(self, *a): pass
