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
from delete_old_helper import delete_old_messages_bot, save_msgids

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
    "/export?format=csv&gid=133591305"
)
SEND_HOUR   = int(os.getenv("SEND_HOUR",   "17"))
SEND_MINUTE = int(os.getenv("SEND_MINUTE", "30"))
COL_CONTENT = 3   # Cột D
COL_CHAT_ID = 4   # Cột E
HEADER_ROWS = 3

# 2 bot gửi nhân viên theo dải row
# @TNIREPORTTASK_BOT → E4:E32 (row 4-32, offset from header=2 → data row 2-30)
REPORT_TASK_BOT_TOKEN    = os.getenv("REPORT_TASK_BOT_TOKEN", "")
# @TNITECHINICALDEPREPORT_BOT → E75:E87 (row 75-87)
TECHNICAL_DEP_BOT_TOKEN  = os.getenv("TECHNICAL_DEP_BOT_TOKEN", "")

# Timezone Myanmar (UTC+6:30)
TZ_MM = timezone(timedelta(hours=6, minutes=30))

# Group Chat IDs của 4 team
TEAM_GROUPS = {
    "MYT_TNI_TEAM01_Dawei":     -5180992881,
    "MYT_TNI_TEAM02_Myeik":     -5188855349,
    "MYT_TNI_TEAM03_Bokpyin":   -5183480727,
    "MYT_TNI_TEAM04_Kawthoung": -5238696719,
}

def get_target_group(team_str: str):
    if not team_str: return None
    ts = team_str.upper()
    if "TEAM01" in ts or "TEAM 1" in ts or "TEAM1" in ts: return -5180992881
    if "TEAM02" in ts or "TEAM 2" in ts or "TEAM2" in ts or "TEAM05" in ts or "TEAM 5" in ts or "TEAM5" in ts: return -5188855349
    if "TEAM03" in ts or "TEAM 3" in ts or "TEAM3" in ts: return -5183480727
    if "TEAM04" in ts or "TEAM 4" in ts or "TEAM4" in ts: return -5238696719
    return None


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


async def send_msg(bot, cid, text, label=""):
    """Send message, handle >4096 char limit with retries."""
    MAX = 4000
    def chunk_text(t):
        parts, current = [], ""
        for line in t.split("\n"):
            while len(line) > MAX:
                segment = line[:MAX]
                if current:
                    parts.append(current)
                    current = ""
                parts.append(segment)
                line = line[MAX:]
            if len(current) + len(line) + 1 > MAX:
                parts.append(current)
                current = line
            else:
                current += ("\n" if current else "") + line
        if current:
            parts.append(current)
        return parts

    async def send_with_retry(chunk_text_p):
        for attempt in range(3):
            try:
                # Custom timeout to be more resilient
                sent = await bot.send_message(
                    chat_id=cid, 
                    text=chunk_text_p, 
                    read_timeout=20, 
                    write_timeout=20
                )
                return sent
            except Exception as e:
                if attempt == 2:
                    raise e
                logger.warning(f"[send_msg] Retrying {label} due to error: {e}")
                await asyncio.sleep(1.0)

    msg_ids = []
    try:
        if len(text) <= MAX:
            sent = await send_with_retry(text)
            msg_ids.append(sent.message_id)
        else:
            for p in chunk_text(text):
                if p.strip():
                    sent = await send_with_retry(p)
                    msg_ids.append(sent.message_id)
                    await asyncio.sleep(0.3)
        return True, msg_ids
    except Exception as e:
        logger.error(f"❌ {label} → {cid}: {e}")
        return False, msg_ids


async def send_all_tasks():
    now_mm = datetime.now(TZ_MM).strftime("%d/%m/%Y %H:%M")
    logger.info(f"[Scheduler] 🚀 Bắt đầu gửi – {now_mm}")

    try:
        df = load_task_sheet()
    except Exception:
        return

    if df.empty:
        logger.info("[Scheduler] ℹ️ Sheet trống.")
        return

    # Build list of (sheet_row, content, chat_id, team_val)
    tasks = []
    for idx, row in df.iterrows():
        content     = safe_val(row, COL_CONTENT)
        chat_id_raw = safe_val(row, COL_CHAT_ID)
        team_val    = safe_val(row, 0)  # Cột A
        sheet_row = idx + HEADER_ROWS + 1  # convert df index → actual sheet row
        if not content:
            continue
        chat_id = chat_id_raw[:-2] if chat_id_raw.endswith(".0") else chat_id_raw
        tasks.append((sheet_row, content, chat_id, team_val))

    # Group tasks by role/row range
    emp_by_team = {}  # target_gid -> list of (sheet_row, content)
    mgmt_messages = []
    tech_messages = []
    for sheet_row, content, chat_id, team_val in tasks:
        if 4 <= sheet_row <= 32:
            target_gid = get_target_group(team_val)
            if target_gid:
                emp_by_team.setdefault(target_gid, []).append((sheet_row, content))
        elif 33 <= sheet_row <= 74:
            mgmt_messages.append((sheet_row, content))
        elif 75 <= sheet_row <= 87:
            tech_messages.append((sheet_row, content))

    CONTROL_CHAT_ID = -5251698940
    APPS_SCRIPT_URL = os.getenv("APPS_SCRIPT_URL", "")

    # ── Gửi tin nhắn gộp cho Technical Dept (rows 75-87) lên nhóm CONTROL ──
    if tech_messages and SEND_BOT_TOKEN:
        tech_lines = [
            f"📋 1. Report — Technical Dept Task Progress",
            f"📅 {now_mm}",
            "━" * 22,
        ]
        for sheet_row, content in tech_messages:
            tech_lines.append(f"\n• Row {sheet_row}:")
            tech_lines.append(content)
        tech_msg = "\n".join(tech_lines)

        if APPS_SCRIPT_URL:
            delete_old_messages_bot(SEND_BOT_TOKEN, CONTROL_CHAT_ID, APPS_SCRIPT_URL, "SCHEDULER_TECHDEP_CONTROL")
        try:
            async with Bot(token=SEND_BOT_TOKEN) as bot:
                success, msg_ids = await send_msg(bot, CONTROL_CHAT_ID, tech_msg, "Technical")
                logger.info(f"[Scheduler] ✅ Gửi báo cáo gộp Technical Dept lên CONTROL")
                if success and msg_ids and APPS_SCRIPT_URL:
                    save_msgids(APPS_SCRIPT_URL, "SCHEDULER_TECHDEP_CONTROL", msg_ids)
        except Exception as e:
            logger.error(f"[Scheduler] ❌ Lỗi gửi báo cáo gộp Technical Dept lên CONTROL: {e}")

    # ── Gửi tin nhắn gộp cho Employees (rows 4-32) về từng nhóm Team ──
    # Xóa tin cũ trên CONTROL (dọn dẹp một lần)
    if APPS_SCRIPT_URL and SEND_BOT_TOKEN:
        delete_old_messages_bot(SEND_BOT_TOKEN, CONTROL_CHAT_ID, APPS_SCRIPT_URL, "SCHEDULER_EMP_CONTROL")

    if emp_by_team and SEND_BOT_TOKEN:
        TEAM_CLEAN_NAMES = {
            -5180992881: "Team 1 Dawei",
            -5188855349: "Team 2 Myeik",
            -5183480727: "Team 3 Bokpyin",
            -5238696719: "Team 4 Kawthoung",
        }
        EMP_CHATID_TO_KEY = {
            "-5180992881": "SCHEDULER_EMP_T1",
            "-5188855349": "SCHEDULER_EMP_T2",
            "-5183480727": "SCHEDULER_EMP_T3",
            "-5238696719": "SCHEDULER_EMP_T4",
        }

        async with Bot(token=SEND_BOT_TOKEN) as bot:
            for gid, messages in emp_by_team.items():
                t_name = TEAM_CLEAN_NAMES.get(gid, f"Team {gid}")
                emp_lines = [
                    f"📋 3. Report — Employees Task Progress — {t_name}",
                    f"📅 {now_mm}",
                    "━" * 22,
                ]
                for sheet_row, content in messages:
                    emp_lines.append(f"\n• Row {sheet_row}:")
                    emp_lines.append(content)
                emp_msg = "\n".join(emp_lines)

                gas_key = EMP_CHATID_TO_KEY.get(str(gid))
                if APPS_SCRIPT_URL and gas_key:
                    delete_old_messages_bot(SEND_BOT_TOKEN, gid, APPS_SCRIPT_URL, gas_key)

                try:
                    success, msg_ids = await send_msg(bot, gid, emp_msg, f"Employees {t_name}")
                    logger.info(f"[Scheduler] ✅ Gửi báo cáo gộp Employees lên nhóm {t_name}")
                    if success and msg_ids and APPS_SCRIPT_URL and gas_key:
                        save_msgids(APPS_SCRIPT_URL, gas_key, msg_ids)
                except Exception as e:
                    logger.error(f"[Scheduler] ❌ Lỗi gửi báo cáo gộp Employees lên nhóm {t_name}: {e}")

    # ── Gửi tin nhắn gộp cho Management (rows 33-74) lên nhóm CONTROL ──
    if mgmt_messages and SEND_BOT_TOKEN:
        mgmt_lines = [
            f"📋 7. Report — Management Task Progress",
            f"📅 {now_mm}",
            "━" * 22,
        ]
        for sheet_row, content in mgmt_messages:
            mgmt_lines.append(f"\n• Row {sheet_row}:")
            mgmt_lines.append(content)
        mgmt_msg = "\n".join(mgmt_lines)

        if APPS_SCRIPT_URL:
            delete_old_messages_bot(SEND_BOT_TOKEN, CONTROL_CHAT_ID, APPS_SCRIPT_URL, "SCHEDULER_MGMT_CONTROL")
        try:
            async with Bot(token=SEND_BOT_TOKEN) as bot:
                success, msg_ids = await send_msg(bot, CONTROL_CHAT_ID, mgmt_msg, "Management")
                logger.info(f"[Scheduler] ✅ Gửi báo cáo gộp Management lên CONTROL")
                if success and msg_ids and APPS_SCRIPT_URL:
                    save_msgids(APPS_SCRIPT_URL, "SCHEDULER_MGMT_CONTROL", msg_ids)
        except Exception as e:
            logger.error(f"[Scheduler] ❌ Lỗi gửi báo cáo gộp Management lên CONTROL: {e}")


# ══════════════════════════════════════════════════
#  MAIN — Chỉ chạy Scheduler
# ══════════════════════════════════════════════════

async def main():
    logger.info("=" * 55)
    logger.info("🚀 Khởi động Scheduler Bot (gửi lúc 17:30 giờ Myanmar)")
    logger.info("=" * 55)
    logger.info("ℹ️  Collector Bot chạy qua Vercel webhook — KHÔNG polling ở đây")

    # ── Khởi tạo Scheduler ──
    # Dùng múi giờ Myanmar (Asia/Yangon) để trigger đúng 17:30 giờ Myanmar
    scheduler = AsyncIOScheduler(timezone="Asia/Yangon")
    scheduler.add_job(
        send_all_tasks,
        CronTrigger(hour=SEND_HOUR, minute=SEND_MINUTE, timezone="Asia/Yangon"),
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
