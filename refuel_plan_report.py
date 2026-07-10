"""
refuel_plan_report.py
======================
Tạo 3 báo cáo so sánh Plan Refuel và gởi vào group 9 TNI REQUEST REFUEL.

Báo cáo 1: Tần suất gởi Plan (3 ngày / 7 ngày / 1 tháng)
Báo cáo 2: Plan hôm nay vs Refueled thực tế  (chạy lúc 18:00 Myanmar)
Báo cáo 3: Plan vs Team Request — match ở trên, khác ở dưới

Cách chạy:
  python refuel_plan_report.py            # cả 3 báo cáo
  python refuel_plan_report.py --report 1
  python refuel_plan_report.py --report 2
  python refuel_plan_report.py --report 3
"""
import os, sys, argparse, requests
from datetime import datetime, timezone, timedelta

REFUEL_BOT_TOKEN    = os.getenv("REFUEL_BOT_TOKEN", "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME")
REFUEL_PLAN_GAS_URL = os.getenv("REFUEL_PLAN_GAS_URL", "")
REFUEL_CHAT_ID      = "-5469544739"   # Group 9 TNI REQUEST REFUEL

TZ_MM = timezone(timedelta(hours=6, minutes=30))


# ── Telegram helpers ────────────────────────────────────────────────────────

def tg_send(text: str) -> bool:
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


# ── GAS helpers ─────────────────────────────────────────────────────────────

def gas_get(params: dict) -> dict:
    if not REFUEL_PLAN_GAS_URL:
        print("❌ REFUEL_PLAN_GAS_URL not set", file=sys.stderr)
        return {}
    try:
        r = requests.get(REFUEL_PLAN_GAS_URL, params=params, timeout=30)
        r.raise_for_status()
        if not r.text.strip():
            return {}
        return r.json()
    except Exception as e:
        print(f"❌ GAS GET error: {e}", file=sys.stderr)
        return {}


# ── Format helpers ───────────────────────────────────────────────────────────

def fmt_row(site: str, *cols) -> str:
    """Format 1 dòng bảng dạng fixed-width."""
    return f"<code>{site:<10} " + "  ".join(f"{str(c):>7}" for c in cols) + "</code>"


def header_line(title: str) -> str:
    return f"\n<b>{'─'*25}\n{title}\n{'─'*25}</b>\n"


# ── Báo cáo 1: Tần suất gởi Plan ────────────────────────────────────────────

def report_1():
    print("📊 Generating Report 1 — Plan Frequency...")
    now     = datetime.now(TZ_MM)
    data    = gas_get({"action": "get_plan_frequency"})
    rows    = data.get("data", [])

    if not rows:
        tg_send("📊 <b>Report 1 — Plan Frequency</b>\n📭 No plan data found.")
        return

    lines = [
        f"📊 <b>PLAN SUBMISSION FREQUENCY</b>",
        f"📅 {now.strftime('%d/%m/%Y %H:%M')} (Myanmar)",
        "<code>Site       3Days   7Days  1Month</code>",
        "<code>─────────────────────────────</code>",
    ]
    for r in rows:
        lines.append(fmt_row(r["site"], f"{r['d3']}x", f"{r['d7']}x", f"{r['d30']}x"))

    lines.append("\n🤖 <i>Auto report — Refuel Plan System</i>")
    tg_send("\n".join(lines))
    print("✅ Report 1 sent.")


# ── Báo cáo 2: Plan vs Refueled ─────────────────────────────────────────────

def report_2():
    print("⛽ Generating Report 2 — Plan vs Refueled...")
    now  = datetime.now(TZ_MM)
    data = gas_get({"action": "get_compare_data"})

    if not data:
        tg_send("⛽ <b>Report 2 — Plan vs Refueled</b>\n📭 No data found.")
        return

    plan     = data.get("plan", {})
    refueled = data.get("refueled", {})
    date_str = data.get("date", now.strftime("%d/%m/%Y"))

    # Tất cả sites
    all_sites = sorted(set(list(plan.keys()) + list(refueled.keys())))

    if not all_sites:
        tg_send(f"⛽ <b>Report 2 — Plan vs Refueled</b>\n📅 {date_str}\n📭 No data for today.")
        return

    lines = [
        f"⛽ <b>PLAN vs REFUELED — {date_str}</b>",
        f"⏰ {now.strftime('%H:%M')} Myanmar",
        "<code>Site       Plan    Filled    Diff   </code>",
        "<code>─────────────────────────────────</code>",
    ]

    ok_count = warn_count = miss_count = 0

    for site in all_sites:
        p = plan.get(site, 0)
        r = refueled.get(site, 0)
        diff = r - p

        if r == 0 and p > 0:
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

        diff_str = f"+{diff}L" if diff > 0 else f"{diff}L"
        lines.append(f"{icon} " + fmt_row(site, f"{p}L", f"{r}L", diff_str))

    lines += [
        "<code>─────────────────────────────────</code>",
        f"✅ Match: <b>{ok_count}</b>  ⚠️ Near: <b>{warn_count}</b>  ❌ Miss: <b>{miss_count}</b>",
        "\n🤖 <i>Auto report — Refuel Plan System</i>",
    ]
    tg_send("\n".join(lines))
    print("✅ Report 2 sent.")


# ── Báo cáo 3: Plan vs Team Request ─────────────────────────────────────────

def report_3():
    print("🔄 Generating Report 3 — Plan vs Request...")
    now  = datetime.now(TZ_MM)
    data = gas_get({"action": "get_compare_data"})

    if not data:
        tg_send("🔄 <b>Report 3 — Plan vs Request</b>\n📭 No data found.")
        return

    plan     = data.get("plan", {})
    request  = data.get("request", {})
    date_str = data.get("date", now.strftime("%d/%m/%Y"))

    all_sites = sorted(set(list(plan.keys()) + list(request.keys())))

    if not all_sites:
        tg_send(f"🔄 <b>Report 3 — Plan vs Request</b>\n📅 {date_str}\n📭 No data for today.")
        return

    match_rows = []
    diff_rows  = []

    for site in all_sites:
        p = plan.get(site, 0)
        q = request.get(site, 0)
        diff = p - q

        if diff == 0:
            match_rows.append(fmt_row(site, f"{q}L", f"{p}L", "="))
        else:
            diff_str = f"+{diff}L" if diff > 0 else f"{diff}L"
            diff_rows.append(fmt_row(site, f"{q}L", f"{p}L", diff_str))

    lines = [
        f"🔄 <b>PLAN vs TEAM REQUEST — {date_str}</b>",
        f"⏰ {now.strftime('%H:%M')} Myanmar",
    ]

    if match_rows:
        lines += [
            "\n✅ <b>MATCH (same quantity)</b>",
            "<code>Site       Request    Plan    Diff</code>",
            "<code>──────────────────────────────</code>",
        ]
        lines += match_rows

    if diff_rows:
        lines += [
            "\n⚠️ <b>DIFF (different quantity)</b>",
            "<code>Site       Request    Plan    Diff</code>",
            "<code>──────────────────────────────</code>",
        ]
        lines += diff_rows

    lines += [
        f"\n📊 Match: <b>{len(match_rows)}</b>  Diff: <b>{len(diff_rows)}</b>",
        "\n🤖 <i>Auto report — Refuel Plan System</i>",
    ]
    tg_send("\n".join(lines))
    print("✅ Report 3 sent.")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="TNI Refuel Plan Reports")
    parser.add_argument("--report", type=int, choices=[1, 2, 3],
                        help="Report number (1/2/3). Omit to run all.")
    args = parser.parse_args()

    now = datetime.now(TZ_MM)
    print(f"⛽ Refuel Plan Report — {now.strftime('%d/%m/%Y %H:%M')} Myanmar")

    if not REFUEL_BOT_TOKEN:
        print("❌ REFUEL_BOT_TOKEN not set", file=sys.stderr)
        sys.exit(1)
    if not REFUEL_PLAN_GAS_URL:
        print("❌ REFUEL_PLAN_GAS_URL not set", file=sys.stderr)
        sys.exit(1)

    if args.report == 1:
        report_1()
    elif args.report == 2:
        report_2()
    elif args.report == 3:
        report_3()
    else:
        report_1()
        report_2()
        report_3()

    print("✅ Done.")


if __name__ == "__main__":
    main()
