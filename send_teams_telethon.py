"""
send_teams_telethon.py
======================
Thay thế GAS sending — đọc dữ liệu từ Sheet qua Apps Script URL,
gửi Tin1 + Tin2 đến T1/T2/T3/T4 bằng tài khoản cá nhân (Telethon).
→ Hỗ trợ read receipt (xem ai đã đọc).

Chạy: GitHub Actions cron mỗi 5 phút.
State: state/last_sd.json (commit vào repo sau mỗi lần gửi).
"""

import asyncio, json, os, re, urllib.request
from datetime import datetime, timezone, timedelta
from telethon import TelegramClient
from telethon.sessions import StringSession

# ── Cấu hình ──────────────────────────────────────────────────
API_ID          = int(os.environ["TELEGRAM_API_ID"])
API_HASH        = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING  = os.environ["TELEGRAM_SESSION"]
APPS_SCRIPT_URL = os.environ["APPS_SCRIPT_URL"]

MYANMAR_TZ = timezone(timedelta(hours=6, minutes=30))
STATE_FILE = "state/last_sd.json"

TEAMS = {
    "T1": {"name": "Team 1",         "id": -5180992881, "awaz_col": 0},
    "T2": {"name": "Team 2 (T2+T5)", "id": -5188855349, "awaz_col": 1},
    "T3": {"name": "Team 3",         "id": -5183480727, "awaz_col": 2},
    "T4": {"name": "Team 4",         "id": -5238696719, "awaz_col": 3},
}

TEAM_COLORS = {"T1": "🔵", "T2": "🟡", "T3": "🟢", "T4": "🔴", "T5": "🟠"}

AWAZ_LABELS = [
    {"emoji": "⚡", "name": "Site down"},
    {"emoji": "🔴", "name": "Cell down"},
    {"emoji": "⚙️", "name": "DG Abnormal"},
    {"emoji": "⏱️", "name": "DG Run>16H"},
    {"emoji": "🔗", "name": "Link down"},
]
# ──────────────────────────────────────────────────────────────

def myanmar_now():
    return datetime.now(MYANMAR_TZ).strftime("%H:%M %d/%m/%Y")

# ── State management ──────────────────────────────────────────
def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except:
        return {"last_a1": "", "last_aw4": ""}

def save_state(state):
    os.makedirs("state", exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)

# ── Lấy dữ liệu từ Apps Script ───────────────────────────────
def get_sheet_data():
    url = APPS_SCRIPT_URL + "?action=get_site_down_data"
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            data = json.loads(r.read())
            if data.get("status") != "ok":
                print(f"❌ Apps Script lỗi: {data.get('message')}")
                return None
            return data
    except Exception as e:
        print(f"❌ Lỗi get_sheet_data: {e}")
        return None

# ── HTML utils ────────────────────────────────────────────────
def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def colorize(text):
    return re.sub(r'\|\s*(T[1-5])\s*\|', lambda m: f"| {TEAM_COLORS.get(m.group(1).upper(),'')+m.group(1)} |", text, flags=re.IGNORECASE)

def split_msg(text, max_len=4000):
    if len(text) <= max_len:
        return [text]
    chunks, cur = [], ""
    for line in text.split("\n"):
        if len(cur) + len(line) + 1 > max_len:
            if cur: chunks.append(cur.strip())
            cur = line
        else:
            cur = cur + "\n" + line if cur else line
    if cur.strip(): chunks.append(cur.strip())
    return chunks

# ── Build Tin 1 (Col C) cho từng team ────────────────────────
def build_tin1(team_key, col_c_lines):
    site_pat = {
        "T1": lambda l: bool(re.search(r'\|\s*T1\s*\|', l, re.I)),
        "T2": lambda l: bool(re.search(r'\|\s*T[25]\s*\|', l, re.I)),
        "T3": lambda l: bool(re.search(r'\|\s*T3\s*\|', l, re.I)),
        "T4": lambda l: bool(re.search(r'\|\s*T4\s*\|', l, re.I)),
    }
    sum_pat = {
        "T1": lambda l: bool(re.match(r'^Team\s*1\s*:', l, re.I)),
        "T2": lambda l: bool(re.match(r'^Team\s*[25]\s*:', l, re.I)),
        "T3": lambda l: bool(re.match(r'^Team\s*3\s*:', l, re.I)),
        "T4": lambda l: bool(re.match(r'^Team\s*4\s*:', l, re.I)),
    }
    headers, sites = [], []
    for line in col_c_lines:
        s = line.strip()
        if not s: continue
        if re.match(r'^\d+:', s):
            if site_pat[team_key](s):
                sites.append(colorize(s))
        elif re.match(r'^Team\s*\d+\s*:', s, re.I):
            if sum_pat[team_key](s):
                headers.append(s)
        else:
            headers.append(s)

    content = "\n".join(headers + ["..."] + sites) if sites else "\n".join(headers + ["Không có site down"])
    return f"<pre>{esc(content)}</pre>"

# ── Build Tin 2 (AW:AZ) cho từng team ────────────────────────
def build_tin2(team_key, awaz, col_idx):
    ts    = datetime.now(MYANMAR_TZ).strftime("%d/%m/%Y %H:%M")
    label = "Team 2 (T2+T5)" if team_key == "T2" else team_key.replace("T", "Team ")
    lines = [
        f"📊 <b>SUMMARY — {label}</b>",
        f"📅 {ts}",
        "━" * 26,
    ]
    has_data = False
    for r, lbl in enumerate(AWAZ_LABELS):
        try:
            val = str((awaz[r] or [])[col_idx] or "").strip()
        except:
            val = ""
        if not val or val == "0": continue
        clean = esc(val.replace("*","").replace("_","").replace("`",""))
        lines.append(f"{lbl['emoji']} <b>{lbl['name']}:</b> {clean}")
        has_data = True
    if not has_data:
        lines.append("✅ Không có sự cố")
    return "\n".join(lines)

# ── Gửi qua Telethon ─────────────────────────────────────────
async def send_chunks(client, entity, text):
    for chunk in split_msg(text):
        await client.send_message(entity, chunk, parse_mode="html")
        await asyncio.sleep(0.5)

# ── Main ─────────────────────────────────────────────────────
async def main():
    print(f"🚀 send_teams_telethon — {myanmar_now()}")

    state = load_state()
    print(f"📌 Last A1 : {state['last_a1'][:50] or '(chưa có)'}")
    print(f"📌 Last AW4: {state['last_aw4'] or '(chưa có)'}")

    data = get_sheet_data()
    if not data:
        return

    a1     = data.get("a1", "").strip()
    aw4    = data.get("aw4", "").strip()
    col_c  = [str(c) for c in data.get("colC", []) if c]
    awaz   = data.get("awaz", [])

    print(f"📊 A1 hiện tại : {a1[:60]}")
    print(f"📊 AW4 hiện tại: {aw4}")

    send_tin1 = bool(a1   and a1  != state["last_a1"])
    send_tin2 = bool(aw4  and aw4 != state["last_aw4"])

    if not send_tin1 and not send_tin2:
        print("⏭️  Không có dữ liệu mới — dừng")
        return

    print(f"{'✅' if send_tin1 else '⏭️'} Tin 1: {'GỬI' if send_tin1 else 'bỏ qua'}")
    print(f"{'✅' if send_tin2 else '⏭️'} Tin 2: {'GỬI' if send_tin2 else 'bỏ qua'}")

    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)
    async with client:
        me = await client.get_me()
        print(f"\n🔑 Gửi bằng: @{me.username} ({me.first_name})")

        for key, info in TEAMS.items():
            entity = await client.get_entity(info["id"])
            print(f"\n[{key}] {info['name']}")

            if send_tin1 and col_c:
                await send_chunks(client, entity, build_tin1(key, col_c))
                print(f"  ✅ Tin 1 gửi xong")

            if send_tin2 and awaz:
                await client.send_message(entity, build_tin2(key, awaz, info["awaz_col"]), parse_mode="html")
                print(f"  ✅ Tin 2 gửi xong")

            await asyncio.sleep(1)

    # Lưu state
    if send_tin1: state["last_a1"]  = a1
    if send_tin2: state["last_aw4"] = aw4
    save_state(state)
    print(f"\n✅ Xong — {myanmar_now()}")


if __name__ == "__main__":
    asyncio.run(main())
