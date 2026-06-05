"""
combined_bot.py — Scheduler Bot only
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Chỉ chạy Scheduler: Gửi thông báo task tự động lúc 17:30 hàng ngày.

⚠️ KHÔNG chạy Collector Bot ở đây!
   Collector Bot (@TNIASSETorderREQUEST_BOT) đã chạy qua
   Vercel webhook (api/collector.py).
   Nếu chạy polling ở đây sẽ XÓA webhook → bot collector chết.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os
import io
import asyncio
import logging
import requests
import pandas as pd
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from telegram import Bot
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# ===================== CẤU HÌNH =====================
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)
load_dotenv()

# Bot Scheduler — chỉ GỬI tin nhắn, không polling
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

# Timezone VN
TZ_VN = timezone(timedelta(hours=7))


# ══════════════════════════════════════════════════
#  SCHEDULER: Gửi thông báo 17:30
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
#  MAIN — Chỉ chạy Scheduler
# ══════════════════════════════════════════════════

async def main():
    logger.info("=" * 55)
    logger.info("🚀 Khởi động Scheduler Bot (chỉ gửi task 17:30)")
    logger.info("=" * 55)
    logger.info("ℹ️  Collector Bot chạy qua Vercel webhook — KHÔNG polling ở đây")

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
    logger.info("✅ Scheduler đang chạy 24/7!")
    logger.info("=" * 55)

    # Chạy mãi mãi — chờ APScheduler trigger
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
