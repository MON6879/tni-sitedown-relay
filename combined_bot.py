"""
combined_bot.py — Chạy 2 bot trong 1 process duy nhất
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bot 1 (Scheduler): Gửi thông báo task tự động lúc 17:30 hàng ngày
Bot 2 (Collector): Nhận Order/Revoke/Export/Move từ nhân viên → Google Sheet
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os
import io
import asyncio
import logging
import re
import requests
import pandas as pd
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from telegram import Update, Bot
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# ===================== CẤU HÌNH =====================
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)
load_dotenv()

# Bot 1 — Scheduler
SEND_BOT_TOKEN = os.getenv("SEND_BOT_TOKEN")
SHEET_URL      = (
    "https://docs.google.com/spreadsheets/d/"
    "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
    "/gviz/tq?tqx=out:csv&gid=133591305"
)
SEND_HOUR   = int(os.getenv("SEND_HOUR",   "17"))
SEND_MINUTE = int(os.getenv("SEND_MINUTE", "30"))
COL_CONTENT = 3   # Cột D
COL_CHAT_ID = 4   # Cột E
HEADER_ROWS = 2

# Bot 2 — Collector
COLLECTOR_BOT_TOKEN = os.getenv("COLLECTOR_BOT_TOKEN")
APPS_SCRIPT_URL     = os.getenv("APPS_SCRIPT_URL")

# Timezone VN
TZ_VN = timezone(timedelta(hours=7))

# Cache keyword (collector)
_keyword_cache      = []
_keyword_cache_time = None
CACHE_SECONDS       = 300


# ══════════════════════════════════════════════════
#  BOT 1 — SCHEDULER: Gửi thông báo 17:30
# ══════════════════════════════════════════════════

def load_task_sheet() -> pd.DataFrame:
    try:
        resp = requests.get(SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str, on_bad_lines="skip")
        df = df.iloc[HEADER_ROWS:].reset_index(drop=True)
        logger.info(f"[Scheduler] ✅ Tải sheet OK – {len(df)} dòng")
        return df
    except Exception as e:
        logger.error(f"[Scheduler] ❌ Lỗi tải sheet: {e}")
        raise


def safe_val(row, idx: int) -> str:
    try:
        v = row.iloc[idx]
        s = "" if pd.isna(v) else str(v).strip()
        return "" if s.lower() in ("nan", "none", "") else s
    except Exception:
        return ""


async def send_all_tasks():
    now_vn = datetime.now(TZ_VN).strftime("%d/%m/%Y %H:%M")
    logger.info(f"[Scheduler] 🚀 Bắt đầu gửi – {now_vn}")

    if not SEND_BOT_TOKEN:
        logger.error("[Scheduler] ❌ Thiếu SEND_BOT_TOKEN!")
        return
    try:
        df = load_task_sheet()
    except Exception:
        return

    if df.empty:
        logger.info("[Scheduler] ℹ️ Sheet trống.")
        return

    async with Bot(token=SEND_BOT_TOKEN) as bot:
        success = fail = skip = 0
        for idx, row in df.iterrows():
            content     = safe_val(row, COL_CONTENT)
            chat_id_raw = safe_val(row, COL_CHAT_ID)

            if not content:
                skip += 1
                continue
            if not chat_id_raw or chat_id_raw == "-":
                skip += 1
                continue

            chat_id = chat_id_raw[:-2] if chat_id_raw.endswith(".0") else chat_id_raw
            message = (
                f"📋 ကျန်ရှိသောလုပ်ငန်းများ သတိပေးချက် – {now_vn}\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"{content}\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"⏰ ကျေးဇူးပြု၍ အမြန်ဆောင်ရွက်ပေးပါ။"
            )
            try:
                await bot.send_message(chat_id=chat_id, text=message)
                logger.info(f"[Scheduler] ✅ → {chat_id}: {content[:50]}")
                success += 1
            except Exception as e:
                logger.error(f"[Scheduler] ❌ → {chat_id}: {e}")
                fail += 1
            await asyncio.sleep(0.4)

    logger.info(f"[Scheduler] 📊 ✅{success} | ❌{fail} | ⏭️{skip}")


# ══════════════════════════════════════════════════
#  BOT 2 — COLLECTOR: Nhận dữ liệu từ nhân viên
# ══════════════════════════════════════════════════

def fetch_keywords() -> list:
    global _keyword_cache, _keyword_cache_time
    now = datetime.now(TZ_VN)
    if _keyword_cache and _keyword_cache_time:
        if (now - _keyword_cache_time).total_seconds() < CACHE_SECONDS:
            return _keyword_cache
    try:
        resp = requests.get(APPS_SCRIPT_URL, timeout=15)
        data = resp.json()
        if data.get("status") == "ok" and data.get("keywords"):
            _keyword_cache      = data["keywords"]
            _keyword_cache_time = now
            return _keyword_cache
    except Exception as e:
        logger.warning(f"[Collector] ⚠️ Không lấy được keywords: {e}")
    return _keyword_cache or ["Order", "Revoke", "Export", "Move"]


def parse_message(text: str, keywords: list) -> dict:
    result     = {}
    kw_pattern = "|".join(re.escape(k) for k in keywords) + "|done"
    pattern    = rf"({kw_pattern})\s*:\s*(.+?)(?=(?:{kw_pattern})\s*:|$)"
    matches    = re.findall(pattern, text, re.IGNORECASE | re.DOTALL)
    for key, value in matches:
        result[key.lower()] = value.strip()
    return result


def post_to_sheet(payload: dict) -> dict:
    if not APPS_SCRIPT_URL:
        return {"status": "error", "message": "Chưa cấu hình APPS_SCRIPT_URL"}
    try:
        resp = requests.post(APPS_SCRIPT_URL, json=payload, timeout=15)
        return resp.json()
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def col_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keywords = fetch_keywords()
    kw_lines = "\n".join(f"{kw}: ..." for kw in keywords)
    await update.message.reply_text(
        f"👋 *မင်္ဂလာပါ! ဒေတာစုဆောင်းရေး Bot*\n\n"
        f"📌 *ပေးပို့ပုံစံ:*\n```\n{kw_lines}\n```\n\n"
        f"✅ *ပြီးစီးကြောင်း အစီရင်ခံရန်:*\n"
        f"Bot ၏ အတည်ပြုချက်ကို Reply ပြု၍ `Done: ...` ပို့ပါ\n\n"
        f"⚡ မလိုအပ်သောကွက်ကို ချန်လှပ်နိုင်သည်။",
        parse_mode="Markdown",
    )


async def col_config(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global _keyword_cache_time
    _keyword_cache_time = None
    keywords = fetch_keywords()
    kw_list  = "\n".join(f"  • {kw}" for kw in keywords)
    await update.message.reply_text(
        f"⚙️ *Keyword hiện tại:*\n{kw_list}\n\n"
        f"📝 Sửa trong tab *Config* của Sheet → tự động áp dụng!",
        parse_mode="Markdown",
    )


async def col_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg      = update.message
    user     = msg.from_user
    text     = msg.text or ""
    now      = datetime.now(TZ_VN)
    keywords = fetch_keywords()

    sender_name = user.full_name or user.first_name or "Unknown"
    username    = f"@{user.username}" if user.username else str(user.id)

    # Reply Done
    if msg.reply_to_message and re.search(r"done\s*:", text, re.IGNORECASE):
        data         = parse_message(text, keywords)
        done_content = data.get("done", text.strip())
        orig         = msg.reply_to_message.text or ""
        ref_match    = re.search(r"#(\d+)", orig)
        ref_id       = ref_match.group(1) if ref_match else None

        result = post_to_sheet({
            "action":    "done",
            "ref_id":    ref_id,
            "done":      done_content,
            "done_date": now.strftime("%d/%m/%Y"),
            "done_time": now.strftime("%H:%M"),
            "chat_id":   str(user.id),
        })

        if result.get("status") == "ok":
            await msg.reply_text(
                f"✅ *#{ref_id} ပြီးစီးပြီ!*\n📝 {done_content}\n🕐 {now.strftime('%d/%m/%Y %H:%M')}",
                parse_mode="Markdown",
            )
        else:
            await msg.reply_text(f"⚠️ Error: `{result.get('message','')}`", parse_mode="Markdown")
        return

    # Tin nhắn thường
    data = parse_message(text, keywords)
    if not data:
        kw_lines = "\n".join(f"{kw}: ..." for kw in keywords)
        await msg.reply_text(
            f"❓ *မမှတ်မိပါ။*\n\nပုံစံ:\n```\n{kw_lines}\n```",
            parse_mode="Markdown",
        )
        return

    fields = {k: v for k, v in data.items() if k != "done"}
    result = post_to_sheet({
        "action":      "add",
        "date":        now.strftime("%d/%m/%Y"),
        "time":        now.strftime("%H:%M"),
        "sender_name": sender_name,
        "username":    username,
        "chat_id":     str(user.id),
        "fields":      fields,
    })

    if result.get("status") == "ok":
        ref_id = str(result.get("row", "???")).zfill(5)
        icons  = {"order":"📦","revoke":"↩️","export":"📤","move":"🚚",
                  "install":"🔧","check":"🔍","repair":"🛠️"}
        lines  = [f"✅ *လက်ခံပြီး — 🆔 #{ref_id}*\n📅 {now.strftime('%d/%m/%Y %H:%M')}\n"]
        for k, v in fields.items():
            if v:
                lines.append(f"{icons.get(k.lower(),'▪️')} {k.capitalize()}: {v}")
        lines.append("\n_Reply ပြု၍_ `Done: ...` _ပို့ပါ_")
        await msg.reply_text("\n".join(lines), parse_mode="Markdown")
    else:
        await msg.reply_text(f"❌ Error: `{result.get('message','')}`", parse_mode="Markdown")


# ══════════════════════════════════════════════════
#  MAIN — Chạy cả 2 bot song song
# ══════════════════════════════════════════════════

async def main():
    logger.info("=" * 55)
    logger.info("🚀 Khởi động Combined Bot (Scheduler + Collector)")
    logger.info("=" * 55)

    # ── Khởi tạo Scheduler ──
    scheduler = AsyncIOScheduler(timezone="Asia/Ho_Chi_Minh")
    scheduler.add_job(
        send_all_tasks,
        CronTrigger(hour=SEND_HOUR, minute=SEND_MINUTE, timezone="Asia/Ho_Chi_Minh"),
        id="daily_notify",
        replace_existing=True,
    )
    scheduler.start()
    next_run = scheduler.get_job("daily_notify").next_run_time
    logger.info(f"⏰ Scheduler: gửi lúc {SEND_HOUR:02d}:{SEND_MINUTE:02d} | Lần tới: {next_run.strftime('%d/%m/%Y %H:%M')}")

    # ── Khởi tạo Collector Bot ──
    keywords = fetch_keywords()
    logger.info(f"📋 Collector keywords: {keywords}")

    app = ApplicationBuilder().token(COLLECTOR_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start",  col_start))
    app.add_handler(CommandHandler("config", col_config))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, col_message))

    logger.info("✅ Cả 2 bot đang chạy 24/7!")
    logger.info("=" * 55)

    async with app:
        await app.start()
        await app.updater.start_polling()
        await asyncio.Event().wait()   # Chạy mãi mãi


if __name__ == "__main__":
    asyncio.run(main())
