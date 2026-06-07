"""
cron_send.py — GitHub Actions Cron Job: gửi task remain + management report.
Dùng 3 bot theo dải row trong sheet Task remain (gid=133591305):
  Row 4-32:  @TNIREPORTTASK_BOT        (nhân viên)
  Row 33-59: SEND_BOT                  (team leaders)
  Row 60-74: SEND_BOT + compiled report (management)
  Row 75-87: @TNITECHINICALDEPREPORT_BOT (technical dept)
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
APPS_SCRIPT_URL         = os.getenv("APPS_SCRIPT_URL", "")

SPREADSHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
SHEET_URL = (
    f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}"
    "/gviz/tq?tqx=out:csv&gid=133591305&range=A1:E90"
)
TZ_MM = timezone(timedelta(hours=6, minutes=30))
HEADER_ROWS = 2
COL_A, COL_B, COL_C, COL_D, COL_E = 0, 1, 2, 3, 4


def safe(row, idx):
    try:
        v = row.iloc[idx]
        s = "" if pd.isna(v) else str(v).strip()
        return "" if s.lower() in ("nan", "none", "") else s
    except Exception:
        return ""


def call_apps_script(payload, timeout=30):
    """Call Apps Script and return JSON response."""
    if not APPS_SCRIPT_URL:
        return {}
    try:
        resp = requests.post(APPS_SCRIPT_URL, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error(f"Apps Script error: {e}")
        return {}


def get_asset_stats():
    """Get asset stats from Apps Script."""
    data = call_apps_script({"action": "get_asset_stats"}, timeout=120)
    if data.get("status") != "ok":
        logger.warning(f"get_asset_stats failed: {data.get('message', 'unknown')}")
        return {}
    return data


def get_report_data():
    """Get search stats from Apps Script (employees, leaders, teamSummary, grandTotal)."""
    data = call_apps_script({"action": "get_report_data"}, timeout=120)
    if data.get("status") != "ok":
        logger.warning(f"get_report_data failed: {data.get('message', 'unknown')}")
        return {}
    return data


def build_search_summary(now_str, report_data):
    """Build search stats summary with 3-day/7-day/month per team + grand total."""
    team_summary = report_data.get("teamSummary", [])
    grand = report_data.get("grandTotal", {})
    if not team_summary:
        return ""

    TEAM_SHORT = {
        "MYT_TNI_TEAM01_Dawei": "Team1(Dawei)",
        "MYT_TNI_TEAM02_Myeik": "Team2(Myeik)",
        "MYT_TNI_TEAM03_Bokpyin": "Team3(Bokpyin)",
        "MYT_TNI_TEAM04_Kawthoung": "Team4(Kawthoung)",
    }

    lines = [f"🔍 Search Stats – {now_str}"]
    for ts in team_summary:
        tm = TEAM_SHORT.get(ts.get("team", ""), ts.get("team", ""))
        lines.append(
            f"🏷️ {tm}: "
            f"3Day:{ts.get('d2',0)}/{ts.get('d1',0)}/{ts.get('today',0)} "
            f"7Day:{ts.get('week',0)} Month:{ts.get('month',0)}"
        )
    lines.append(
        f"📊 Total: "
        f"3Day:{grand.get('d2',0)}/{grand.get('d1',0)}/{grand.get('today',0)} "
        f"7Day:{grand.get('week',0)} Month:{grand.get('month',0)}"
    )
    return "\n".join(lines)


def build_asset_msg(now_str, asset_data):
    """Build compact asset stats message with 3-day/7-day/month."""
    if not asset_data.get("actionTypes"):
        return ""

    action_types = asset_data.get("actionTypes", [])
    teams = asset_data.get("teams", [])
    stats = asset_data.get("stats", {})
    grand = asset_data.get("grandTotal", {})

    TEAM_SHORT = {
        "MYT_TNI_TEAM01_Dawei": "Team1(Dawei)",
        "MYT_TNI_TEAM02_Myeik": "Team2(Myeik)",
        "MYT_TNI_TEAM03_Bokpyin": "Team3(Bokpyin)",
        "MYT_TNI_TEAM04_Kawthoung": "Team4(Kawthoung)",
    }

    def fmt(s):
        total = s.get("total", 0)
        done = s.get("done", 0)
        return f"{total} Done {done}"

    def fmt_period(s):
        return (
            f"3Day:{s.get('d0',0)}/{s.get('d1',0)}/{s.get('d2',0)} "
            f"7Day:{s.get('d6',0)} Month:{s.get('d15',0)}"
        )

    lines = [f"📦 Thống kê Asset – {now_str}"]

    for tm in teams:
        tm_short = TEAM_SHORT.get(tm, tm)
        parts = [f"{at}: {fmt(stats.get(at,{}).get(tm,{}))}" for at in action_types]
        lines.append(f"🏷️ {tm_short}: " + " | ".join(parts))
        # Period summary per team
        team_total = {"d0":0,"d1":0,"d2":0,"d6":0,"d15":0}
        for at in action_types:
            s = stats.get(at, {}).get(tm, {})
            for k in team_total:
                team_total[k] += s.get(k, 0)
        lines.append(f"   📅 {fmt_period(team_total)}")

    # Grand total
    parts = [f"{at}: {fmt(grand.get(at,{}))}" for at in action_types]
    lines.append(f"📊 Total: " + " | ".join(parts))

    # Grand period
    g_period = {"d0":0,"d1":0,"d2":0,"d6":0,"d15":0}
    for at in action_types:
        g = grand.get(at, {})
        for k in g_period:
            g_period[k] += g.get(k, 0)
    lines.append(f"📅 Total {fmt_period(g_period)}")

    return "\n".join(lines)


async def send_msg(bot, cid, text, label=""):
    """Send message, handle >4096 char limit.
    Splits by newlines first, then by MAX chars if a single line is too long.
    """
    MAX = 4000

    def chunk_text(t):
        """Split text into parts <= MAX chars, preserving newlines where possible."""
        parts, current = [], ""
        for line in t.split("\n"):
            # If a single line itself is too long, break it by char count
            while len(line) > MAX:
                segment = line[:MAX]
                if current:
                    parts.append(current)
                    current = ""
                parts.append(segment)
                line = line[MAX:]
            # Normal line
            if len(current) + len(line) + 1 > MAX:
                parts.append(current)
                current = line
            else:
                current += ("\n" if current else "") + line
        if current:
            parts.append(current)
        return parts

    try:
        if len(text) <= MAX:
            await bot.send_message(chat_id=cid, text=text)
        else:
            for p in chunk_text(text):
                if p.strip():
                    await bot.send_message(chat_id=cid, text=p)
                    await asyncio.sleep(0.3)
        logger.info(f"✅ {label} → {cid}")
        return True
    except Exception as e:
        logger.error(f"❌ {label} → {cid}: {e}")
        return False


async def main():
    now = datetime.now(TZ_MM)
    now_str = now.strftime("%d/%m/%Y %H:%M")
    logger.info(f"🚀 Cron send start – {now_str}")

    # ── 1. Read full sheet ──
    resp = requests.get(SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str, on_bad_lines="skip")
    logger.info(f"Sheet: {len(df)} total rows (including headers)")

    # ── 2. Collect team leader content + employee content ──
    team_leader_content = []
    all_rows = []  # (sheet_row, content, chat_id)

    for idx, row in df.iterrows():
        sheet_row = idx + 1  # 1-indexed
        if sheet_row <= HEADER_ROWS:
            continue  # skip headers

        content = safe(row, COL_D)
        cid_raw = safe(row, COL_E)
        col_c = safe(row, COL_C)
        col_b = safe(row, COL_B)

        cid = cid_raw[:-2] if cid_raw.endswith(".0") else cid_raw

        # Collect team leader content for management report
        if col_c and "team leader" in col_c.lower() and content:
            team_name = safe(row, COL_A) or col_b or "Unknown"
            team_leader_content.append({"team": team_name, "name": col_b, "content": content})

        if not cid or cid == "-" or not cid.lstrip("-").isdigit():
            continue

        all_rows.append((sheet_row, content, cid, col_c))

    # ── 3. Get asset stats for management report ──
    asset_data = get_asset_stats()
    asset_msg = build_asset_msg(now_str, asset_data)

    # ── 4. Get search stats for summaries ──
    report_data = get_report_data()
    search_msg = build_search_summary(now_str, report_data)

    # ── 5. Build management report ──
    mgmt_parts = [f"📊 Báo cáo tổng hợp – {now_str}", "━━━━━━━━━━━━━━━━━━━━"]

    # Asset stats
    if asset_msg:
        mgmt_parts.append(asset_msg)
        mgmt_parts.append("━━━━━━━━━━━━━━━━━━━━")

    # Search stats
    if search_msg:
        mgmt_parts.append(search_msg)
        mgmt_parts.append("━━━━━━━━━━━━━━━━━━━━")

    # Team leader reports
    if team_leader_content:
        mgmt_parts.append("👑 Team Leader Reports:")
        for tl in team_leader_content:
            short = tl["content"][:600] + "..." if len(tl["content"]) > 600 else tl["content"]
            mgmt_parts.append(f"\n🏷️ {tl['team']}:\n{short}")

    mgmt_report = "\n".join(mgmt_parts)

    # ── 6. Send messages ──
    ok = fail = 0

    # Group by bot token
    groups = {}  # token -> [(sheet_row, message, cid, label)]

    for sheet_row, content, cid, col_c in all_rows:
        # Determine bot token
        # NOTE: Rows 4-32 (nhân viên) dùng SEND_BOT vì nhân viên đã start SEND_BOT,
        #       không phải @TNIREPORTTASK. Dùng cùng bot với gửi thủ công.
        if 75 <= sheet_row <= 87 and TECHNICAL_DEP_BOT_TOKEN:
            token = TECHNICAL_DEP_BOT_TOKEN
            bot_label = "@TNITECHNICAL"
        elif SEND_BOT_TOKEN:
            token = SEND_BOT_TOKEN
            bot_label = "SEND_BOT"
        else:
            continue

        # Determine message content
        if 60 <= sheet_row <= 74:
            # Management rows: send compiled report (even if D is empty)
            msg = mgmt_report
        elif 75 <= sheet_row <= 87:
            # Technical dept: D content + asset stats + search stats summary
            parts = []
            if content:
                parts.append(
                    f"📋 ကျန်ရှိသောလုပ်ငန်းများ သတိပေးချက် – {now_str}\n"
                    f"━━━━━━━━━━━━━━━━━━━━\n"
                    f"{content}\n"
                    f"━━━━━━━━━━━━━━━━━━━━"
                )
            if asset_msg:
                parts.append(f"\n{asset_msg}")
            if search_msg:
                parts.append(f"\n{search_msg}")
            if parts:
                msg = "\n".join(parts)
            else:
                continue
        elif content:
            # Normal rows: send task reminder
            msg = (
                f"📋 ကျန်ရှိသောလုပ်ငန်းများ သတိပေးချက် – {now_str}\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"{content}\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"⏰ ကျေးဇူးပြု၍ အမြန်ဆောင်ရွက်ပေးပါ။"
            )
        else:
            continue  # skip rows with no content and not management

        groups.setdefault(token, []).append((sheet_row, msg, cid, bot_label))

    for token, items in groups.items():
        bot_name = items[0][3] if items else "BOT"
        logger.info(f"--- {bot_name}: {len(items)} messages ---")
        async with Bot(token=token) as bot:
            for sheet_row, msg, cid, label in items:
                result = await send_msg(bot, cid, msg, f"{label} row{sheet_row}")
                if result:
                    ok += 1
                else:
                    fail += 1
                await asyncio.sleep(0.4)

    logger.info(f"📊 Done: ✅{ok} | ❌{fail}")


if __name__ == "__main__":
    asyncio.run(main())
