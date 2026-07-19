"""
refuel_plan_report.py
======================
Tạo 5 báo cáo so sánh/thống kê Refuel Plan từ Google Sheet và gửi vào group Telegram.

Báo cáo 1: Tần suất gửi Plan của từng trạm (3 ngày / 7 ngày / 1 tháng)
Báo cáo 2: So sánh Plan hôm nay vs Refueled thực tế (chạy lúc 18:00)
Báo cáo 3: So sánh Plan hôm nay vs Team Request (chạy lúc 18:00)
Báo cáo 4: Thống kê Request refuel theo thành viên (từ sheet Telegram ID) + Ai chưa tham gia (chạy lúc 22:00)
Báo cáo 5: Thống kê Plan gửi theo danh sách ID tại cột G và tên tại cột H sheet Template (chạy lúc 22:00)

Cách chạy:
  python refuel_plan_report.py --report 1
  python refuel_plan_report.py --report 2
  python refuel_plan_report.py --report 3
  python refuel_plan_report.py --report 4
  python refuel_plan_report.py --report 5
  python refuel_plan_report.py            # Chạy toàn bộ 5 báo cáo
"""
import os, sys, argparse, requests
import openpyxl
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from tg_utils import tg_send_fresh

load_dotenv()  # Load .env local (GitHub Actions đã có env vars sẵn)

# Cấu hình bot và chat ID mặc định của group 9 TNI REQUEST REFUEL
REFUEL_BOT_TOKEN    = os.getenv("REFUEL_BOT_TOKEN", "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME")
REFUEL_CHAT_ID      = "-5469544739"   # Group 9 TNI REQUEST REFUEL
SPREADSHEET_ID      = "1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM"
XLSX_DOWNLOAD_URL   = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=xlsx"
XLSX_FILE_PATH      = "scratch/sheet_refuel.xlsx"

TZ_MM = timezone(timedelta(hours=6, minutes=30))  # Myanmar UTC+6:30


# ── Helper functions ─────────────────────────────────────────────────────────

# GAS URL để lưu message_id (BotState)
REFUEL_GAS_URL = (
    os.getenv("APPS_SCRIPT_URL") or
    os.getenv("REFUEL_APPS_SCRIPT_URL") or ""
).strip()


# Map report_key → title prefix dòng đầu tiên (dùng cho Telethon delete-by-title)
REPORT_TITLE_PREFIX = {
    "report1": "📋 [Report 1]",
    "report2": "📊 [Report 2]",
    "report3": "🔄 [Report 3]",
    "report4": "👤 [Report 4]",
    "report5": "📋 [Report 5]",
}

def tg_send(text: str, report_key: str = "") -> bool:
    """Xóa TẤT CẢ tin cũ cùng tiêu đề rồi gửi tin mới lên Telegram group."""
    state_key    = f"{report_key}_{REFUEL_CHAT_ID}" if report_key else None
    title_prefix = REPORT_TITLE_PREFIX.get(report_key, "")
    msg_id = tg_send_fresh(REFUEL_CHAT_ID, text, state_key=state_key, title_prefix=title_prefix)
    if not msg_id:
        print("❌ Telegram send failed", file=sys.stderr)
        return False
    return True



def download_spreadsheet() -> bool:
    """Tải file Excel từ Google Sheets."""
    print("📥 Downloading spreadsheet...")
    try:
        os.makedirs("scratch", exist_ok=True)
        r = requests.get(XLSX_DOWNLOAD_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
        r.raise_for_status()
        with open(XLSX_FILE_PATH, "wb") as f:
            f.write(r.content)
        print("✅ Download successful!")
        return True
    except Exception as e:
        print(f"❌ Download failed: {e}", file=sys.stderr)
        return False


def parse_datetime(val) -> datetime | None:
    """Đảm bảo định dạng datetime có múi giờ Myanmar."""
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=TZ_MM)
        return val
    if isinstance(val, str):
        val = val.strip()
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S"):
            try:
                dt = datetime.strptime(val, fmt)
                return dt.replace(tzinfo=TZ_MM)
            except ValueError:
                pass
    return None


def parse_date_str(val) -> str:
    """Chuyển đổi giá trị ngày (datetime hoặc string) sang chuỗi dd/MM/YYYY."""
    if val is None:
        return ""
    if isinstance(val, datetime):
        return val.strftime("%d/%m/%Y")
    s = str(val).strip()
    if len(s) == 10 and s[2] == "/" and s[5] == "/":
        return s
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:len(fmt)], fmt).strftime("%d/%m/%Y")
        except ValueError:
            pass
    return s


def safe_int(val) -> int:
    """Chuyển đổi giá trị số nguyên an toàn — trả 0 nếu không parse được."""
    if val is None:
        return 0
    if isinstance(val, (int, float)):
        return int(val)
    try:
        return int(str(val).strip())
    except (ValueError, TypeError):
        return 0


def fmt_row_freq(col_a: str, col_b: str, col_c: str, col_d: str) -> str:
    """Format dòng tần suất (Site/Name | 3D | 7D | 1M) dạng monospace có gạch dọc '|'."""
    return f"<code>{col_a:<12} | {col_b:>5} | {col_c:>5} | {col_d:>6}</code>"


def fmt_row_compare(col_a: str, col_b: str, col_c: str, col_d: str) -> str:
    """Format dòng so sánh lượng dầu (Site | Plan/Req | Filled/Plan | Diff) dạng monospace có gạch dọc '|'."""
    return f"<code>{col_a:<12} | {col_b:>5} | {col_c:>6} | {col_d:>6}</code>"


# ── Load spreadsheet data ───────────────────────────────────────────────────

class RefuelData:
    def __init__(self):
        self.members = []          # list of dict: {id, name} — từ sheet "Telegram ID"
        self.not_joined = []       # list of str (names)
        self.target_members = []   # list of dict: {id, name} — từ Template col G & H
        self.lettel_persons = []   # list of dict: {id, name} — từ Template col J & K
        self.records = []          # list of dict: {ts, date, cat, sender, sender_id, site, qty}
        self.letter_approved = ""  # ngày Government Approved mới nhất (col C)
        self.letter_submitted = "" # ngày Letter Submitted mới nhất (col B)

        if not os.path.exists(XLSX_FILE_PATH):
            if not download_spreadsheet():
                return

        try:
            wb = openpyxl.load_workbook(XLSX_FILE_PATH, data_only=True)
            self._parse_members(wb)
            self._parse_targets(wb)
            self._parse_lettel(wb)
            self._parse_lettel_progress(wb)
            self._parse_records(wb)
        except Exception as e:
            print(f"❌ Error loading Excel data: {e}", file=sys.stderr)

    def _parse_members(self, wb):
        if "Telegram ID" in wb.sheetnames:
            ws = wb["Telegram ID"]
            for r in range(2, ws.max_row + 1):
                tg_id = ws.cell(row=r, column=1).value   # Cột A: Telegram ID

                # Lấy tên từ cột F (cột 6), tránh lấy số điện thoại ở cột B (cột 2)
                name = None
                val_f = ws.cell(row=r, column=6).value
                if val_f and str(val_f).strip() and str(val_f).strip().lower() not in ("none", "0"):
                    name = str(val_f).strip()
                else:
                    # Fallback sang các cột khác trừ cột B (2)
                    for col in (3, 4, 5):
                        val = ws.cell(row=r, column=col).value
                        if val and str(val).strip() and str(val).strip().lower() not in ("none", "0"):
                            name = str(val).strip()
                            break

                if not name and not tg_id:
                    continue  # Dòng trống hoàn toàn → bỏ qua

                tg_id_str = str(tg_id).strip() if tg_id is not None else ""
                if not tg_id_str or tg_id_str == "None" or tg_id_str == "0" or not tg_id_str.isdigit():
                    self.not_joined.append(name or "Unknown")
                else:
                    self.members.append({"id": tg_id_str, "name": name or "Unknown"})

    def _parse_targets(self, wb):
        if "Template" in wb.sheetnames:
            ws = wb["Template"]
            for r in range(2, ws.max_row + 1):  # Quét từ dòng 2
                val = ws.cell(row=r, column=7).value     # Cột G: ID telegram
                name = ws.cell(row=r, column=8).value    # Cột H: Tên
                if val is not None:
                    val_str = str(val).strip()
                    # Bỏ qua dòng tiêu đề mẫu nếu có chữ "id telegram"
                    if val_str.lower() == "id telegram":
                        continue
                    if val_str.isdigit() and len(val_str) > 8:
                        self.target_members.append({
                            "id": val_str,
                            "name": str(name).strip() if name else f"ID:{val_str[-6:]}"
                        })

    def _parse_lettel(self, wb):
        """Đọc Template col J (Telegram ID) & K (Tên nhân viên phụ trách)."""
        sheet_name = "Template"
        if sheet_name not in wb.sheetnames:
            return
        ws = wb[sheet_name]
        for r in range(2, ws.max_row + 1):
            tg_id = ws.cell(row=r, column=10).value   # J: Telegram ID nhân viên
            name  = ws.cell(row=r, column=11).value   # K: Tên nhân viên
            if not tg_id and not name:
                continue
            tg_id_str = str(tg_id).strip() if tg_id is not None else ""
            name_str  = str(name).strip()  if name  is not None else ""
            if tg_id_str.isdigit() and len(tg_id_str) > 5 and name_str:
                self.lettel_persons.append({"id": tg_id_str, "name": name_str})

    def _parse_lettel_progress(self, wb):
        """Đọc Lettel Progress col B (Date Letter Submit) và col C (Date Leter Approved) — lấy giá trị mới nhất."""
        if "Lettel Progress" not in wb.sheetnames:
            return
        ws = wb["Lettel Progress"]
        latest_submitted = ""
        latest_approved  = ""
        for r in range(2, ws.max_row + 1):
            val_b = ws.cell(row=r, column=2).value  # B: Date Letter Submit
            val_c = ws.cell(row=r, column=3).value  # C: Date Letter Approved
            if val_b:
                s = parse_date_str(val_b)
                if s and s != "None":
                    latest_submitted = s
            if val_c:
                s = parse_date_str(val_c)
                if s and s != "None":
                    latest_approved = s
        self.letter_submitted = latest_submitted
        self.letter_approved  = latest_approved

    def _parse_records(self, wb):
        # 1. Parse Plan refuel sheet
        if "Plan refuel" in wb.sheetnames:
            ws = wb["Plan refuel"]
            for r in range(2, ws.max_row + 1):
                date_val = ws.cell(row=r, column=2).value
                site = ws.cell(row=r, column=4).value
                qty = ws.cell(row=r, column=5).value
                ts = parse_datetime(ws.cell(row=r, column=6).value) or datetime.now(TZ_MM)
                sender = ws.cell(row=r, column=7).value
                sender_id = ws.cell(row=r, column=8).value
                
                if site:
                    team_val = ws.cell(row=r, column=3).value  # col C: Name Team Plan
                    self.records.append({
                        "ts": ts,
                        "date": parse_date_str(date_val),
                        "cat": "PLAN",
                        "team": str(team_val).strip() if team_val else "",
                        "sender": str(sender).strip() if sender else "",
                        "sender_id": str(sender_id).strip() if sender_id else "",
                        "site": str(site).strip() if site else "",
                        "qty": safe_int(qty)
                    })
                    
        # 2. Parse Team request sheet
        if "Team request" in wb.sheetnames:
            ws = wb["Team request"]
            for r in range(2, ws.max_row + 1):
                date_val = ws.cell(row=r, column=2).value
                site = ws.cell(row=r, column=5).value
                qty = ws.cell(row=r, column=6).value
                ts = parse_datetime(ws.cell(row=r, column=7).value) or datetime.now(TZ_MM)
                sender = ws.cell(row=r, column=8).value
                sender_id = ws.cell(row=r, column=9).value
                
                if site:
                    self.records.append({
                        "ts": ts,
                        "date": parse_date_str(date_val),  # fix: dùng parse_date_str thay vì str()
                        "cat": "REQUEST",
                        "sender": str(sender).strip() if sender else "",
                        "sender_id": str(sender_id).strip() if sender_id else "",
                        "site": str(site).strip() if site else "",
                        "qty": safe_int(qty)
                    })
                    
        # 3. Parse Refueled sheet
        if "Refueled" in wb.sheetnames:
            ws = wb["Refueled"]
            for r in range(2, ws.max_row + 1):
                date_val = ws.cell(row=r, column=4).value
                site = ws.cell(row=r, column=6).value
                qty = ws.cell(row=r, column=17).value
                ts = parse_datetime(ws.cell(row=r, column=20).value) or datetime.now(TZ_MM)
                sender = ws.cell(row=r, column=21).value
                sender_id = ws.cell(row=r, column=22).value
                
                if site:
                    self.records.append({
                        "ts": ts,
                        "date": parse_date_str(date_val),  # fix: dùng parse_date_str thay vì str()
                        "cat": "REFUELED",
                        "sender": str(sender).strip() if sender else "",
                        "sender_id": str(sender_id).strip() if sender_id else "",
                        "site": str(site).strip() if site else "",
                        "qty": safe_int(qty)
                    })


# ── Reports implementation ──────────────────────────────────────────────────

def report_1(data: RefuelData):
    print("📋 Generating Report 1 — Plan - Request - Refueled...")
    now = datetime.now(TZ_MM)
    today_str = now.strftime("%d/%m/%Y")

    # ── Lọc tất cả records có date == hôm nay ──
    plan_today     = [r for r in data.records if r["cat"] == "PLAN"     and r["date"] == today_str]
    refueled_today = [r for r in data.records if r["cat"] == "REFUELED" and r["date"] == today_str]
    request_today  = [r for r in data.records if r["cat"] == "REQUEST"  and r["date"] == today_str]

    if not plan_today:
        tg_send(
            f"📋 <b>[Report 1] Plan - Request - Refueled</b>\n"
            f"📅 {today_str} | \u23f0 {now.strftime('%H:%M')} Myanmar\n"
            f"📭 No Plan submitted for today.",
            "report1"
        )
        print("\u2705 Report 1 sent (no plan today).")
        return

    # ── Build lookup: site → qty cho Refueled & Request ──
    refueled_by_site: dict[str, int] = {}
    for r in refueled_today:
        refueled_by_site[r["site"]] = refueled_by_site.get(r["site"], 0) + r["qty"]

    request_by_site: dict[str, int] = {}
    for r in request_today:
        request_by_site[r["site"]] = request_by_site.get(r["site"], 0) + r["qty"]

    # ── Infer team từ lịch sử toàn bộ PLAN records ──
    sender_team_map: dict[str, str] = {}
    for r in sorted(
        [r for r in data.records if r["cat"] == "PLAN" and r.get("team")],
        key=lambda x: x["ts"], reverse=True
    ):
        sid = r["sender_id"]
        if sid not in sender_team_map:
            sender_team_map[sid] = r["team"]

    # ── Group: Sender → Team → Sites ──
    sender_order: list[str] = []
    sender_data: dict = {}

    for r in sorted(plan_today, key=lambda x: x["ts"]):
        sid  = r["sender_id"]
        name = r["sender"] or sid or "Unknown"
        team = r.get("team") or sender_team_map.get(sid, "") or "No Team"

        if sid not in sender_data:
            sender_order.append(sid)
            sender_data[sid] = {"name": name, "team_order": [], "team_sites": {}}

        sd = sender_data[sid]
        if team not in sd["team_sites"]:
            sd["team_order"].append(team)
            sd["team_sites"][team] = []
        sd["team_sites"][team].append({"site": r["site"], "plan": r["qty"]})

    # ── Build message ──

    lines = [
        f"📋 <b>[Report 1] Plan - Request - Refueled</b>",
        f"📅 {today_str} | ⏰ {now.strftime('%H:%M')} Myanmar",
        f"<code>{'Site ID':<12} | {'Plan':>5} | {'Refueled':>8} | {'Req':>5}</code>",
        "<code>" + "─────────────┼───────┼──────────┼───────" + "</code>",
    ]

    total_plan = total_filled = total_req = 0

    for sid in sender_order:
        sd = sender_data[sid]
        lines.append(f"\n👤 <b>{sd['name']}</b>")

        for team in sd["team_order"]:
            lines.append(f"  🏷 <b>{team}</b>")
            for item in sd["team_sites"][team]:
                site   = item["site"]
                plan_q = item["plan"]
                fill_q = refueled_by_site.get(site, 0)
                req_q  = request_by_site.get(site, 0)

                if fill_q == 0 and plan_q > 0:
                    icon = "❌"
                elif fill_q >= plan_q or abs(fill_q - plan_q) <= 50:
                    icon = "✅"
                else:
                    icon = "⚠️"

                lines.append(
                    f"    {icon} <code>{site:<12} | {plan_q:>4}L | {fill_q:>7}L | {req_q:>4}L</code>"
                )
                total_plan  += plan_q
                total_filled += fill_q
                total_req   += req_q

    lines += [
        "\n<code>" + "─────────────┴───────┴──────────┴───────" + "</code>",
        f"<code>{'Total':<12} | {total_plan:>4}L | {total_filled:>7}L | {total_req:>4}L</code>",
        "\n🤖 <i>Auto report — Refuel Plan System</i>"
    ]

    tg_send("\n".join(lines), "report1")
    print("✅ Report 1 sent.")



    # ── Lọc tất cả records có date == hôm nay ──
    plan_today     = [r for r in data.records if r["cat"] == "PLAN"     and r["date"] == today_str]
    refueled_today = [r for r in data.records if r["cat"] == "REFUELED" and r["date"] == today_str]
    request_today  = [r for r in data.records if r["cat"] == "REQUEST"  and r["date"] == today_str]

def report_2(data: RefuelData):
    print("📊 Generating Report 2 — Progress Sent Plan...")
    now = datetime.now(TZ_MM)
    today_str = now.strftime("%d/%m/%Y")

    # ── Letter Progress ──
    submit_line   = f"📤 The letter was submitted to the Government for approval on: <b>{data.letter_submitted or 'N/A'}</b>"
    approved_line = f"✅ The government approved the oil transport letter on: <b>{data.letter_approved or 'N/A'}</b>"

    # ── Tần suất gửi Plan per person từ target_members (col G/H Template) ──
    allowed_ids = {m["id"] for m in data.target_members}
    id_to_name  = {m["id"]: m["name"] for m in data.target_members}

    # Khởi tạo freq cho TẤT CẢ target_members (kể cả người chưa submit)
    freq: dict[str, dict] = {m["name"]: {"d3": 0, "d7": 0, "d30": 0} for m in data.target_members}

    for r in data.records:
        if r["cat"] != "PLAN":
            continue
        sid = r["sender_id"]
        if sid not in allowed_ids:
            continue
        diff_time = now - r["ts"]
        name = id_to_name[sid]
        if diff_time <= timedelta(days=3):  freq[name]["d3"]  += 1
        if diff_time <= timedelta(days=7):  freq[name]["d7"]  += 1
        if diff_time <= timedelta(days=30): freq[name]["d30"] += 1

    total_today = sum(
        1 for r in data.records
        if r["cat"] == "PLAN" and r["date"] == today_str and r["sender_id"] in allowed_ids
    )

    # ── Build message ──
    lines = [
        f"📊 <b>[Report 2] Progress Sent Plan</b>",
        f"📅 {today_str} | ⏰ {now.strftime('%H:%M')} Myanmar",
        "",
        "📝 <b>Letter Progress:</b>",
        f"  {submit_line}",
        f"  {approved_line}",
        "",
        f"📋 <b>Plan Sent Today: {total_today}</b>",
        f"<code>{'Name':<15} | {'3D':>3} | {'7D':>3} | {'1M':>4}</code>",
        "<code>" + "────────────────┼─────┼─────┼──────" + "</code>",
    ]

    for name in sorted(freq.keys()):
        f = freq[name]
        short = name[:15]
        # Icon: ✅ có gửi 3D, 🟡 có gửi 7D, ❌ không gửi
        if f["d3"] > 0:
            icon = "✅"
        elif f["d7"] > 0:
            icon = "🟡"
        else:
            icon = "❌"
        lines.append(f"{icon} <code>{short:<15} | {f['d3']:>3} | {f['d7']:>3} | {f['d30']:>4}</code>")

    lines += [
        "<code>" + "────────────────┴─────┴─────┴──────" + "</code>",
        "\n🤖 <i>Auto report — Refuel Plan System</i>"
    ]

    tg_send("\n".join(lines), "report2")
    print("✅ Report 2 sent.")


def report_3(data: RefuelData):
    print("🔄 Generating Report 3 — Plan vs Request...")
    now = datetime.now(TZ_MM)
    today_str = now.strftime("%d/%m/%Y")

    plan    = {}
    request = {}

    for r in data.records:
        if r["date"] != today_str or not r["site"]:
            continue
        if r["cat"] == "PLAN":
            plan[r["site"]]    = plan.get(r["site"], 0)    + r["qty"]
        elif r["cat"] == "REQUEST":
            request[r["site"]] = request.get(r["site"], 0) + r["qty"]

    all_sites = sorted(set(list(plan.keys()) + list(request.keys())))
    if not all_sites:
        tg_send(f"🔄 <b>[Report 3] Plan vs Request</b>\n📅 {today_str}\n📭 No records today.", "report3")
        return

    green_count = yellow_count = gray_count = purple_count = 0

    rows = []
    for i, site in enumerate(all_sites, 1):
        p = plan.get(site, 0)
        q = request.get(site, 0)
        diff = p - q

        if p > 0 and q > 0 and diff == 0:
            icon = "🟢"; green_count  += 1   # Trùng tên + trùng số lít
        elif p > 0 and q > 0 and diff != 0:
            icon = "🟡"; yellow_count += 1   # Trùng tên + khác số lít
        elif q > 0 and p == 0:
            icon = "🟣"; purple_count += 1   # Request có, Plan không có
        else:
            icon = "🔵"; gray_count   += 1   # Plan có, Request không có

        diff_str = "=" if diff == 0 else f"{diff:+d}L"
        rows.append(f"{icon} {fmt_row_compare(site, f'{q}L', f'{p}L', diff_str)}")


    header_bar = "<code>" + "─────────────┼───────┼────────┼────────" + "</code>"
    footer_bar = "<code>" + "─────────────┴───────┴────────┴────────" + "</code>"

    lines = [
        f"🔄 <b>[Report 3] PLAN vs TEAM REQUEST — {today_str}</b>",
        f"⏰ {now.strftime('%H:%M')} Myanmar",
        f"\n🟢 Match  🟡 Diff qty  🟣 Req only  🔵 Plan only",
        fmt_row_compare("Site ID", "Request", "Plan", "Diff"),
        header_bar,
    ] + rows + [
        footer_bar,
        f"\n🟢 <b>{green_count}</b>  🟡 <b>{yellow_count}</b>  🟣 <b>{purple_count}</b>  🔵 <b>{gray_count}</b>",
        "\n🤖 <i>Auto report — Refuel Plan System</i>"
    ]
    tg_send("\n".join(lines), "report3")
    print("✅ Report 3 sent.")



def report_4(data: RefuelData):
    print("👤 Generating Report 4 — Request Refuel by Person...")
    now = datetime.now(TZ_MM)
    freq = {}

    for r in data.records:
        if r["cat"] != "REQUEST" or not r["sender_id"]:
            continue
        diff = now - r["ts"]
        sid = r["sender_id"]

        if sid not in freq:
            freq[sid] = {"d3": 0, "d7": 0, "d30": 0}
        if diff <= timedelta(days=3):
            freq[sid]["d3"] += 1
        if diff <= timedelta(days=7):
            freq[sid]["d7"] += 1
        if diff <= timedelta(days=30):
            freq[sid]["d30"] += 1

    # Phải lấy thông tin request ngày hôm nay để đưa vào tiêu đề
    today_str = now.strftime("%d/%m/%Y")
    today_reqs = {}
    for r in data.records:
        if r["date"] == today_str and r["cat"] == "REQUEST" and r["site"]:
            today_reqs[r["site"]] = today_reqs.get(r["site"], 0) + r["qty"]
    
    req_parts = []
    for site in sorted(today_reqs.keys()):
        qty = today_reqs[site]
        req_parts.append(f"{site} : {qty}L")
    
    if req_parts:
        req_summary = " + ".join(req_parts)
        title = f"👤 <b>[Report 4] Team request {today_str}: {req_summary}</b>"
    else:
        title = f"👤 <b>[Report 4] Team request {today_str}</b>"

    lines = [
        title,
        f"📅 {now.strftime('%d/%m/%Y %H:%M')} (Myanmar)",
        fmt_row_freq("Name", "3Days", "7Days", "1Month"),
        "<code>" + "─────────────┼───────┼───────┼────────" + "</code>"
    ]

    # Hiển thị từng thành viên đã tham gia nhóm (có ID) — có số thứ tự
    for i, m in enumerate(data.members, 1):
        f = freq.get(m["id"], {"d3": 0, "d7": 0, "d30": 0})
        short_name = m["name"][:12]
        lines.append(f"<code>{i:<3}</code> {fmt_row_freq(short_name, f"{f['d3']}x", f"{f['d7']}x", f"{f['d30']}x")}")

    lines.append("<code>" + "─────────────┴───────┴───────┴────────" + "</code>")

    # Hiển thị những người chưa tham gia nhóm
    if data.not_joined:
        lines += [
            "\n⚠️ <b>NOT JOINED GROUP (No Telegram ID)</b>",
            "<code>" + "─────────────────────────────────" + "</code>"
        ]
        for name in sorted(data.not_joined):
            lines.append(f"• {name}")

    lines.append("\n🤖 <i>Auto report — Refuel Plan System</i>")
    tg_send("\n".join(lines), "report4")
    print("✅ Report 4 sent.")


def report_5(data: RefuelData):
    print("📋 Generating Report 5 — Members Not Joined Telegram Group...")
    now = datetime.now(TZ_MM)

    lines = [
        f"📋 <b>[Report 5] MEMBERS NOT YET JOINED</b>",
        f"📅 {now.strftime('%d/%m/%Y %H:%M')} (Myanmar)",
    ]

    not_joined = data.not_joined   # list of str (tên, chưa có Telegram ID)
    joined     = data.members      # list of {id, name} (đã có ID)

    if not not_joined:
        lines += [
            f"\n✅ All <b>{len(joined)}</b> members have joined the Telegram group!",
            "\n🤖 <i>Auto report — Refuel Plan System</i>"
        ]
        tg_send("\n".join(lines), "report5")
        print("✅ Report 5 sent — all joined.")
        return

    lines += [
        f"\n❌ <b>{len(not_joined)}</b> members NOT yet joined | ✅ Joined: <b>{len(joined)}</b>",
        f"<code>{'No':<3} {'Name':<25}</code>",
        "<code>" + "────┬────────────────────────────" + "</code>",
    ]
    for i, name in enumerate(sorted(not_joined), 1):
        lines.append(f"<code>{i:<3} {name[:25]:<25}</code>")

    lines += [
        "<code>" + "────┴────────────────────────────" + "</code>",
        "\n🤖 <i>Auto report — Refuel Plan System</i>"
    ]
    tg_send("\n".join(lines), "report5")
    print(f"✅ Report 5 sent — {len(not_joined)} not joined.")



# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="TNI Refuel Plan Reports")
    parser.add_argument("--report", type=int, choices=[1, 2, 3, 4, 5], nargs="+",
                        help="Report numbers (1-5). Omit to run all.")
    args = parser.parse_args()

    # Tải và parse dữ liệu trước khi chạy báo cáo
    download_spreadsheet()
    data = RefuelData()

    reports_to_run = args.report if args.report else [1, 2, 3, 4, 5]

    if 1 in reports_to_run:
        report_1(data)
    if 2 in reports_to_run:
        report_2(data)
    if 3 in reports_to_run:
        report_3(data)
    if 4 in reports_to_run:
        report_4(data)
    if 5 in reports_to_run:
        report_5(data)

    print("🎉 All tasks finished successfully.")


if __name__ == "__main__":
    main()
