"""
One-shot script: Đọc Google Sheet → Gửi thông báo Telegram.
Chạy bởi GitHub Actions lúc 17:30 VN mỗi ngày.
"""
import asyncio, io, logging, os
import pandas as pd
import requests
from datetime import datetime, timezone, timedelta
from telegram import Bot
from telegram.error import TelegramError
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

SEND_BOT_TOKEN = os.getenv("SEND_BOT_TOKEN")
SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
    "/gviz/tq?tqx=out:csv&gid=133591305"
)
TZ_VN       = timezone(timedelta(hours=7))
COL_CONTENT = 3
COL_CHAT_ID = 4
HEADER_ROWS = 2


def safe_val(row, idx):
    try:
        v = row.iloc[idx]
        s = "" if pd.isna(v) else str(v).strip()
        return "" if s.lower() in ("nan","none","") else s
    except Exception:
        return ""


async def main():
    if not SEND_BOT_TOKEN:
        raise RuntimeError("❌ Thiếu SEND_BOT_TOKEN trong GitHub Secrets!")

    now_vn = datetime.now(TZ_VN).strftime("%d/%m/%Y %H:%M")
    logger.info(f"🚀 Bắt đầu gửi – {now_vn}")

    resp = requests.get(SHEET_URL, headers={"User-Agent":"Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str, on_bad_lines="skip")
    df = df.iloc[HEADER_ROWS:].reset_index(drop=True)
    logger.info(f"✅ Tải sheet OK – {len(df)} dòng")

    async with Bot(token=SEND_BOT_TOKEN) as bot:
        success = fail = skip = 0
        for _, row in df.iterrows():
            content     = safe_val(row, COL_CONTENT)
            chat_id_raw = safe_val(row, COL_CHAT_ID)

            if not content or not chat_id_raw or chat_id_raw == "-":
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
                logger.info(f"✅ → {chat_id}: {content[:50]}")
                success += 1
            except TelegramError as e:
                logger.error(f"❌ → {chat_id}: {e}")
                fail += 1
            await asyncio.sleep(0.4)

    logger.info(f"📊 Kết quả: ✅{success} thành công | ❌{fail} lỗi | ⏭️{skip} bỏ qua")


if __name__ == "__main__":
    asyncio.run(main())
