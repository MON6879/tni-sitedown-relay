import os
import sys
import requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

# Cấu hình bot và chat ID mặc định của group 9 TNI REQUEST REFUEL
REFUEL_BOT_TOKEN = os.getenv("REFUEL_BOT_TOKEN", "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME")
REFUEL_CHAT_ID   = os.getenv("REFUEL_CHAT_ID", "-5469544739")
# URL Apps Script của bảng tính Refuel riêng, nếu không có sẽ tự động dùng chung APPS_SCRIPT_URL
REFUEL_APPS_SCRIPT_URL = os.getenv("REFUEL_APPS_SCRIPT_URL", os.getenv("APPS_SCRIPT_URL", ""))

TZ_MM = timezone(timedelta(hours=6, minutes=30))  # Múi giờ Myanmar UTC+6:30


def fetch_refuel_data() -> list[str] | None:
    """Tải dữ liệu cột G của tab Refuel từ Google Sheets qua Apps Script Web App API."""
    if not REFUEL_APPS_SCRIPT_URL:
        print("❌ REFUEL_APPS_SCRIPT_URL not set in environment", file=sys.stderr)
        return None
    try:
        resp = requests.get(
            REFUEL_APPS_SCRIPT_URL,
            params={"action": "get_refuel_data"},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") == "ok":
            return data["data"]
        print(f"⚠️ GAS error: {data.get('message')}", file=sys.stderr)
    except Exception as e:
        print(f"❌ Refuel fetch error: {e}", file=sys.stderr)
    return None


def format_report(rows: list[str]) -> str:
    """Định dạng báo cáo Refuel dưới dạng tin nhắn HTML."""
    now = datetime.now(TZ_MM)
    date_str = now.strftime("%d/%m/%Y")
    time_str = now.strftime("%H:%M")
    
    lines = [
        "⛽ <b>TNI REQUEST REFUEL — Daily Report</b>",
        f"📅 {date_str}  ⏰ {time_str} (Myanmar)",
        "━━━━━━━━━━━━━━━━━━━━━",
        "",
    ]
    for row in rows:
        lines.append(row)
        lines.append("")
        
    if not rows:
        lines.append("📭 No refuel requests today.")
        lines.append("")
        
    lines.append("━━━━━━━━━━━━━━━━━━━━━")
    lines.append("🤖 <i>Auto report by @TNI_REFUEL_BOT</i>")
    return "\n".join(lines)


def send_telegram(chat_id: str, text: str) -> tuple[bool, int | None]:
    """Gửi tin nhắn định dạng HTML lên group Telegram."""
    url = f"https://api.telegram.org/bot{REFUEL_BOT_TOKEN}/sendMessage"
    resp = requests.post(
        url,
        json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
        timeout=60,
    )
    res_json = resp.json()
    ok = res_json.get("ok", False)
    msg_id = None
    if ok:
        print(f"✅ Report sent to {chat_id}")
        msg_id = res_json.get("result", {}).get("message_id")
    else:
        print(f"❌ Send failed: {resp.text[:200]}", file=sys.stderr)
    return ok, msg_id


def main():
    print(f"⛽ Refuel Report — {datetime.now(TZ_MM).strftime('%d/%m/%Y %H:%M')} Myanmar")

    if not REFUEL_BOT_TOKEN:
        print("❌ REFUEL_BOT_TOKEN not set", file=sys.stderr)
        sys.exit(1)

    # 1. Thực hiện xóa tin nhắn báo cáo Refuel cũ trong group
    if REFUEL_APPS_SCRIPT_URL:
        try:
            from delete_old_helper import delete_old_messages_bot
            delete_old_messages_bot(REFUEL_BOT_TOKEN, REFUEL_CHAT_ID, REFUEL_APPS_SCRIPT_URL, "REFUEL_DAILY_REPORT")
        except Exception as e:
            print(f"⚠️ Error deleting old refuel report: {e}", file=sys.stderr)

    # 2. Lấy dữ liệu mới từ Apps Script
    rows = fetch_refuel_data()
    if rows is None:
        print("⚠️ No data available from spreadsheet, exiting")
        sys.exit(1)

    # 3. Định dạng và gửi tin mới
    msg = format_report(rows)
    print("📨 Report content:\n" + msg)
    ok, msg_id = send_telegram(REFUEL_CHAT_ID, msg)
    
    # 4. Lưu lại message ID mới gửi qua Apps Script để xóa ở lần sau
    if ok and REFUEL_APPS_SCRIPT_URL and msg_id:
        try:
            from delete_old_helper import save_msgids
            save_msgids(REFUEL_APPS_SCRIPT_URL, "REFUEL_DAILY_REPORT", [msg_id])
        except Exception as e:
            print(f"⚠️ Error saving refuel report msgid: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
