"""
cron_send.py — GitHub Actions Cron Job: gửi task remain + management report.
Dùng 3 bot theo dải row trong sheet Task remain (gid=133591305):
  Row 4-32:  @TNIREPORTTASK_BOT        (nhân viên)
  Row 33-59: SEND_BOT                  (team leaders)
  Row 60-74: SEND_BOT + compiled report (management)
  Row 75-87: @TNITECHINICALDEPREPORT_BOT (technical dept)
"""
import asyncio, io, logging, os, re, requests, pandas as pd
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
# Dùng export CSV trực tiếp thay vì gviz/tq để giữ đúng số hàng (bao gồm hàng trống)
SHEET_URL = (
    f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}"
    "/export?format=csv&gid=133591305"
)
TZ_MM = timezone(timedelta(hours=6, minutes=30))
HEADER_ROWS = 3  # rows 1-3 là header (row 3 có 'export sms')
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


INPUT_TASK_URL = (
    f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}"
    "/gviz/tq?tqx=out:csv&gid=1755404595"
)


def get_input_task_summary() -> str:
    """
    Đọc sheet Input task (gid=1755404595) và tổng hợp theo từng Dep:
      Col B = Dep assign (Admin/Asset/CM/M&E/PM/Finance/Transmission)
      Col J = Team leader update Date complete (đã hoàn thành nếu không trống)
    Kết quả: mỗi Dep hiển thị Total | Done | Remain
    """
    try:
        resp = requests.get(
            INPUT_TASK_URL,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=20,
        )
        resp.raise_for_status()
        df = pd.read_csv(
            io.StringIO(resp.text),
            header=0,  # dòng 1 là header
            dtype=str,
            on_bad_lines="skip",
        )
        # Cột B = index 1, Cột J = index 9
        COL_DEP = 1
        COL_DONE = 9
        stats = {}  # dep -> {"total": int, "done": int}
        for _, row in df.iterrows():
            dep = str(row.iloc[COL_DEP]).strip() if not pd.isna(row.iloc[COL_DEP]) else ""
            if not dep or dep.lower() in ("", "nan", "dep assign", "sum"):
                continue
            done_val = str(row.iloc[COL_DONE]).strip() if not pd.isna(row.iloc[COL_DONE]) else ""
            is_done = done_val not in ("", "nan", "0", "-")
            if dep not in stats:
                stats[dep] = {"total": 0, "done": 0}
            stats[dep]["total"] += 1
            if is_done:
                stats[dep]["done"] += 1

        if not stats:
            return ""

        lines = ["📋 Input Task theo Dep:"]
        grand_total = grand_done = 0
        for dep, s in sorted(stats.items()):
            t, d = s["total"], s["done"]
            r = t - d
            grand_total += t
            grand_done += d
            lines.append(f"  • {dep}: ✅{d}/{t} | ⏳Remain:{r}")
        lines.append(f"  → Tổng: ✅{grand_done}/{grand_total} | ⏳{grand_total - grand_done}")
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"get_input_task_summary failed: {e}")
        return ""


def build_asset_progress_summary(content: str) -> str:
    """
    Chèn dòng tổng hợp ngay SAU header section (vd: "CM 06/06/2026").

    Input (cú pháp cũ):
      CM 06/06/2026
      Team 01
      Request Export material : total : 28  Progress 3 day: 0/0/0, 7 day: 0, Month: 0
      Team 02
      Request Export material : total : 14  Progress 3 day: 0/0/0, 7 day: 0, Month: 0
      ...

    Output:
      CM 06/06/2026
      📊 Tổng: Total:61 | 3day:0/0/0 | 7day:0 | Month:0
      Team 01
      Request Export material : total : 28  Progress 3 day: 0/0/0, 7 day: 0, Month: 0
      ...
    """
    # Pattern nhận biết dòng data có số liệu: "total : X  Progress 3 day: a/b/c, 7 day: d, Month: e"
    data_pat = re.compile(
        r'total\s*:\s*(\d+).*?3\s*day\s*:\s*(\d+)/(\d+)/(\d+).*?7\s*day\s*:\s*(\d+).*?Month\s*:\s*(\d+)',
        re.IGNORECASE,
    )
    # Pattern nhận biết header section: dòng có dạng "WordWord DD/MM/YYYY"
    header_pat = re.compile(
        r'^([A-Za-z&/]+(?:\s[A-Za-z&/]+)?)\s+\d{2}/\d{2}/\d{4}\s*$',
        re.MULTILINE,
    )

    lines = content.splitlines()
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if header_pat.match(line.strip()):
            # Đây là header section → tính tổng cho toàn bộ section phía dưới
            result.append(line)
            # Gom các dòng dữ liệu của section này (đến header tiếp theo hoặc hết)
            j = i + 1
            section_lines = []
            while j < len(lines):
                if header_pat.match(lines[j].strip()):
                    break
                section_lines.append(lines[j])
                j += 1
            # Tính tổng
            t_total = d3a = d3b = d3c = d7 = d_month = 0
            for sl in section_lines:
                m = data_pat.search(sl)
                if m:
                    t_total  += int(m.group(1))
                    d3a      += int(m.group(2))
                    d3b      += int(m.group(3))
                    d3c      += int(m.group(4))
                    d7       += int(m.group(5))
                    d_month  += int(m.group(6))
            if t_total > 0 or d7 > 0 or d_month > 0:
                result.append(
                    f"📊 Tổng: Total:{t_total} | 3day:{d3a}/{d3b}/{d3c} | 7day:{d7} | Month:{d_month}"
                )
            # Thêm các dòng section vào kết quả
            result.extend(section_lines)
            i = j
        else:
            result.append(line)
            i += 1

    return "\n".join(result)


def build_summary_header(content: str) -> str:
    """
    Phân tích nội dung cột D và tạo dòng tổng hợp đầu tin nhắn:
    Mỗi nhân viên hiển thị: Tên | 3day | 7day | Month

    Format mẫu trong content:
      *Họ Tên-myt_username*: 7-day results: *X* M: X /26 ...
      Month Xday :Y /Close 7day: Z <=> rank: *R* =Close: *P% <a/b/c>
    """
    lines = []
    # Mỗi nhân viên bắt đầu bằng *Tên-myt_...*:
    # Tách block bằng pattern *<OTHER>*
    blocks = re.split(r'\*<OTHER>\*', content)
    for block in blocks:
        # Tên: lấy phần trước dấu `-myt_` trong `*...-myt_...*:`
        name_m = re.search(r'\*([^*]+?)-myt_[^*]+\*:', block)
        if not name_m:
            continue
        name = name_m.group(1).strip()
        # 7-day close: `Close 7day: X`
        d7_m = re.search(r'Close 7day:\s*(\d+)', block)
        d7 = d7_m.group(1) if d7_m else "?"
        # Month close: `Month Xday :Y` -> Y là số trước `/Close`
        month_m = re.search(r'Month \d+day\s*:(\d+)\s*/Close', block)
        month = month_m.group(1) if month_m else "?"
        # 3-day: `<a/b/c>` (3 số trong ngoặc nhọn sau Close%)
        d3_m = re.search(r'Close:\s*\*?\d+%?\*?\s*<(\d+)/(\d+)/(\d+)>', block)
        if d3_m:
            d3 = f"{d3_m.group(1)}/{d3_m.group(2)}/{d3_m.group(3)}"
        else:
            # fallback: tìm bất kỳ <a/b/c>
            d3_fb = re.search(r'<(\d+)/(\d+)/(\d+)>', block)
            d3 = f"{d3_fb.group(1)}/{d3_fb.group(2)}/{d3_fb.group(3)}" if d3_fb else "?/?"
        lines.append(f"  • {name}: 3day:{d3} | 7day:{d7} | Month:{month}")

    if not lines:
        return ""
    header = "📊 WO hoàn thành:\n" + "\n".join(lines)
    return header


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

    # ── 6. Fetch Input Task summary (for Technical Dept header) ──
    input_task_summary = get_input_task_summary()
    if input_task_summary:
        logger.info("Input task summary: OK")
    else:
        logger.warning("Input task summary: empty or failed")

    # ── 7. Send messages ──
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
            # Technical dept:
            # 1. Input Task summary (theo Dep: Done/Total/Remain) ở đầu
            # 2. Col D content (đã chèn dòng tổng sau mỗi section header)
            # 3. Asset/search stats
            parts = []

            # ── Header cố định ──
            header_lines = [
                f"📋 ကျန်ရှိသောလုပ်ငန်းများ သတိပေးချက် – {now_str}",
                "━━━━━━━━━━━━━━━━━━━━",
            ]

            # ── Input task summary (Admin/Asset/CM... Done/Total/Remain) ──
            if input_task_summary:
                header_lines.append(input_task_summary)
                header_lines.append("━━━━━━━━━━━━━━━━━━━━")

            parts.append("\n".join(header_lines))

            # ── Col D content: chèn dòng tổng ngay sau mỗi section header ──
            if content:
                transformed = build_asset_progress_summary(content)
                parts.append(transformed)
                parts.append("━━━━━━━━━━━━━━━━━━━━")

            if asset_msg:
                parts.append(asset_msg)
            if search_msg:
                parts.append(search_msg)

            if len(parts) <= 1 and not content:
                continue
            msg = "\n".join(parts)

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
