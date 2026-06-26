"""
daily_plan_report.py
====================
Run at 17:30 Myanmar — collect "Daily Plan" messages from Team groups,
store in Google Sheet "Team leader assign Plan" tab with comparison data,
and send summary reports (3Day / 7Day / Month) to each team group + CONTROL.

Sheet: 1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y
Tab:   "Team leader assign Plan" (GID: 853981745)
  A = REF (auto DP-001)
  B = Date
  C = Team
  D = Daily Plan content (from Telegram)
  E = Daily Report results (from "Daily report and Bussiness" B:S)
  F = Comparison (Plan vs Actual)

Trigger: GitHub Actions daily_plan_report.yml at 16:30 UTC = 23:00 Myanmar
Uses: Telethon (read messages) + SEND_BOT (send reports) + Apps Script (sheet I/O)
"""

import asyncio
import io
import os
import re
import logging
from datetime import datetime, timezone, timedelta

import requests
import pandas as pd
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.messages import GetHistoryRequest
from telegram import Bot
from delete_old_helper import delete_old_messages_bot, save_msgids

# ── Logging ─────────────────────────────────────────────────────
logging.basicConfig(format="%(asctime)s %(levelname)s %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Config ──────────────────────────────────────────────────────
API_ID         = int(os.environ.get("TELEGRAM_API_ID", "0"))
API_HASH       = os.environ.get("TELEGRAM_API_HASH", "")
SESSION_STRING = os.environ.get("TELEGRAM_SESSION", "")
SEND_BOT_TOKEN = os.environ.get("SEND_BOT_TOKEN", "")
# Dùng APPS_SCRIPT_URL chung — doPost route "daily_*" → doPostDaily_
APPS_SCRIPT_URL = os.environ.get("APPS_SCRIPT_URL", "")

MYANMAR_TZ = timezone(timedelta(hours=6, minutes=30))

# ── Spreadsheet for Daily Report (cùng sheet với daily_report_collector.gs) ──
DAILY_SHEET_ID = "1C8hU8SXpOdq-v6z7iLGoqwDJmO9DYudZ3rhflb7LC8Y"
DAILY_REPORT_CSV = (
    f"https://docs.google.com/spreadsheets/d/{DAILY_SHEET_ID}"
    "/gviz/tq?tqx=out:csv&sheet=Daily+report+and+Bussiness"
)

# ── Telegram Groups ────────────────────────────────────────────
GROUPS = {
    "T1": -5180992881,   # TNI TEAM 1 (Dawei)
    "T2": -5188855349,   # TNI TEAM 2 (Myeik + Team5)
    "T3": -5183480727,   # TNI TEAM 3 (Bokpyin)
    "T4": -5238696719,   # TNI TEAM 4 (Kawthoung)
}
CONTROL_CHAT_ID = -5251698940

GROUP_NAMES = {
    "T1": "Team1 Dawei",
    "T2": "Team2 Myeik",
    "T3": "Team3 Bokpyin",
    "T4": "Team4 Kawthoung",
}

# Team number → group key  (dùng để map nhân viên)
# Lấy team từ sheet "Task remain" col A hoặc "ID Telegram" tab
TEAM_SHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8"
TEAM_SHEET_URL = (
    f"https://docs.google.com/spreadsheets/d/{TEAM_SHEET_ID}"
    "/export?format=csv&gid=133591305"
)

# ── Helpers ─────────────────────────────────────────────────────

def myanmar_now() -> datetime:
    return datetime.now(MYANMAR_TZ)


def is_daily_plan_msg(text: str) -> bool:
    """
    Nhận dạng tin plan linh hoạt:
    - Dòng đầu có chữ 'plan' (bất kỳ vị trí, case-insensitive)
    - Và có ngày tháng (dạng d/m/yyyy hoặc dd/mm/yyyy) ở BẤT KỲ chỗ trong tin
    Ví dụ hợp lệ: 'Team04 Plan ( 27/6/2026 )', 'Plan Team4 27/6/2026', 'Daily Plan: 26/06/2026'
    """
    if not text:
        return False
    first_line = text.strip().split("\n")[0].lower()
    has_plan_word = "plan" in first_line
    has_date = bool(re.search(r'\d{1,2}/\d{1,2}/\d{2,4}', text))
    return has_plan_word and has_date


def parse_daily_plan(text: str) -> dict | None:
    """
    Parse một tin plan (liệt linh hoạt) thành {date, team, content}.

    Các định dạng được hỗ trợ:
      Daily Plan: 26/06/2026          (cú pháp cũ)
      Team04 Plan ( 27/6/2026 )       (cú pháp mới)
      Plan Team4 27/6/2026            (bất kỳ thứ tự nào)
    """
    if not text:
        return None

    lines = text.strip().split("\n")
    if not lines:
        return None

    # Extract date: tìm ngày trong toàn bộ tin (flexible)
    date_str = ""
    date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', text)
    if date_match:
        date_str = date_match.group(1)
        # Chuẩn hoá thành dd/mm/yyyy nếu thiếu zero-padding
        parts = date_str.split("/")
        if len(parts) == 3:
            d, m, y = parts
            if len(y) == 2:
                y = "20" + y
            date_str = f"{d.zfill(2)}/{m.zfill(2)}/{y}"
    else:
        date_str = myanmar_now().strftime("%d/%m/%Y")

    # Extract team: tìm Team + số trong dòng đầu hoặc toàn bộ text
    team_str = ""
    team_line_idx = 0

    # Ưu tiên tìm trong dòng đầu (dạng 'Team04', 'Team 4', 'T4')
    team_match_first = re.search(
        r'\b(Team\s*0?([1-5]))', lines[0], re.IGNORECASE
    )
    if team_match_first:
        team_str = team_match_first.group(1).strip()
        team_line_idx = 0
    else:
        # Tìm trong các dòng tiếp theo
        for i, line in enumerate(lines[1:], start=1):
            team_match = re.match(r'^\s*(Team\s*0?[1-5])\s*$', line.strip(), re.IGNORECASE)
            if team_match:
                team_str = team_match.group(1).strip()
                team_line_idx = i
                break
        if not team_str:
            team_match2 = re.search(r'(Team\s*0?[1-5])', text, re.IGNORECASE)
            if team_match2:
                team_str = team_match2.group(1).strip()

    # Content: lấy mọi thứ sau dòng header (dòng đầu có 'plan')
    # Nếu team nằm dòng riêng (không phải dòng đầu), bỏ qua dòng đó luôn
    start_idx = max(1, team_line_idx + 1 if team_line_idx > 0 else 1)
    content_lines = []
    for i in range(start_idx, len(lines)):
        line = lines[i].strip()
        if not content_lines and not line:
            continue
        content_lines.append(lines[i])

    content = "\n".join(content_lines).strip()

    if not date_str and not team_str:
        return None

    return {
        "date": date_str,
        "team": team_str or "Unknown",
        "content": content or text,
    }


def normalize_team(team_str: str) -> str:
    """Normalize team string to group key (T1, T2, T3, T4)."""
    t = team_str.upper().replace(" ", "")
    if "1" in t: return "T1"
    if "2" in t: return "T2"
    if "5" in t: return "T2"  # Team 5 merged into Team 2
    if "3" in t: return "T3"
    if "4" in t: return "T4"
    return ""


def extract_tni_codes(text: str) -> set:
    """Extract all TNIxxxx site codes from text."""
    if not text:
        return set()
    return set(re.findall(r'TNI\d{3,5}(?:_\d+)?', text, re.IGNORECASE))


# ── Apps Script calls ───────────────────────────────────────────

def call_apps_script(payload: dict, timeout: int = 30) -> dict:
    """Call Apps Script and return JSON response."""
    if not APPS_SCRIPT_URL:
        logger.warning("APPS_SCRIPT_URL not set")
        return {}
    try:
        resp = requests.post(APPS_SCRIPT_URL, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error(f"Apps Script error: {e}")
        return {}


def store_daily_plan(date, team, content, daily_report="", comparison="") -> dict:
    """Store a daily plan entry in Google Sheet via Apps Script."""
    return call_apps_script({
        "action": "store_daily_plan",
        "date": date,
        "team": team,
        "content": content,
        "daily_report": daily_report,
        "comparison": comparison,
    }, timeout=30)


def get_daily_plans() -> list:
    """Get all daily plan entries from Google Sheet."""
    data = call_apps_script({"action": "get_daily_plans"}, timeout=60)
    if data.get("status") != "ok":
        logger.warning(f"get_daily_plans failed: {data.get('message', 'unknown')}")
        return []
    return data.get("plans", [])


def get_report_data() -> dict:
    """Get employee/leader stats từ Apps Script (rank, close%, WO remain, task close)."""
    data = call_apps_script({"action": "get_report_data"}, timeout=120)
    if data.get("status") != "ok":
        logger.warning(f"get_report_data failed: {data.get('message', 'unknown')}")
        return {}
    return data


def build_emp_compact_line(emp: dict) -> str:
    """
    Format gọn 1 dòng cho nhân viên:
      👤 Tin Maung Win: rank: 13 | Close: 4% <0/1/0> | WO remain: 24 | Task: 0:0/0/0
    """
    name      = emp.get("name", "?")
    rank      = emp.get("rank", 0)
    close_pct = emp.get("close_pct", 0)
    wo_d0     = emp.get("wo_d0", 0)
    wo_d1     = emp.get("wo_d1", 0)
    wo_d2     = emp.get("wo_d2", 0)
    wo_remain = emp.get("wo_remain", 0)
    assign_mo = emp.get("assign_month_close", 0)
    return (
        f"👤 {name}: rank:{rank} | Close:{close_pct}% "
        f"<{wo_d2}/{wo_d1}/{wo_d0}> | WO remain:{wo_remain} "
        f"| Task:{assign_mo}:{wo_d2}/{wo_d1}/{wo_d0}"
    )


# ── Daily Report data from Sheet ────────────────────────────────

def get_team_member_mapping() -> dict:
    """
    Read Team All Find sheet to map telegram_id → team group key.
    Returns: { "telegram_id_str": "T1" | "T2" | "T3" | "T4" }
    """
    mapping = {}
    try:
        resp = requests.get(TEAM_SHEET_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), header=None, dtype=str, on_bad_lines="skip")

        TEAM_PATTERNS = {
            "TEAM01": "T1", "TEAM 1": "T1", "TEAM1": "T1",
            "TEAM02": "T2", "TEAM 2": "T2", "TEAM2": "T2",
            "TEAM05": "T2", "TEAM 5": "T2", "TEAM5": "T2",
            "TEAM03": "T3", "TEAM 3": "T3", "TEAM3": "T3",
            "TEAM04": "T4", "TEAM 4": "T4", "TEAM4": "T4",
        }

        for idx in range(3, min(len(df), 59)):  # rows 4-59
            row = df.iloc[idx]
            col_a = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ""
            col_e = str(row.iloc[4]).strip() if not pd.isna(row.iloc[4]) else ""
            if col_a.lower() in ("nan", "none", ""): continue
            if col_e.lower() in ("nan", "none", ""): continue

            cid = col_e.replace(".0", "") if col_e.endswith(".0") else col_e
            team_str = col_a.upper()
            for pattern, gk in TEAM_PATTERNS.items():
                if pattern in team_str:
                    mapping[cid] = gk
                    break

        logger.info(f"  📋 Team mapping: {len(mapping)} members loaded")
    except Exception as e:
        logger.error(f"Team mapping error: {e}")
    return mapping


def get_daily_reports_from_sheet(target_date: str) -> dict:
    """
    Read "Daily report and Bussiness" tab B:S via CSV export.
    Returns: { "T1": [report_texts], "T2": [...], ... }

    target_date: DD/MM/YYYY format to filter by
    """
    team_reports = {"T1": [], "T2": [], "T3": [], "T4": []}

    try:
        # Get team member → team mapping
        team_map = get_team_member_mapping()

        # Read Daily report sheet
        resp = requests.get(DAILY_REPORT_CSV, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), header=0, dtype=str, on_bad_lines="skip")

        if df.empty:
            logger.info("  📭 Daily report sheet is empty")
            return team_reports

        logger.info(f"  📊 Daily report rows: {len(df)}")

        for idx, row in df.iterrows():
            # Col B (idx 0) = Tên nhân viên
            # Col C (idx 1) = Daily report (date)
            # Col D-Q (idx 2-15) = Data fields
            # Col R (idx 16) = Telegram ID
            # Col S (idx 17) = Tên nhân viên (formula)
            emp_name = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ""
            date_cell = str(row.iloc[1]).strip() if not pd.isna(row.iloc[1]) else ""
            tg_id = str(row.iloc[16]).strip() if len(row) > 16 and not pd.isna(row.iloc[16]) else ""

            if emp_name.lower() in ("nan", "none", ""): emp_name = ""
            if tg_id.lower() in ("nan", "none", ""): tg_id = ""

            # Filter by date
            if target_date and date_cell and target_date not in date_cell:
                continue

            # Determine team from telegram ID
            cid = tg_id.replace(".0", "") if tg_id.endswith(".0") else tg_id
            team_key = team_map.get(cid, "")

            if not team_key:
                continue

            # Build report text from all non-empty fields
            parts = [f"👤 {emp_name}:" if emp_name else ""]
            for col_idx in range(2, min(16, len(row))):
                val = str(row.iloc[col_idx]).strip() if not pd.isna(row.iloc[col_idx]) else ""
                if val and val.lower() not in ("nan", "none"):
                    header_name = df.columns[col_idx] if col_idx < len(df.columns) else f"Col{col_idx}"
                    parts.append(f"  {header_name}: {val}")

            report_text = "\n".join(p for p in parts if p)
            if report_text.strip():
                team_reports[team_key].append(report_text)

    except Exception as e:
        logger.error(f"Daily report read error: {e}")

    return team_reports


def build_comparison(plan_content: str, report_texts: list) -> dict:
    """
    Compare Daily Plan vs Daily Report.
    Extract TNI site codes from both, calculate done/remaining.
    Returns: { plan_count, done_count, remain_count, pct, missing_sites, comparison_text }
    """
    # Extract TNI codes from plan
    plan_codes = extract_tni_codes(plan_content)

    # Extract TNI codes from all reports
    report_all_text = "\n".join(report_texts)
    report_codes = extract_tni_codes(report_all_text)

    plan_count = len(plan_codes)
    if plan_count == 0:
        return {
            "plan_count": 0, "done_count": 0, "remain_count": 0, "pct": 0,
            "missing_sites": [], "comparison_text": "No stations in plan"
        }

    # Sites in plan that also appear in reports = done
    done_codes = plan_codes & report_codes
    missing_codes = plan_codes - report_codes
    done_count = len(done_codes)
    remain_count = len(missing_codes)
    pct = round(done_count / plan_count * 100) if plan_count > 0 else 0

    comp_lines = [
        f"📋 Plan: {plan_count} stations",
        f"✅ Done: {done_count} stations ({pct}%)",
        f"⏳ Remaining: {remain_count} stations",
    ]
    if missing_codes:
        comp_lines.append(f"Missing: {', '.join(sorted(missing_codes))}")

    return {
        "plan_count": plan_count,
        "done_count": done_count,
        "remain_count": remain_count,
        "pct": pct,
        "missing_sites": sorted(missing_codes),
        "comparison_text": "\n".join(comp_lines),
    }


# ── Telegram message scanning ──────────────────────────────────

async def scan_group_for_plans(client, chat_id: int, since_utc: datetime) -> list:
    """Scan a Telegram group for 'Daily Plan' messages since given UTC time."""
    plans = []
    try:
        history = await client(GetHistoryRequest(
            peer=chat_id, limit=200,
            offset_date=None, offset_id=0,
            max_id=0, min_id=0, add_offset=0, hash=0,
        ))
        for msg in history.messages:
            if msg.date < since_utc:
                break
            if msg.message and is_daily_plan_msg(msg.message):
                parsed = parse_daily_plan(msg.message)
                if parsed:
                    dt_mm = msg.date.astimezone(MYANMAR_TZ) if msg.date.tzinfo else \
                        msg.date.replace(tzinfo=timezone.utc).astimezone(MYANMAR_TZ)
                    parsed["msg_date"] = dt_mm
                    parsed["msg_id"] = msg.id
                    plans.append(parsed)
    except Exception as e:
        logger.error(f"Scan group {chat_id} error: {e}")
    return plans


# ── Stats building ─────────────────────────────────────────────

def parse_plan_date(date_str: str) -> datetime | None:
    """Parse DD/MM/YYYY date string to datetime."""
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.replace(tzinfo=MYANMAR_TZ)
        except ValueError:
            continue
    return None


def build_plan_stats(plans: list, team_filter: str = None) -> dict:
    """
    Build 3Day/7Day/Month stats from plan list.
    3Day format: d2/d1/d0 (day-before-yesterday/yesterday/today)
    """
    now = myanmar_now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    d1_start = today_start - timedelta(days=1)
    d2_start = today_start - timedelta(days=2)
    d7_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    stats = {"d0": 0, "d1": 0, "d2": 0, "d7": 0, "month": 0, "today_plans": []}

    for p in plans:
        if team_filter:
            plan_team = normalize_team(p.get("team", ""))
            if plan_team != team_filter:
                continue

        dt = parse_plan_date(p.get("date", ""))
        if not dt:
            continue

        plan_date = dt.replace(hour=0, minute=0, second=0, microsecond=0)

        if plan_date >= month_start:
            stats["month"] += 1
        if plan_date >= d7_start:
            stats["d7"] += 1
        if plan_date >= d2_start and plan_date < d1_start:
            stats["d2"] += 1
        elif plan_date >= d1_start and plan_date < today_start:
            stats["d1"] += 1
        elif plan_date >= today_start:
            stats["d0"] += 1
            stats["today_plans"].append(p)

    return stats


# ── Send message helper ────────────────────────────────────────

async def send_msg(bot, cid, text, label=""):
    """Send message with auto-split for >4096 chars. Returns (ok, msg_ids)."""
    MAX = 4000
    sent_ids = []  # collect message_id from each sent message

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

    try:
        if len(text) <= MAX:
            result = await bot.send_message(chat_id=cid, text=text)
            sent_ids.append(result.message_id)
        else:
            for p in chunk_text(text):
                if p.strip():
                    result = await bot.send_message(chat_id=cid, text=p)
                    sent_ids.append(result.message_id)
                    await asyncio.sleep(0.3)
        logger.info(f"✅ {label} → {cid}")
        return True, sent_ids
    except Exception as e:
        logger.error(f"❌ {label} → {cid}: {e}")
        return False, sent_ids


# ── Main ────────────────────────────────────────────────────────

async def main():
    now = myanmar_now()
    now_str = now.strftime("%d/%m/%Y %H:%M")
    date_str = now.strftime("%d/%m/%Y")
    logger.info(f"🚀 Daily Plan Report start – {now_str}")

    # ── Step 1: Scan Telegram groups for Daily Plan messages ──
    since_utc = (now - timedelta(days=2)).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).astimezone(timezone.utc)

    logger.info("📡 Scanning Telegram groups for Daily Plan messages...")

    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)
    all_today_plans = {}  # group_key -> list of parsed plans

    async with client:
        me = await client.get_me()
        logger.info(f"🔑 Logged in: @{me.username} ({me.first_name})")

        for group_key, chat_id in GROUPS.items():
            logger.info(f"  📡 Scanning {group_key} ({chat_id})...")
            plans = await scan_group_for_plans(client, chat_id, since_utc)
            logger.info(f"     Found {len(plans)} Daily Plan messages")

            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_plans = []
            for p in plans:
                dt = parse_plan_date(p.get("date", ""))
                if dt and dt.replace(hour=0, minute=0, second=0, microsecond=0) >= today_start:
                    today_plans.append(p)

            if today_plans:
                all_today_plans[group_key] = today_plans

            await asyncio.sleep(0.5)

    # ── Step 2: Get Daily Reports from Sheet for comparison ──
    logger.info("📖 Reading Daily Reports from sheet for comparison...")
    team_reports = get_daily_reports_from_sheet(date_str)
    for gk, reps in team_reports.items():
        logger.info(f"  {gk}: {len(reps)} report entries today")

    # ── Step 3: Build comparison + store in Sheet ──
    logger.info("📝 Storing plans with comparison in Sheet...")
    team_comparisons = {}  # group_key -> comparison dict
    stored_count = 0

    for group_key, plans in all_today_plans.items():
        for p in plans:
            # Build daily report text for col E
            reports = team_reports.get(group_key, [])
            daily_report_text = "\n\n".join(reports) if reports else ""

            # Build comparison for col F
            comp = build_comparison(p["content"], reports)
            team_comparisons[group_key] = comp

            result = store_daily_plan(
                p["date"], p["team"], p["content"],
                daily_report=daily_report_text,
                comparison=comp["comparison_text"],
            )
            if result.get("status") == "ok":
                dup = result.get("duplicate", False)
                logger.info(f"  {'⏭️ Updated' if dup else '✅ Stored'}: {p['date']} {p['team']} (REF: {result.get('ref', '?')})")
                if not dup:
                    stored_count += 1
            else:
                logger.warning(f"  ❌ Store failed: {result.get('message', 'unknown')}")

    logger.info(f"  📊 Stored {stored_count} new plans")

    # ── Step 4: Read all plans from Sheet for 3Day/7Day/Month stats ──
    logger.info("📖 Reading plan history from Sheet...")
    all_plans = get_daily_plans()
    logger.info(f"  📊 Total plans in sheet: {len(all_plans)}")

    # ── Step 4b: Get employee stats từ Apps Script ──
    logger.info("📊 Fetching employee stats (rank/close/WO remain)...")
    report_data = get_report_data()
    # Gom nhân viên theo team key
    team_emp_map: dict[str, list] = {}  # "T1"→[emp,...]
    for emp in report_data.get("employees", []):
        tk = emp.get("team", "")
        # Chuẩn hoá: MYT_TNI_TEAM01_Dawei → T1
        if "TEAM01" in tk.upper() or "TEAM1" in tk.upper(): tk = "T1"
        elif "TEAM02" in tk.upper() or "TEAM2" in tk.upper() or "TEAM05" in tk.upper() or "TEAM5" in tk.upper(): tk = "T2"
        elif "TEAM03" in tk.upper() or "TEAM3" in tk.upper(): tk = "T3"
        elif "TEAM04" in tk.upper() or "TEAM4" in tk.upper(): tk = "T4"
        if tk in ("T1","T2","T3","T4"):
            team_emp_map.setdefault(tk, []).append(emp)
    logger.info(f"  📋 Employees mapped: { {k: len(v) for k,v in team_emp_map.items()} }")

    # ── Step 5: Build and send reports ──
    if not SEND_BOT_TOKEN:
        logger.error("SEND_BOT_TOKEN not set — cannot send reports")
        return

    divider = "━" * 30
    sub_divider = "──────────"

    async with Bot(token=SEND_BOT_TOKEN) as bot:
        # ── 5a. Send per-team reports ──
        for group_key, chat_id in GROUPS.items():
            team_name = GROUP_NAMES.get(group_key, group_key)
            stats     = build_plan_stats(all_plans, team_filter=group_key)
            comp      = team_comparisons.get(group_key)
            emps      = team_emp_map.get(group_key, [])  # danh sách nhân viên

            lines = [
                f"📋 DAILY PLAN REPORT — {team_name}",
                f"📅 {date_str}  |  🕐 {now.strftime('%H:%M')}",
                divider,
                f"📊 Plan Stats: 3Day: {stats['d2']}/{stats['d1']}/{stats['d0']} "
                f"| 7Day: {stats['d7']} | Month: {stats['month']}",
            ]

            # ── Phần Team Leader: Plan + Plan vs Actual (chỉ vậy thôi) ──
            if stats["today_plans"]:
                lines.append("")
                lines.append("📝 Today's Plan:")
                lines.append(sub_divider)
                for tp in stats["today_plans"]:
                    lines.append(tp.get("content", ""))
                if comp and comp.get("plan_count", 0) > 0:
                    lines.append("")
                    lines.append("📊 Plan vs Actual:")
                    lines.append(comp["comparison_text"])
            else:
                lines.append("❌ No Daily Plan submitted today")

            # ── Phần nhân viên: chỉ rank / close% / WO remain / Task Close Month ──
            lines.append("")
            lines.append(sub_divider)
            if emps:
                lines.append(f"📋 Employee Stats ({len(emps)} members):")
                # Sắp xếp theo rank tăng dần (rank nhỏ = tốt hơn)
                sorted_emps = sorted(emps, key=lambda e: e.get("rank", 999))
                for emp in sorted_emps:
                    lines.append(build_emp_compact_line(emp))
            else:
                lines.append("❌ No employee stats available")

            lines.append(divider)

            msg = "\n".join(lines)
            delete_old_messages_bot(SEND_BOT_TOKEN, chat_id, APPS_SCRIPT_URL, f"PLAN_{group_key}")
            ok, msg_ids = await send_msg(bot, chat_id, msg, f"PLAN-{group_key}")
            if ok and msg_ids:
                save_msgids(APPS_SCRIPT_URL, f"PLAN_{group_key}", msg_ids)
            await asyncio.sleep(0.5)

        # ── 5b. Send consolidated report to CONTROL ──
        ctrl_lines = [
            f"📋 DAILY PLAN REPORT — Summary",
            f"📅 {date_str}  |  🕐 {now.strftime('%H:%M')}",
            divider,
        ]

        total_d0 = total_d1 = total_d2 = total_d7 = total_month = 0
        total_plan = total_done = total_remain = 0
        team_today_contents = []

        for group_key in ("T1", "T2", "T3", "T4"):
            team_name = GROUP_NAMES.get(group_key, group_key)
            stats = build_plan_stats(all_plans, team_filter=group_key)
            comp = team_comparisons.get(group_key)

            total_d0 += stats["d0"]
            total_d1 += stats["d1"]
            total_d2 += stats["d2"]
            total_d7 += stats["d7"]
            total_month += stats["month"]

            ctrl_lines.append(f"🏷️ {team_name}:")

            if comp and stats["d0"] > 0:
                ctrl_lines.append(
                    f"   Plan: {comp['plan_count']} | Done: {comp['done_count']} "
                    f"({comp['pct']}%) | Remain: {comp['remain_count']}"
                )
                total_plan += comp["plan_count"]
                total_done += comp["done_count"]
                total_remain += comp["remain_count"]
            elif stats["d0"] > 0:
                ctrl_lines.append("   ✅ Plan submitted today")
            else:
                ctrl_lines.append("   ❌ No plan today")

            ctrl_lines.append(
                f"   3Day: {stats['d2']}/{stats['d1']}/{stats['d0']} "
                f"| 7Day: {stats['d7']} | Month: {stats['month']}"
            )

            # Collect today's content
            if stats["today_plans"]:
                for tp in stats["today_plans"]:
                    team_today_contents.append((team_name, tp.get("content", "")))

        ctrl_lines.append(divider)

        # Grand totals
        total_pct = round(total_done / total_plan * 100) if total_plan > 0 else 0
        if total_plan > 0:
            ctrl_lines.append(
                f"📊 Total: Plan: {total_plan} | Done: {total_done} "
                f"({total_pct}%) | Remain: {total_remain}"
            )
        ctrl_lines.append(
            f"📊 3Day: {total_d2}/{total_d1}/{total_d0} "
            f"| 7Day: {total_d7} | Month: {total_month}"
        )

        # Today's plan contents
        if team_today_contents:
            ctrl_lines.append("")
            ctrl_lines.append("📝 Today's Plans:")
            for team_name, content in team_today_contents:
                ctrl_lines.append(sub_divider)
                ctrl_lines.append(f"🏷️ {team_name}:")
                ctrl_lines.append(content)

        ctrl_lines.append(divider)

        ctrl_msg = "\n".join(ctrl_lines)
        delete_old_messages_bot(SEND_BOT_TOKEN, CONTROL_CHAT_ID, APPS_SCRIPT_URL, "PLAN_CONTROL")
        ok, msg_ids = await send_msg(bot, CONTROL_CHAT_ID, ctrl_msg, "PLAN-CONTROL")
        if ok and msg_ids:
            save_msgids(APPS_SCRIPT_URL, "PLAN_CONTROL", msg_ids)

    logger.info(f"🎉 Daily Plan Report complete – {myanmar_now().strftime('%H:%M')}")


if __name__ == "__main__":
    asyncio.run(main())
