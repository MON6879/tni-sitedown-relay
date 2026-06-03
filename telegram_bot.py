import os
import re
import io
import html
import asyncio
import logging
import requests
import pandas as pd
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


# ===================== BOT HANDLERS =====================
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    m    = re.search(r"(TNI\w+)", text, re.IGNORECASE)
    if not m:
        return
    tni      = m.group(1).upper()
    logger.info(f"Lookup: {tni}")
    wait_msg = await update.message.reply_text(
        f"⏳ Đang tìm <b>{html.escape(tni)}</b>...", parse_mode="HTML"
    )
    try:
        reply  = lookup_tni(tni)
        chunks = split_messages(reply)
        # Sửa tin nhắn "đang tìm" thành chunk đầu tiên
        await wait_msg.edit_text(chunks[0], parse_mode="HTML")
        # Gửi các chunk còn lại (nếu tin nhắn quá dài)
        for chunk in chunks[1:]:
            await update.message.reply_text(chunk, parse_mode="HTML")
    except Exception as err:
        logger.error(f"handle_message error [{tni}]: {err}")
        await wait_msg.edit_text(
            f"❌ <b>Fail</b> – {html.escape(tni)}\n<i>{html.escape(str(err))}</i>",
            parse_mode="HTML",
        )


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 <b>Bot tra cứu TNI</b>\n\n"
        "📌 Gõ mã TNI, ví dụ: <code>TNI0154</code>\n\n"
        "Bot trả về:\n"
        "• 📍 Site Info (alarm)\n"
        "• 📋 Task còn tồn\n"
        "• 🔧 Work Orders\n\n"
        "⚙️ /reload – Tải lại dữ liệu\n"
        "⚙️ /help   – Hướng dẫn",
        parse_mode="HTML",
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📖 <b>Hướng dẫn</b>\n\n"
        "Gõ mã TNI bất kỳ, ví dụ: <code>TNI0154</code>\n\n"
        "/reload – Tải lại dữ liệu từ Google Sheet",
        parse_mode="HTML",
    )


async def reload_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("⏳ Đang tải lại dữ liệu...")
    try:
        load_all_sheets()
        await update.message.reply_text(
            f"✅ <b>Tải lại thành công!</b>\n"
            f"• Site: {max(0,len(df_site)-2)} sites\n"
            f"• Task: {max(0,len(df_task)-2)} tasks\n"
            f"• WO:   {max(0,len(df_wo)-3)} WOs",
            parse_mode="HTML",
        )
    except Exception as e:
        await update.message.reply_text(f"❌ Lỗi: {html.escape(str(e))}",
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
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND, handle_message
    ))

    logger.info("Bot TNI dang lang nghe...")
    async with app:
        await app.start()
        await app.updater.start_polling()
        logger.info("Bot ONLINE!")
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
