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

# 2 bot gửi nhân viên theo dải row
# @TNIREPORTTASK_BOT → E4:E32 (row 4-32, offset from header=2 → data row 2-30)
REPORT_TASK_BOT_TOKEN    = os.getenv("REPORT_TASK_BOT_TOKEN", "")
# @TNITECHINICALDEPREPORT_BOT → E75:E87 (row 75-87)
TECHNICAL_DEP_BOT_TOKEN  = os.getenv("TECHNICAL_DEP_BOT_TOKEN", "")

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

    try:
        df = load_task_sheet()
    except Exception:
        return

    if df.empty:
        logger.info("[Scheduler] ℹ️ Sheet trống.")
        return

    # Build list of (sheet_row, content, chat_id)
    tasks = []
    for idx, row in df.iterrows():
        content     = safe_val(row, COL_CONTENT)
        chat_id_raw = safe_val(row, COL_CHAT_ID)
        if not content or not chat_id_raw or chat_id_raw == "-":
            continue
        chat_id = chat_id_raw[:-2] if chat_id_raw.endswith(".0") else chat_id_raw
        sheet_row = idx + HEADER_ROWS + 1  # convert df index → actual sheet row
        tasks.append((sheet_row, content, chat_id))

    # Group tasks by bot token based on sheet row
    # Row 4-32  → @TNIREPORTTASK_BOT
    # Row 33-74 → SEND_BOT_TOKEN (BOD/managers)
    # Row 75-87 → @TNITECHINICALDEPREPORT_BOT (Technical Dept — Gộp gửi lên nhóm CONTROL)
    groups = {}
    tech_messages = []
    for sheet_row, content, chat_id in tasks:
        if 75 <= sheet_row <= 87:
            tech_messages.append((sheet_row, content))
            continue

        # Bỏ gửi cá nhân cho các hàng từ 4 đến 74 theo yêu cầu của user
        # Số liệu đã được gửi trực tiếp vào các nhóm Team/CONTROL qua cron_send.py
        continue

    total_ok = total_fail = 0
    for token, items in groups.items():
        # Identify which bot
        if token == REPORT_TASK_BOT_TOKEN:
            bot_name = "@TNIREPORTTASK_BOT"
        elif token == TECHNICAL_DEP_BOT_TOKEN:
            bot_name = "@TNITECHINICALDEPREPORT_BOT"
        else:
            bot_name = "SEND_BOT"
        logger.info(f"[Scheduler] --- {bot_name}: {len(items)} messages ---")

        async with Bot(token=token) as bot:
            for sheet_row, content, chat_id in items:
                message = (
                    f"📋 ကျန်ရှိသောလုပ်ငန်းများ သတိပေးချက် – {now_vn}\n"
                    f"━━━━━━━━━━━━━━━━━━━━\n"
                    f"{content}\n"
                    f"━━━━━━━━━━━━━━━━━━━━\n"
                    f"⏰ ကျေးဇူးပြု၍ အမြန်ဆောင်ရွက်ပေးပါ။"
                )
                try:
                    await bot.send_message(chat_id=chat_id, text=message)
                    logger.info(f"[Scheduler] ✅ {bot_name} → row{sheet_row} ({chat_id})")
                    total_ok += 1
                except Exception as e:
                    logger.error(f"[Scheduler] ❌ {bot_name} → row{sheet_row} ({chat_id}): {e}")
                    total_fail += 1
                await asyncio.sleep(0.4)

    # ── Gửi tin nhắn gộp cho Technical Dept (rows 75-87) lên nhóm CONTROL (Xóa tin cũ) ──
    if tech_messages:
        tech_bot_token = TECHNICAL_DEP_BOT_TOKEN or SEND_BOT_TOKEN
        if tech_bot_token:
            tech_lines = [
                f"📋 4. Report — Technical Dept Task Progress",
                f"📅 {now_vn}",
                "━" * 22,
            ]
            for sheet_row, content in tech_messages:
                tech_lines.append(f"\n• Row {sheet_row}:")
                tech_lines.append(content)
            tech_msg = "\n".join(tech_lines)

            CONTROL_CHAT_ID = -5251698940
            APPS_SCRIPT_URL = os.getenv("APPS_SCRIPT_URL", "")

            # Xóa tin nhắn cũ trên CONTROL
            if APPS_SCRIPT_URL:
                try:
                    from delete_old_helper import delete_old_messages_bot, save_msgids
                    delete_old_messages_bot(tech_bot_token, CONTROL_CHAT_ID, APPS_SCRIPT_URL, "SCHEDULER_TECHDEP_CONTROL")
                except Exception as ex:
                    logger.warning(f"[Scheduler] Lỗi khi xóa tin nhắn Technical cũ: {ex}")

            # Gửi tin nhắn mới
            try:
                async with Bot(token=tech_bot_token) as bot:
                    sent = await bot.send_message(chat_id=CONTROL_CHAT_ID, text=tech_msg)
                    logger.info(f"[Scheduler] ✅ Gửi báo cáo gộp Technical Dept lên CONTROL")
                    if APPS_SCRIPT_URL:
                        save_msgids(APPS_SCRIPT_URL, "SCHEDULER_TECHDEP_CONTROL", [sent.message_id])
            except Exception as e:
                logger.error(f"[Scheduler] ❌ Lỗi gửi báo cáo gộp Technical Dept lên CONTROL: {e}")

    logger.info(f"[Scheduler] 📊 ✅{total_ok} | ❌{total_fail}")


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
