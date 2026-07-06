import os
import io
import asyncio
import logging
import requests
import pandas as pd
from datetime import datetime, timezone, timedelta
from telegram import Bot
from delete_old_helper import delete_old_messages_bot, save_msgids

# ===================== CẤU HÌNH =====================
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

SEND_BOT_TOKEN  = os.getenv("SEND_BOT_TOKEN")
APPS_SCRIPT_URL = os.getenv("APPS_SCRIPT_URL", "")
CONTROL_CHAT_ID = -5251698940

SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
    "/gviz/tq?tqx=out:csv&sheet=BOD+assign"
)

# Timezone Myanmar
TZ_MM = timezone(timedelta(hours=6, minutes=30))

# Trái tim màu cố định cho mỗi Dep (9 màu, đồng cỡ)
DEP_SQUARES = {
    "admin": "💙", "asset": "💚", "cm": "💛", "fbb": "🧡",
    "finance": "💜", "hr": "❤️", "m&e": "🤎", "manager": "🤍",
    "pm": "🖤", "transmission": "💙", "construction": "🧡",
    "construction projects": "🧡", "noc": "🖤", "technical": "💙",
}

def parse_date(val):
    if pd.isna(val):
        return None
    val_str = str(val).strip()
    if not val_str:
        return None
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            parts = val_str.split()
            if parts:
                return datetime.strptime(parts[0], "%d/%m/%Y").date()
        except Exception:
            pass
        try:
            return datetime.strptime(val_str, fmt).date()
        except Exception:
            pass
    return None

async def send_msg(bot: Bot, chat_id: int, text: str, label: str):
    """Gửi tin nhắn Telegram an toàn."""
    try:
        sent = await bot.send_message(chat_id=chat_id, text=text)
        logger.info(f"✅ Sent message to {chat_id} ({label})")
        return True, [sent.message_id]
    except Exception as e:
        logger.error(f"❌ Error sending message to {chat_id} ({label}): {e}")
        return False, []

async def main():
    if not SEND_BOT_TOKEN:
        logger.error("Missing SEND_BOT_TOKEN environment variable")
        return

    logger.info("🚀 Starting Daily BOD Assign Report...")
    
    # Tải dữ liệu từ sheet
    try:
        resp = requests.get(SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), header=None)
        logger.info(f"✅ Loaded sheet BOD assign: {len(df)} rows")
    except Exception as e:
        logger.error(f"❌ Error downloading BOD assign sheet: {e}")
        return

    if len(df) <= 1:
        logger.info("Sheet is empty or only has headers.")
        return

    # Dữ liệu từ hàng 1 trở đi (hàng 0 là tiêu đề)
    data_rows = df.iloc[1:]

    today = datetime.now(TZ_MM)
    d0 = today.date()
    d1 = (today - timedelta(days=1)).date()
    d2 = (today - timedelta(days=2)).date()
    d6_limit = (today - timedelta(days=6)).date()

    stats = {}

    for idx, row in data_rows.iterrows():
        # Đảm bảo hàng có đủ số cột
        if len(row) < 11:
            continue
            
        role_val = row[0]       # Cột A: Chức vụ/Phòng ban
        completed_val = row[7]  # Cột H: Dep update Date complete
        confirm_val = row[9]    # Cột J: Manager Confirm

        if pd.isna(role_val) or not str(role_val).strip():
            continue
        role = str(role_val).strip()

        # Bỏ qua các hàng tiêu đề phụ nếu có
        if role.lower() in ("nan", "", "assign admin", "chức vụ", "phòng ban"):
            continue

        if role not in stats:
            stats[role] = {
                "total_assigned": 0,
                "d0": 0, "d1": 0, "d2": 0,
                "d7": 0, "month": 0, "unconfirmed": 0
            }

        stats[role]["total_assigned"] += 1

        row_date = parse_date(completed_val)
        is_completed = row_date is not None
        is_confirmed = not pd.isna(confirm_val) and str(confirm_val).strip() != ""

        if is_completed:
            # Check 3 Day (d2/d1/d0)
            if row_date == d0:
                stats[role]["d0"] += 1
            elif row_date == d1:
                stats[role]["d1"] += 1
            elif row_date == d2:
                stats[role]["d2"] += 1

            # Check 7 Day
            if row_date >= d6_limit:
                stats[role]["d7"] += 1

            # Check Month
            if row_date.year == today.year and row_date.month == today.month:
                stats[role]["month"] += 1

            # Check Unconfirmed (cột H có ngày nhưng cột J trống)
            if not is_confirmed:
                stats[role]["unconfirmed"] += 1

    if not stats:
        logger.info("No records found with valid roles and completed dates.")
        return

    # Sắp xếp các phòng ban
    sorted_stats = sorted(stats.items())

    date_str = today.strftime("%d/%m/%Y")
    now_str = today.strftime("%H:%M")

    # Xây dựng tin nhắn báo cáo
    lines = [
        "📋 2. Report — Daily BOD Assign — Summary",
        f"📅 {date_str}  |  🕐 {now_str}",
        "📌 Compilation of BOD-assigned tasks completed and confirmation status by department.",
        "━━━━━━━━━━━━━━━━━━━━━━"
    ]

    total_assigned_all = total_d0 = total_d1 = total_d2 = total_d7 = total_month = total_unconfirmed = 0

    for i, (role, s) in enumerate(sorted_stats):
        dot = DEP_SQUARES.get(role.lower().strip(), "🔹")
        # Định dạng chuẩn theo yêu cầu:
        # Admin: Task assign : 10 = 3 day 0/0/0 7 day: 1 Month: 5 Not Yet Cofirm : 3 case
        lines.append(
            f"{dot} {role}: Task assign : {s['total_assigned']} = 3 day {s['d2']}/{s['d1']}/{s['d0']} "
            f"7 day: {s['d7']} Month: {s['month']} Not Yet Cofirm : {s['unconfirmed']} case"
        )
        
        total_assigned_all += s["total_assigned"]
        total_d0 += s["d0"]
        total_d1 += s["d1"]
        total_d2 += s["d2"]
        total_d7 += s["d7"]
        total_month += s["month"]
        total_unconfirmed += s["unconfirmed"]

    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    lines.append("📊 Total:")
    lines.append(
        f"   Task assign : {total_assigned_all} = 3 day {total_d2}/{total_d1}/{total_d0} "
        f"7 day: {total_d7} Month: {total_month} Not Yet Cofirm : {total_unconfirmed} case"
    )
    lines.append("━━━━━━━━━━━━━━━━━━━━━━")

    report_msg = "\n".join(lines)

    # Gửi tin nhắn lên CONTROL
    if APPS_SCRIPT_URL:
        delete_old_messages_bot(SEND_BOT_TOKEN, CONTROL_CHAT_ID, APPS_SCRIPT_URL, "BOD_ASSIGN_CONTROL")

    async with Bot(token=SEND_BOT_TOKEN) as bot:
        ok, msg_ids = await send_msg(bot, CONTROL_CHAT_ID, report_msg, "BOD_ASSIGN_CONTROL")
        if ok and msg_ids and APPS_SCRIPT_URL:
            save_msgids(APPS_SCRIPT_URL, "BOD_ASSIGN_CONTROL", msg_ids)

if __name__ == "__main__":
    asyncio.run(main())
