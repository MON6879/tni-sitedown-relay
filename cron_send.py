"""
cron_send.py — Render Cron Job: gửi task remain 1 lần rồi thoát.
Dùng 3 bot theo dải row trong sheet Task remain (gid=133591305):
  Row 4-32:  @TNIREPORTTASK_BOT
  Row 33-74: SEND_BOT (BOD/managers)
  Row 75-87: @TNITECHINICALDEPREPORT_BOT
"""
import asyncio, io, logging, os, requests, pandas as pd
from datetime import datetime, timezone, timedelta
from telegram import Bot
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(format="%(asctime)s %(levelname)s %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

SEND_BOT_TOKEN          = os.getenv("SEND_BOT_TOKEN", "")
REPORT_TASK_BOT_TOKEN   = os.getenv("REPORT_TASK_BOT_TOKEN", "")
TECHNICAL_DEP_BOT_TOKEN = os.getenv("TECHNICAL_DEP_BOT_TOKEN", "")
SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
    "/gviz/tq?tqx=out:csv&gid=133591305"
)
TZ_MM = timezone(timedelta(hours=6, minutes=30))
HEADER_ROWS = 2
COL_CONTENT = 3  # D
COL_CHAT_ID = 4  # E


def safe(row, idx):
    try:
        v = row.iloc[idx]
        s = "" if pd.isna(v) else str(v).strip()
        return "" if s.lower() in ("nan", "none", "") else s
    except Exception:
        return ""


async def main():
    now = datetime.now(TZ_MM).strftime("%d/%m/%Y %H:%M")
    logger.info(f"🚀 Cron send start – {now}")

    resp = requests.get(SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str, on_bad_lines="skip")
    df = df.iloc[HEADER_ROWS:].reset_index(drop=True)
    logger.info(f"Sheet: {len(df)} rows")

    # Build tasks
    tasks = []
    for idx, row in df.iterrows():
        content = safe(row, COL_CONTENT)
        cid_raw = safe(row, COL_CHAT_ID)
        if not content or not cid_raw or cid_raw == "-":
            continue
        cid = cid_raw[:-2] if cid_raw.endswith(".0") else cid_raw
        sheet_row = idx + HEADER_ROWS + 1
        tasks.append((sheet_row, content, cid))

    # Group by bot
    groups = {}
    for sheet_row, content, cid in tasks:
        if 4 <= sheet_row <= 32 and REPORT_TASK_BOT_TOKEN:
            tok = REPORT_TASK_BOT_TOKEN
        elif 75 <= sheet_row <= 87 and TECHNICAL_DEP_BOT_TOKEN:
            tok = TECHNICAL_DEP_BOT_TOKEN
        elif SEND_BOT_TOKEN:
            tok = SEND_BOT_TOKEN
        else:
            continue
        groups.setdefault(tok, []).append((sheet_row, content, cid))

    ok = fail = 0
    for tok, items in groups.items():
        name = "@TNIREPORTTASK" if tok == REPORT_TASK_BOT_TOKEN \
            else "@TNITECHNICAL" if tok == TECHNICAL_DEP_BOT_TOKEN \
            else "SEND_BOT"
        logger.info(f"--- {name}: {len(items)} msgs ---")
        async with Bot(token=tok) as bot:
            for sr, content, cid in items:
                msg = (
                    f"📋 ကျန်ရှိသောလုပ်ငန်းများ သတိပေးချက် – {now}\n"
                    f"━━━━━━━━━━━━━━━━━━━━\n"
                    f"{content}\n"
                    f"━━━━━━━━━━━━━━━━━━━━\n"
                    f"⏰ ကျေးဇူးပြု၍ အမြန်ဆောင်ရွက်ပေးပါ။"
                )
                try:
                    await bot.send_message(chat_id=cid, text=msg)
                    logger.info(f"✅ {name} → row{sr} ({cid})")
                    ok += 1
                except Exception as e:
                    logger.error(f"❌ {name} → row{sr} ({cid}): {e}")
                    fail += 1
                await asyncio.sleep(0.4)

    logger.info(f"📊 Done: ✅{ok} | ❌{fail}")


if __name__ == "__main__":
    asyncio.run(main())
