import os
import asyncio
import logging
import pandas as pd
from dotenv import load_dotenv
from telegram import Bot
from telegram.error import TelegramError

# ===================== CẤU HÌNH =====================
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

load_dotenv()

SEND_BOT_TOKEN      = os.getenv("SEND_BOT_TOKEN")       # Token bot GỬI TIN (bot mới)
TASK_REMAIN_CSV_URL = os.getenv("TASK_REMAIN_CSV_URL")  # URL CSV sheet "task remain"

# ===================== TÊN CỘT =====================
# Cột D = nội dung task (index 3 nếu không có header, hoặc dùng tên cột)
# Cột E = Chat ID Telegram của nhân viên (index 4)
COL_TASK_CONTENT = "Task Remain"   # <-- Đổi thành tên cột D trong sheet của bạn
COL_CHAT_ID      = "Chat ID"       # <-- Đổi thành tên cột E trong sheet của bạn

# ===================== ĐỌC SHEET =====================
def load_task_sheet() -> pd.DataFrame:
    """Tải dữ liệu từ sheet 'task remain'."""
    if not TASK_REMAIN_CSV_URL:
        raise RuntimeError(
            "Thiếu TASK_REMAIN_CSV_URL trong file .env!\n"
            "Publish sheet 'task remain' thành CSV và điền URL vào .env"
        )
    try:
        df = pd.read_csv(TASK_REMAIN_CSV_URL)
        logger.info(f"✅ Đã tải sheet – {len(df)} dòng dữ liệu.")
        logger.info(f"Các cột: {list(df.columns)}")
        return df
    except Exception as e:
        logger.error(f"❌ Lỗi khi tải sheet: {e}")
        raise

# ===================== GỬI TIN NHẮN =====================
async def send_to_all(df: pd.DataFrame):
    """Gửi tin nhắn đến từng nhân viên có dữ liệu trong sheet."""
    if not SEND_BOT_TOKEN:
        raise RuntimeError("Thiếu SEND_BOT_TOKEN trong file .env!")

    bot = Bot(token=SEND_BOT_TOKEN)

    success_count = 0
    fail_count    = 0

    for idx, row in df.iterrows():
        # Lấy nội dung task (Cột D)
        task_content = row.get(COL_TASK_CONTENT, "")
        # Lấy Chat ID (Cột E)
        chat_id_raw  = row.get(COL_CHAT_ID, "")

        # Bỏ qua dòng trống
        if pd.isna(task_content) or str(task_content).strip() == "":
            continue
        if pd.isna(chat_id_raw) or str(chat_id_raw).strip() == "":
            logger.warning(f"⚠️  Dòng {idx+2}: Không có Chat ID – bỏ qua.")
            continue

        chat_id = str(chat_id_raw).strip()
        # Nếu là số thập phân như 1234567.0 → chuyển thành int string
        if chat_id.endswith(".0"):
            chat_id = chat_id[:-2]

        message = (
            f"📋 *Nhắc việc còn tồn*\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"{task_content}\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"⏰ Vui lòng xử lý sớm nhé!"
        )

        try:
            await bot.send_message(
                chat_id=chat_id,
                text=message,
                parse_mode="Markdown"
            )
            logger.info(f"✅ Gửi thành công → {chat_id}: {str(task_content)[:40]}...")
            success_count += 1
        except TelegramError as e:
            logger.error(f"❌ Gửi thất bại → {chat_id}: {e}")
            fail_count += 1

        await asyncio.sleep(0.5)  # Tránh spam rate limit

    logger.info(f"\n📊 Kết quả: {success_count} thành công | {fail_count} thất bại")

# ===================== MAIN =====================
async def main():
    logger.info("🚀 Bắt đầu gửi task đến nhân viên...")
    df = load_task_sheet()

    if df.empty:
        logger.info("ℹ️  Sheet không có dữ liệu.")
        return

    # Nếu tên cột không khớp → dùng theo vị trí (cột D=index 3, cột E=index 4)
    cols = list(df.columns)
    if COL_TASK_CONTENT not in cols or COL_CHAT_ID not in cols:
        logger.warning(
            f"⚠️  Không tìm thấy cột '{COL_TASK_CONTENT}' hoặc '{COL_CHAT_ID}'.\n"
            f"   Tự động dùng cột theo vị trí: D (index 3) và E (index 4)."
        )
        if len(cols) >= 5:
            df = df.rename(columns={cols[3]: COL_TASK_CONTENT, cols[4]: COL_CHAT_ID})
        else:
            logger.error("❌ Sheet không đủ cột (cần ít nhất 5 cột A–E).")
            return

    await send_to_all(df)
    logger.info("✅ Hoàn tất!")


if __name__ == "__main__":
    asyncio.run(main())
