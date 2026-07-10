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

# Cấu hình bot và chat ID mặc định của group 9 TNI REQUEST REFUEL
REFUEL_BOT_TOKEN    = os.getenv("REFUEL_BOT_TOKEN", "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME")
REFUEL_CHAT_ID      = "-5469544739"   # Group 9 TNI REQUEST REFUEL
SPREADSHEET_ID      = "1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM"
XLSX_DOWNLOAD_URL   = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=xlsx"
XLSX_FILE_PATH      = "scratch/sheet_refuel.xlsx"

TZ_MM = timezone(timedelta(hours=6, minutes=30))  # Myanmar UTC+6:30


# ── Helper functions ─────────────────────────────────────────────────────────

def tg_send(text: str) -> bool:
    """Gửi tin nhắn HTML lên Telegram group."""
    url = f"https://api.telegram.org/bot{REFUEL_BOT_TOKEN}/sendMessage"
    r = requests.post(url, json={
        "chat_id": REFUEL_CHAT_ID,
        "text": text,
        "parse_mode": "HTML",
    }, timeout=30)
    ok = r.json().get("ok", False)
    if not ok:
        print(f"❌ Telegram send failed: {r.text[:200]}", file=sys.stderr)
    return ok


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


def fmt_row_freq(col_a: str, col_b: str, col_c: str, col_d: str) -> str:
    """Format dòng tần suất (Site/Name | 3D | 7D | 1M) dạng monospace có gạch dọc '|'."""
    return f"<code>{col_a:<12} | {col_b:>5} | {col_c:>5} | {col_d:>6}</code>"


def fmt_row_compare(col_a: str, col_b: str, col_c: str, col_d: str) -> str:
    """Format dòng so sánh lượng dầu (Site | Plan/Req | Filled/Plan | Diff) dạng monospace có gạch dọc '|'."""
    return f"<code>{col_a:<12} | {col_b:>5} | {col_c:>6} | {col_d:>6}</code>"


# ── Load spreadsheet data ───────────────────────────────────────────────────

class RefuelData:
    def __init__(self):
        self.members = []          # list of dict: {id, name}
        self.not_joined = []       # list of str (names)
        self.target_members = []   # list of dict: {id, name} (từ sheet Template cột G & H)
        self.records = []          # list of dict: {ts, date, cat, sender, sender_id, site, qty}

        if not os.path.exists(XLSX_FILE_PATH):
            if not download_spreadsheet():
                return

        try:
            wb = openpyxl.load_workbook(XLSX_FILE_PATH, data_only=True)
            self._parse_members(wb)
            self._parse_targets(wb)
            self._parse_records(wb)
        except Exception as e:
            print(f"❌ Error loading Excel data: {e}", file=sys.stderr)

    def _parse_members(self, wb):
        if "Telegram ID" in wb.sheetnames:
            ws = wb["Telegram ID"]
            for r in range(2, ws.max_row + 1):
                tg_id = ws.cell(row=r, column=1).value
                name = ws.cell(row=r, column=6).value
                if not name and not tg_id:
                    continue

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

    def _parse_records(self, wb):
        if "PlanRefuel" in wb.sheetnames:
            ws = wb["PlanRefuel"]
            for r in range(2, ws.max_row + 1):
                ts = parse_datetime(ws.cell(row=r, column=1).value)
                date_val = ws.cell(row=r, column=2).value
                cat = ws.cell(row=r, column=3).value
                sender = ws.cell(row=r, column=5).value
                sender_id = ws.cell(row=r, column=6).value
                site = ws.cell(row=r, column=7).value
                qty = ws.cell(row=r, column=8).value

                if ts and cat:
                    self.records.append({
                        "ts": ts,
                        "date": str(date_val).strip() if date_val else "",
                        "cat": str(cat).strip().upper(),
                        "sender": str(sender).strip() if sender else "",
                        "sender_id": str(sender_id).strip() if sender_id else "",
                        "site": str(site).strip() if site else "",
                        "qty": int(qty) if qty is not None else 0
                    })


# ── Reports implementation ──────────────────────────────────────────────────

def report_1(data: RefuelData):
    print("📊 Generating Report 1 — Plan Frequency...")
    now = datetime.now(TZ_MM)
    freq = {}

    for r in data.records:
        if r["cat"] != "PLAN" or not r["site"]:
            continue
        diff = now - r["ts"]
        site = r["site"]

        if site not in freq:
            freq[site] = {"d3": 0, "d7": 0, "d30": 0}
        if diff <= timedelta(days=3):
            freq[site]["d3"] += 1
        if diff <= timedelta(days=7):
            freq[site]["d7"] += 1
        if diff <= timedelta(days=30):
            freq[site]["d30"] += 1

    if not freq:
        tg_send("📊 <b>Report 1 — Plan Frequency</b>\n📭 No plan records found.")
        return

    lines = [
        f"📊 <b>PLAN SUBMISSION FREQUENCY</b>",
        f"📅 {now.strftime('%d/%m/%Y %H:%M')} (Myanmar)",
        fmt_row_freq("Site ID", "3Days", "7Days", "1Month"),
        "<code>" + "─────────────┼───────┼───────┼────────" + "</code>"
    ]
    for site in sorted(freq.keys()):
        f = freq[site]
        lines.append(fmt_row_freq(site, f"{f['d3']}x", f"{f['d7']}x", f"{f['d30']}x"))

    lines.append("<code>" + "─────────────┴───────┴───────┴────────" + "</code>")
    lines.append("\n🤖 <i>Auto report — Refuel Plan System</i>")
    tg_send("\n".join(lines))
    print("✅ Report 1 sent.")


def report_2(data: RefuelData):
    print("⛽ Generating Report 2 — Plan vs Refueled...")
    now = datetime.now(TZ_MM)
    today_str = now.strftime("%d/%m/%Y")

    plan = {}
    refueled = {}

    for r in data.records:
        if r["date"] != today_str or not r["site"]:
            continue
        if r["cat"] == "PLAN":
            plan[r["site"]] = plan.get(r["site"], 0) + r["qty"]
        elif r["cat"] == "REFUELED":
            refueled[r["site"]] = refueled.get(r["site"], 0) + r["qty"]

    all_sites = sorted(set(list(plan.keys()) + list(refueled.keys())))
    if not all_sites:
        tg_send(f"⛽ <b>Report 2 — Plan vs Refueled</b>\n📅 {today_str}\n📭 No refuel records today.")
        return

    lines = [
        f"⛽ <b>PLAN vs REFUELED — {today_str}</b>",
        f"⏰ {now.strftime('%H:%M')} Myanmar",
        fmt_row_compare("Site ID", "Plan", "Filled", "Diff"),
        "<code>" + "─────────────┼───────┼────────┼────────" + "</code>"
    ]

    ok_count = warn_count = miss_count = 0

    for site in all_sites:
        p = plan.get(site, 0)
        f = refueled.get(site, 0)
        diff = f - p
        diff_str = f"+{diff}L" if diff > 0 else f"{diff}L"

        if f == 0 and p > 0:
            icon = "❌"
            miss_count += 1
        elif diff == 0:
            icon = "✅"
            ok_count += 1
        elif abs(diff) <= 50:
            icon = "⚠️"
            warn_count += 1
        else:
            icon = "❌"
            miss_count += 1

        lines.append(f"{icon} {fmt_row_compare(site, f'{p}L', f'{f}L', diff_str)}")

    lines += [
        "<code>" + "─────────────┴───────┴────────┴────────" + "</code>",
        f"✅ Match: <b>{ok_count}</b>  ⚠️ Near: <b>{warn_count}</b>  ❌ Miss: <b>{miss_count}</b>",
        "\n🤖 <i>Auto report — Refuel Plan System</i>"
    ]
    tg_send("\n".join(lines))
    print("✅ Report 2 sent.")


def report_3(data: RefuelData):
    print("🔄 Generating Report 3 — Plan vs Request...")
    now = datetime.now(TZ_MM)
    today_str = now.strftime("%d/%m/%Y")

    plan = {}
    request = {}

    for r in data.records:
        if r["date"] != today_str or not r["site"]:
            continue
        if r["cat"] == "PLAN":
            plan[r["site"]] = plan.get(r["site"], 0) + r["qty"]
        elif r["cat"] == "REQUEST":
            request[r["site"]] = request.get(r["site"], 0) + r["qty"]

    all_sites = sorted(set(list(plan.keys()) + list(request.keys())))
    if not all_sites:
        tg_send(f"🔄 <b>Report 3 — Plan vs Request</b>\n📅 {today_str}\n📭 No records today.")
        return

    match_rows = []
    diff_rows = []

    for site in all_sites:
        p = plan.get(site, 0)
        q = request.get(site, 0)
        diff = p - q

        row_str = fmt_row_compare(site, f"{q}L", f"{p}L", "=" if diff == 0 else f"{diff}L")
        if diff == 0:
            match_rows.append(row_str)
        else:
            diff_rows.append(row_str)

    lines = [
        f"🔄 <b>PLAN vs TEAM REQUEST — {today_str}</b>",
        f"⏰ {now.strftime('%H:%M')} Myanmar",
    ]

    header_bar = "<code>" + "─────────────┼───────┼────────┼────────" + "</code>"
    footer_bar = "<code>" + "─────────────┴───────┴────────┴────────" + "</code>"

    if match_rows:
        lines += [
            "\n✅ <b>MATCH (same quantity)</b>",
            fmt_row_compare("Site ID", "Request", "Plan", "Diff"),
            header_bar
        ] + match_rows + [footer_bar]

    if diff_rows:
        lines += [
            "\n⚠️ <b>DIFF (different quantity)</b>",
            fmt_row_compare("Site ID", "Request", "Plan", "Diff"),
            header_bar
        ] + diff_rows + [footer_bar]

    lines += [
        f"\n📊 Match: <b>{len(match_rows)}</b>  Diff: <b>{len(diff_rows)}</b>",
        "\n🤖 <i>Auto report — Refuel Plan System</i>"
    ]
    tg_send("\n".join(lines))
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

    lines = [
        f"👤 <b>REFUEL REQUESTS BY PERSON (Col F)</b>",
        f"📅 {now.strftime('%d/%m/%Y %H:%M')} (Myanmar)",
        fmt_row_freq("Name", "3Days", "7Days", "1Month"),
        "<code>" + "─────────────┼───────┼───────┼────────" + "</code>"
    ]

    # Hiển thị từng thành viên đã tham gia nhóm (có ID)
    for m in data.members:
        f = freq.get(m["id"], {"d3": 0, "d7": 0, "d30": 0})
        short_name = m["name"][:12]
        lines.append(fmt_row_freq(short_name, f"{f['d3']}x", f"{f['d7']}x", f"{f['d30']}x"))

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
    tg_send("\n".join(lines))
    print("✅ Report 4 sent.")


def report_5(data: RefuelData):
    print("📋 Generating Report 5 — Plan Sent by Target List...")
    now = datetime.now(TZ_MM)
    freq = {}

    for r in data.records:
        if r["cat"] != "PLAN" or not r["sender_id"]:
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

    lines = [
        f"📋 <b>PLAN SUBMISSIONS BY TARGET LIST</b>",
        f"📅 {now.strftime('%d/%m/%Y %H:%M')} (Myanmar)",
    ]

    # Kiểm tra xem danh sách đích có rỗng không
    if not data.target_members:
        lines.append("\n⚠️ <b>No partner targets configured in Template sheet Column G & H!</b>")
        lines.append("<i>Please add partner Telegram IDs to Col G and Names to Col H in the Template tab.</i>")
        lines.append("\n🤖 <i>Auto report — Refuel Plan System</i>")
        tg_send("\n".join(lines))
        print("⚠️ Report 5 sent (warning: empty targets).")
        return

    targets = data.target_members

    lines += [
        fmt_row_freq("Name/ID", "3Days", "7Days", "1Month"),
        "<code>" + "─────────────┼───────┼───────┼────────" + "</code>"
    ]

    for t in targets:
        name = t["name"]
        tid = t["id"]
        f = freq.get(tid, {"d3": 0, "d7": 0, "d30": 0})
        short_name = name[:12]
        lines.append(fmt_row_freq(short_name, f"{f['d3']}x", f"{f['d7']}x", f"{f['d30']}x"))

    lines.append("<code>" + "─────────────┴───────┴───────┴────────" + "</code>")
    lines.append("\n🤖 <i>Auto report — Refuel Plan System</i>")
    tg_send("\n".join(lines))
    print("✅ Report 5 sent.")


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
