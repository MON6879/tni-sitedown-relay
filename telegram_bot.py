import os
import re
import io
import html
import time
import asyncio
import logging
import threading
import requests
import pandas as pd
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    ApplicationBuilder, ContextTypes,
    MessageHandler, CommandHandler, filters,
)

# ===================== CONFIG =====================
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)
load_dotenv()

TOKEN          = os.getenv("TELEGRAM_TOKEN")
SPREADSHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
# gviz/tq endpoint: trả CSV trực tiếp, không redirect sang CDN googleusercontent.com
BASE_URL       = (
    f"https://docs.google.com/spreadsheets/d/"
    f"{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid="
)

GID_SITE = "1095689918"  # 'Site down now'   – col B=TNI, cols R,T,U,V,Y,AA = alarm durations
GID_TASK = "1755404595"  # 'Input task'      – col T=TNI, col J=""=pending, D:E:K+H
GID_WO   = "1429089905"  # 'Input WO'(matrix)– col E=TNI, A+B:C+F

df_site: pd.DataFrame = None
df_task: pd.DataFrame = None
df_wo:   pd.DataFrame = None

# ===================== DAILY REPORT CONFIG =====================
DAILY_APPS_SCRIPT_URL = os.getenv("DAILY_APPS_SCRIPT_URL", "")
DAILY_PHOTO_WINDOW    = 3600   # 60 phút — ảnh gửi sau báo cáo được attach tự động
TZ_MM = timezone(timedelta(hours=6, minutes=30))  # Myanmar UTC+6:30

# Theo dõi lần gửi báo cáo cuối: {chat_id: timestamp}
# Dùng để attach ảnh vào đúng dòng trong vòng 60 phút
_last_daily: dict[int, float] = {}

# Cache fields từ GAS
_daily_fields: list[str]  = []
_daily_fields_ts: float   = 0.0
DAILY_FIELDS_CACHE_SEC    = 600   # refresh mỗi 10 phút

# Fallback fields khi GAS chưa deploy
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

# ===================== LOAD DATA =====================
def fetch_csv(gid: str, has_header: bool = True) -> pd.DataFrame:
    """Tải CSV từ Google Sheet qua requests (xử lý redirect tốt hơn urllib)."""
    url = BASE_URL + gid
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers, timeout=30, allow_redirects=True)
    resp.raise_for_status()
    content = resp.content.decode("utf-8", errors="replace")
    if has_header:
        return pd.read_csv(io.StringIO(content), dtype=str, on_bad_lines="skip")
    else:
        return pd.read_csv(io.StringIO(content), header=None,
                           dtype=str, on_bad_lines="skip")


def load_all_sheets():
    global df_site, df_task, df_wo
    logger.info("Dang tai 3 sheet tu Google Sheet...")
    # gviz/tq với header=None: row 0 = labels, row 1+ = data
    df_site = fetch_csv(GID_SITE, has_header=False)
    df_task = fetch_csv(GID_TASK, has_header=False)
    df_wo   = fetch_csv(GID_WO,   has_header=False)
    logger.info(
        f"OK – Site:{len(df_site)} Task:{len(df_task)} WO:{len(df_wo)}"
    )


# ===================== HELPER =====================
def safe(row_or_series, idx: int) -> str:
    """Return stripped string value at position idx, or '' if missing/NaN."""
    try:
        v = row_or_series.iloc[idx]
        if pd.isna(v):
            return ""
        s = str(v).strip()
        return "" if s.lower() in ("nan", "none") else s
    except Exception:
        return ""


# ===================== SITE INFO (Formula 1) =====================
def get_site_info(tni: str) -> str:
    """
    'Site down now' (gviz/tq, header=None):
      iloc[0]  = labels (gviz kết hợp tất cả header rows thành 1 dòng)
      iloc[1+] = data   (col index 1 = TNI code = cột B)
    Target alarm cols: R=17, T=19, U=20, V=21, Y=24, AA=26
    """
    if df_site is None or df_site.empty:
        return ""
    try:
        label_row = df_site.iloc[0]   # labels
        data      = df_site.iloc[1:]  # data bắt đầu từ row 1

        # Tìm TNI ở cột số 1 (col B) bằng integer index
        matched = data[data.iloc[:, 1].str.upper() == tni.upper()]
        if matched.empty:
            return ""

        row     = matched.iloc[0]
        targets = [17, 19, 20, 21, 24, 26]  # R, T, U, V, Y, AA
        parts   = []

        for idx in targets:
            label = safe(label_row, idx)
            val   = safe(row, idx)

            if not label or val in ("", "0", "0.0"):
                continue
            try:
                num = round(float(val), 1)
                if num:
                    parts.append(f"{label}: {num}")
            except ValueError:
                if val:
                    parts.append(f"{label}: {val}")

        return ", ".join(parts)
    except Exception as e:
        logger.error(f"get_site_info: {e}")


# ===================== TASKS (Formula 2) =====================
def get_tasks(tni: str) -> list:
    """
    Sheet 'Input task' (gid=1755404595):
      iloc[0] = header (T=19:'Site Name', J=9:'Date complete',
                        D=3:'Group assign', E=4:'Detailed content',
                        K=10:'Remain day', H=7:'Team leader note')
      iloc[1] = summary/totals row
      iloc[2+] = data rows
      Filter: col T==TNI  AND  col J=="" (pending, no completion date)
      Output:  D : E : K + H
    """
    if df_task is None or df_task.empty:
        return []
    tasks = []
    try:
        for _, row in df_task.iloc[2:].iterrows():
            t_val = safe(row, 19)   # T = Site Name
            j_val = safe(row, 9)    # J = completion date (empty = pending)
            if t_val.upper() != tni.upper():
                continue
            if j_val:               # already done
                continue
            d = safe(row, 3)        # D = Group assign
            e = safe(row, 4)        # E = Detailed content
            k = safe(row, 10)       # K = Remain day
            h = safe(row, 7)        # H = Team leader note
            tasks.append(f"{d} : {e} : {k} + {h}")
    except Exception as e:
        logger.error(f"get_tasks: {e}")
    return tasks


# ===================== WORK ORDERS (Formula 3) =====================
def get_wos(tni: str) -> list:
    """
    Sheet 'Input WO' matrix (gid=1429089905):
      iloc[0,1,2] = 3 header rows
      iloc[3+]    = data rows
      col E(4) = site TNI code
      Filter: col E==TNI
      Output: A + B : C + F
    """
    if df_wo is None or df_wo.empty:
        return []
    wos = []
    try:
        for _, row in df_wo.iloc[3:].iterrows():
            e_val = safe(row, 4)    # E = Name Site
            if e_val.upper() != tni.upper():
                continue
            a = safe(row, 0)        # A = WO code
            b = safe(row, 1)        # B = WO Name
            c = safe(row, 2)        # C = amount / score
            f = safe(row, 5)        # F = FT assignee
            wos.append(f"{a} + {b} : {c} + {f}")
    except Exception as e:
        logger.error(f"get_wos: {e}")
    return wos


# ===================== MAIN LOOKUP =====================
def lookup_tni(tni: str) -> str:
    # Dùng HTML mode: escape nội dung động để tránh lỗi ký tự đặc biệt
    def e(s: str) -> str:
        return html.escape(str(s))

    lines = [f"🔍 <b>{e(tni)}</b>\n━━━━━━━━━━━━━━━━━━━━"]

    # Site info
    site_info = get_site_info(tni)
    if site_info:
        lines.append(f"\n📍 <b>Site Info</b>\n{e(site_info)}")

    # Tasks
    tasks = get_tasks(tni)
    lines.append(f"\n📋 <b>Task ({len(tasks)})</b>")
    if tasks:
        lines += [f"• {e(t)}" for t in tasks]
    else:
        lines.append("• No see")

    # WOs
    wos = get_wos(tni)
    lines.append(f"\n🔧 <b>WO ({len(wos)})</b>")
    if wos:
        lines += [f"• {e(w)}" for w in wos]
    else:
        lines.append("• No see")

    lines.append("━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)


MAX_LEN = 4096

def split_messages(text: str) -> list:
    """Tách text thành các chunk ≤ 4096 ký tự, cắt theo dòng."""
    chunks = []
    current = ""
    for line in text.split("\n"):
        candidate = (current + "\n" + line) if current else line
        if len(candidate) <= MAX_LEN:
            current = candidate
        else:
            if current:
                chunks.append(current)
            # Nếu 1 dòng đơn lẻ vẫn quá dài, cắt cứng
            while len(line) > MAX_LEN:
                chunks.append(line[:MAX_LEN])
                line = line[MAX_LEN:]
            current = line
    if current:
        chunks.append(current)
    return chunks


# ================================================================
#  DAILY REPORT — Thu thập báo cáo hàng ngày + công tác
# ================================================================

def fetch_daily_fields() -> list[str]:
    """Lấy danh sách field từ GAS (cached 10 phút)."""
    global _daily_fields, _daily_fields_ts
    now = time.time()
    if _daily_fields and (now - _daily_fields_ts) < DAILY_FIELDS_CACHE_SEC:
        return _daily_fields
    if not DAILY_APPS_SCRIPT_URL:
        return DAILY_FIELDS_DEFAULT
    try:
        resp = requests.get(
            DAILY_APPS_SCRIPT_URL + "?action=get_fields",
            timeout=15
        )
        data = resp.json()
        if data.get("status") == "ok" and data.get("fields"):
            _daily_fields    = data["fields"]
            _daily_fields_ts = now
            logger.info(f"📋 Daily fields loaded: {_daily_fields}")
            return _daily_fields
    except Exception as ex:
        logger.warning(f"⚠️ fetch_daily_fields: {ex}")
    return _daily_fields or DAILY_FIELDS_DEFAULT


def parse_daily_report(text: str, fields: list[str]) -> dict:
    """
    Parse nội dung người dùng gửi dạng 'Field: value'.
    Hỗ trợ nhiều dòng, ghép nội dung xuống dòng vào field trước.
    """
    result: dict[str, str] = {}
    cur_key: str | None = None
    cur_val: list[str]  = []

    def flush():
        if cur_key:
            result[cur_key] = " ".join(cur_val).strip()

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if ":" in line:
            colon  = line.index(":")
            label  = line[:colon].strip()
            val    = line[colon + 1:].strip()
            # Tìm field khớp (không phân biệt hoa thường)
            matched = None
            label_l = label.lower()
            
            # Nếu label chứa chữ "result" hoặc "daily", tự động khớp với "Daily report"
            if "result" in label_l or "daily" in label_l:
                for f in fields:
                    if f.lower() == "daily report":
                        matched = f
                        break
            
            if not matched:
                for f in fields:
                    f_l = f.lower()
                    if f_l in label_l or label_l in f_l:
                        matched = f
                        break
            if matched:
                flush()
                cur_key = matched
                cur_val = [val] if val else []
                continue
        # Dòng không khớp field → nối vào field trước
        if cur_key:
            cur_val.append(line)

    flush()
    return result


def is_daily_report(text: str) -> bool:
    """Có chữ 'daily' hoặc 'result' (không phân biệt hoa thường) là daily report."""
    text_l = text.lower()
    return "daily" in text_l or "result" in text_l


async def cmd_daily(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Lệnh /daily — Gửi mẫu báo cáo để nhân viên copy-paste."""
    fields = fetch_daily_fields()
    now_mm = datetime.now(TZ_MM)
    date_s = now_mm.strftime("%d/%m/%Y")

    lines = [f"Daily report: {date_s}"]
    for i, f in enumerate(fields[1:], start=1):
        lines.append(f"{i}. {f}:")
    template = "\n".join(lines)

    await update.message.reply_text(
        f"📋 *Mẫu Daily Report*\n"
        f"Nhấn copy → chỉnh sửa → gửi lại:\n\n"
        f"```\n{template}\n```",
        parse_mode="Markdown",
    )


async def submit_daily_report(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """
    Tự động nhận báo cáo khi tin nhắn chứa chữ 'daily'.
    Trả về True nếu đã xử lý.
    """
    text = update.message.text or ""
    if not is_daily_report(text):
        return False

    fields  = fetch_daily_fields()
    parsed  = parse_daily_report(text, fields)
    now_mm  = datetime.now(TZ_MM)
    user    = update.effective_user
    chat_id = update.effective_chat.id

    # Tự thêm ngày nếu chưa có
    if "Daily report" not in parsed:
        parsed["Daily report"] = now_mm.strftime("%d/%m/%Y")

    if not DAILY_APPS_SCRIPT_URL or DAILY_APPS_SCRIPT_URL.startswith("CHƯA"):
        await update.message.reply_text(
            "❌ Bot chưa cấu hình DAILY_APPS_SCRIPT_URL"
        )
        return True

    payload = {
        "action":      "daily_add",
        "telegram_id": str(user.id),
        "fields":      parsed,
    }
    try:
        resp   = requests.post(DAILY_APPS_SCRIPT_URL, json=payload, timeout=45)
        result = resp.json()
        if result.get("status") == "ok":
            name = result.get("name") or user.first_name or str(user.id)
            ref  = result.get("ref", "")
            _last_daily[chat_id] = time.time()   # lưu để attach ảnh
            ref_line = f" | REF:{ref}" if ref else ""
            await update.message.reply_text(
                f"✅ Đã lưu{ref_line} — {html.escape(str(name))}\n"
                f"📅 {now_mm.strftime('%d/%m/%Y %H:%M')}"
            )
        else:
            await update.message.reply_text(
                f"❌ Lỗi lưu\n{result.get('message', '')[:120]}"
            )
    except Exception as ex:
        logger.error(f"submit_daily_report: {ex}")
        await update.message.reply_text(f"❌ Lỗi kết nối\n{str(ex)[:80]}")

    return True


async def handle_daily_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Nhận ảnh trong vòng 60 phút sau khi gửi báo cáo → lưu Drive qua GAS."""
    chat_id = update.effective_chat.id
    last_ts = _last_daily.get(chat_id, 0)

    # Chỉ xử lý nếu trong vòng DAILY_PHOTO_WINDOW giây kể từ lần gửi báo cáo cuối
    if time.time() - last_ts > DAILY_PHOTO_WINDOW:
        return
    if not DAILY_APPS_SCRIPT_URL or DAILY_APPS_SCRIPT_URL.startswith("CHƯA"):
        return

    user  = update.effective_user
    photo = update.message.photo[-1]   # chất lượng cao nhất
    try:
        f       = await context.bot.get_file(photo.file_id)
        tg_url  = f"https://api.telegram.org/file/bot{TOKEN}/{f.file_path}"
        payload = {
            "action":      "daily_photo",
            "telegram_id": str(user.id),
            "tg_url":      tg_url,
        }
        resp   = requests.post(DAILY_APPS_SCRIPT_URL, json=payload, timeout=60)
        result = resp.json()
        _last_daily[chat_id] = time.time()   # gia hạn window
        await update.message.reply_text("📷 ✅" if result.get("status") == "ok" else "📷 ❌")
    except Exception as ex:
        logger.error(f"handle_daily_photo: {ex}")
        await update.message.reply_text("📷 ❌")


# ===================== BOT HANDLERS =====================
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()

    # ── 1. Daily report: tin nhắn có chữ "daily" → lưu sheet
    if is_daily_report(text):
        await submit_daily_report(update, context)
        return

    # ── 2. TNI Lookup (existing logic)
    m = re.search(r"(TNI\w+)", text, re.IGNORECASE)
    if not m:
        return
    tni      = m.group(1).upper()
    logger.info(f"Lookup: {tni}")
    wait_msg = await update.message.reply_text(
        f"⏳ Searching <b>{html.escape(tni)}</b>...", parse_mode="HTML"
    )
    try:
        reply  = lookup_tni(tni)
        chunks = split_messages(reply)
        # Sửa tin nhắn "đang tìm" thành chunk đầu tiên
        await wait_msg.edit_text(chunks[0], parse_mode="HTML")
        # Gửi các chunk còn lại (nếu tin nhắn quá dài)
        for chunk in chunks[1:]:
            await update.message.reply_text(chunk, parse_mode="HTML")

        # ── Ghi log tìm kiếm (fire & forget, không chờ) ──
        apps_url = os.getenv("APPS_SCRIPT_URL", "")
        if apps_url:
            user      = update.effective_user
            from datetime import datetime, timezone, timedelta
            now_mm    = datetime.now(timezone(timedelta(hours=6, minutes=30)))
            payload   = {
                "action":    "log_search",
                "user_name": user.full_name or user.first_name or str(user.id),
                "user_id":   str(user.id),
                "tni_code":  tni,
                "date":      now_mm.strftime("%d/%m/%Y"),
                "time":      now_mm.strftime("%H:%M"),
            }
            threading.Thread(
                target=lambda: requests.post(apps_url, json=payload, timeout=15),
                daemon=True,
            ).start()

    except Exception as err:
        logger.error(f"handle_message error [{tni}]: {err}")
        await wait_msg.edit_text(
            f"❌ <b>Error</b> – {html.escape(tni)}\n<i>{html.escape(str(err))}</i>",
            parse_mode="HTML",
        )


async def id_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Trả về tên + ID của chat hiện tại và lưu vào Google Sheet."""
    chat     = update.effective_chat
    user     = update.effective_user
    chat_id  = str(chat.id)
    title    = chat.title or chat.full_name or "Private"
    reg_by   = user.full_name or user.first_name or str(user.id)

    apps_url = os.getenv("APPS_SCRIPT_URL", "")
    saved    = False
    msg_extra = ""
    if apps_url:
        try:
            r = requests.post(apps_url, json={
                "action":     "register_chat",
                "chat_id":    chat_id,
                "chat_title": title,
                "chat_type":  chat.type,
                "reg_by":     reg_by,
            }, timeout=15)
            res = r.json()
            if res.get("status") == "ok":
                saved     = True
                msg_extra = "\n✅ Saved to <b>Chat IDs</b> sheet"
            elif res.get("status") == "duplicate":
                msg_extra = "\n⚠️ Already exists in sheet"
        except Exception as ex:
            logger.error(f"register_chat error: {ex}")

    await update.message.reply_text(
        f"💬 <b>{html.escape(title)}</b>\n"
        f"🔑 <code>{chat_id}</code>\n"
        f"📍 Type: {chat.type}"
        + msg_extra,
        parse_mode="HTML",
    )


async def myid_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Mỗi người tự gõ /myid → bot hiện ID cá nhân + lưu vào Config sheet."""
    user      = update.effective_user
    user_id   = str(user.id)
    full_name = user.full_name or user.first_name or "Unknown"

    apps_url  = os.getenv("APPS_SCRIPT_URL", "")
    msg_extra = ""
    if apps_url:
        try:
            r = requests.post(apps_url, json={
                "action":    "register_user",
                "user_id":   user_id,
                "user_name": full_name,
            }, timeout=15)
            res = r.json()
            if res.get("status") == "ok":
                msg_extra = "\n✅ Added to report list"
            elif res.get("status") == "duplicate":
                msg_extra = "\n⚠️ You are already in the list"
        except Exception as ex:
            logger.error(f"register_user error: {ex}")

    await update.message.reply_text(
        f"👤 <b>{html.escape(full_name)}</b>\n"
        f"🔑 ID: <code>{user_id}</code>"
        + msg_extra,
        parse_mode="HTML",
    )


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 <b>TNI Search Bot</b>\n\n"
        "📌 Type TNI code, e.g.: <code>TNI0154</code>\n\n"
        "Bot returns:\n"
        "• 📍 Site Info (alarm)\n"
        "• 📋 Pending Tasks\n"
        "• 🔧 Work Orders\n\n"
        "⚙️ /reload – Reload data\n"
        "⚙️ /help   – Help",
        parse_mode="HTML",
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📖 <b>Help</b>\n\n"
        "Type any TNI code, e.g.: <code>TNI0154</code>\n\n"
        "/reload – Reload data from Google Sheet",
        parse_mode="HTML",
    )


async def reload_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("⏳ Reloading data...")
    try:
        load_all_sheets()
        await update.message.reply_text(
            f"✅ <b>Reload successful!</b>\n"
            f"• Site: {max(0,len(df_site)-2)} sites\n"
            f"• Task: {max(0,len(df_task)-2)} tasks\n"
            f"• WO:   {max(0,len(df_wo)-3)} WOs",
            parse_mode="HTML",
        )
    except Exception as e:
        await update.message.reply_text(f"❌ Error: {html.escape(str(e))}",
                                        parse_mode="HTML")


# ===================== ENTRY POINT =====================
async def main():
    if not TOKEN:
        raise RuntimeError("Thieu TELEGRAM_TOKEN trong file .env!")

    load_all_sheets()

    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler("start",  start_command))
    app.add_handler(CommandHandler("help",   help_command))
    app.add_handler(CommandHandler("reload", reload_command))
    app.add_handler(CommandHandler("id",     id_command))
    app.add_handler(CommandHandler("myid",   myid_command))
    app.add_handler(CommandHandler("daily",  cmd_daily))        # Daily report
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND, handle_message
    ))
    app.add_handler(MessageHandler(
        filters.PHOTO, handle_daily_photo                        # Ảnh daily report
    ))

    logger.info("Bot TNI dang lang nghe...")
    async with app:
        await app.start()
        await app.updater.start_polling()
        logger.info("Bot ONLINE!")
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
