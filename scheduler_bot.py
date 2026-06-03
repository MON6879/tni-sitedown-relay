"""
Bot gửi thông báo task tự động lúc 17:30 (giờ VN, UTC+7) hàng ngày.
- Đọc dữ liệu từ Google Sheet Task Remain (cột D = nội dung, cột E = Chat ID)
- Bỏ qua 2 dòng header đầu
- Nếu trùng ID → vẫn gửi từng dòng riêng biệt
- Chạy 24/7 trên Render.com
"""

import os
import io
import asyncio
import logging
import pandas as pd
import requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from telegram import Bot
from telegram.error import TelegramError
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# ===================== CẤU HÌNH =====================
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)
load_dotenv()

SEND_BOT_TOKEN = os.getenv("SEND_BOT_TOKEN")
SHEET_GID      = "133591305"
SPREADSHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
SHEET_URL      = (
    f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}"
    f"/gviz/tq?tqx=out:csv&gid={SHEET_GID}"
)
SEND_HOUR   = int(os.getenv("SEND_HOUR",   "17"))
SEND_MINUTE = int(os.getenv("SEND_MINUTE", "30"))

# Vị trí cột (0-indexed): D=3, E=4
COL_CONTENT  = 3   # Cột D – nội dung task
COL_CHAT_ID  = 4   # Cột E – Chat ID Telegram
HEADER_ROWS  = 2   # Bỏ qua 2 dòng header đầu


# ===================== ĐỌC SHEET =====================
def load_sheet() -> pd.DataFrame:
    """Tải sheet Task Remain qua gviz/tq (không cần publish)."""
    try:
        resp = requests.get(
            SHEET_URL,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=30,
        )
        resp.raise_for_status()
        df = pd.read_csv(
            io.StringIO(resp.text),
            header=None,
            dtype=str,
            on_bad_lines="skip",
        )
        # Bỏ qua header rows
        df = df.iloc[HEADER_ROWS:].reset_index(drop=True)
        logger.info(f"✅ Tải sheet OK – {len(df)} dòng dữ liệu.")
        return df
    except Exception as e:
        logger.error(f"❌ Lỗi tải sheet: {e}")
        raise


def safe_val(row, col_idx: int) -> str:
    """Lấy giá trị an toàn theo index cột."""
    try:
        v = row.iloc[col_idx]
        s = "" if pd.isna(v) else str(v).strip()
        return "" if s.lower() in ("nan", "none", "") else s
    except Exception:
        return ""


# ===================== GỬI TIN NHẮN =====================
async def send_all_tasks():
    """Đọc sheet và gửi từng dòng đến Telegram."""
    now_vn = datetime.now(timezone(timedelta(hours=7))).strftime("%d/%m/%Y %H:%M")
    logger.info(f"🚀 Bắt đầu gửi – {now_vn}")

    if not SEND_BOT_TOKEN:
        logger.error("❌ Thiếu SEND_BOT_TOKEN!")
        return

    try:
        df = load_sheet()
    except Exception:
        logger.error("❌ Không thể tải sheet – bỏ qua lần gửi này.")
        return

    if df.empty:
        logger.info("ℹ️  Sheet trống – không có gì để gửi.")
        return

    if df.shape[1] <= max(COL_CONTENT, COL_CHAT_ID):
        logger.error(f"❌ Sheet chỉ có {df.shape[1]} cột, cần ít nhất {max(COL_CONTENT, COL_CHAT_ID)+1}!")
        return

    async with Bot(token=SEND_BOT_TOKEN) as bot:
        success, fail, skip = 0, 0, 0

        for idx, row in df.iterrows():
            content = safe_val(row, COL_CONTENT)
            chat_id_raw = safe_val(row, COL_CHAT_ID)

            # Bỏ qua dòng không có nội dung
            if not content:
                skip += 1
                continue

            # Bỏ qua dòng không có Chat ID
            if not chat_id_raw:
                logger.warning(f"⚠️  Dòng {idx + HEADER_ROWS + 1}: Thiếu Chat ID – bỏ qua.")
                skip += 1
                continue

            # Chuẩn hóa Chat ID (xử lý dạng 1234567.0)
            chat_id = chat_id_raw
            if chat_id.endswith(".0"):
                chat_id = chat_id[:-2]

            message = (
                f"📋 ကျန်ရှိသောလုပ်ငန်းများ သတိပေးချက် – {now_vn}\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"{content}\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"⏰ ကျေးဇူးပြု၍ အမြန်ဆောင်ရွက်ပေးပါ။"
            )

            try:
                await bot.send_message(
                    chat_id=chat_id,
                    text=message,
                )
                logger.info(f"✅ → {chat_id}: {content[:60]}...")
                success += 1
            except TelegramError as e:
                logger.error(f"❌ → {chat_id}: {e}")
                fail += 1

            await asyncio.sleep(0.4)   # Tránh Telegram rate limit

    logger.info(f"📊 Kết quả: ✅ {success} | ❌ {fail} | ⏭️ {skip} bỏ qua")


# ===================== SCHEDULER 24/7 =====================
async def main():
    if not SEND_BOT_TOKEN:
        raise RuntimeError("Thiếu SEND_BOT_TOKEN trong .env / biến môi trường!")

    scheduler = AsyncIOScheduler(timezone="Asia/Ho_Chi_Minh")
    scheduler.add_job(
        send_all_tasks,
        CronTrigger(
            hour=SEND_HOUR,
            minute=SEND_MINUTE,
            timezone="Asia/Ho_Chi_Minh",
        ),
        id="daily_task_notify",
        name=f"Gửi thông báo {SEND_HOUR:02d}:{SEND_MINUTE:02d} VN",
        replace_existing=True,
    )
    scheduler.start()

    next_run = scheduler.get_job("daily_task_notify").next_run_time
    logger.info("=" * 55)
    logger.info("🤖 Bot thông báo Task đang chạy 24/7")
    logger.info(f"⏰ Lịch gửi: {SEND_HOUR:02d}:{SEND_MINUTE:02d} hàng ngày (giờ VN)")
    logger.info(f"📅 Lần gửi tiếp theo: {next_run.strftime('%d/%m/%Y %H:%M %Z')}")
    logger.info("=" * 55)

    # Giữ tiến trình sống mãi
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
