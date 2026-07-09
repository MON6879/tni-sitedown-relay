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


def format_and_send_report(rows: list[str]) -> list[int]:
    """Chia nhỏ báo cáo và gửi lên Telegram để tránh vượt quá giới hạn 4096 ký tự."""
    now = datetime.now(TZ_MM)
    date_str = now.strftime("%d/%m/%Y")
    time_str = now.strftime("%H:%M")
    
    header_line = ""
    start_idx = 0
    if rows and "Report need refuel" in rows[0]:
        header_line = f"📋 <b>{rows[0]}</b>\n"
        start_idx = 1
        
    base_title = "⛽ <b>TNI REQUEST REFUEL — Daily Report</b>\n📅 {date_str}  ⏰ {time_str} (Myanmar)\n━━━━━━━━━━━━━━━━━━━━━\n\n"
    base_footer = "\n━━━━━━━━━━━━━━━━━━━━━\n🤖 <i>Auto report by @TNI_REFUEL_BOT</i>"
    
    # Chia nhỏ các dòng dữ liệu thành các chunk an toàn (< 4000 ký tự)
    chunks = []
    current_chunk = []
    current_len = len(base_title) + len(base_footer) + (len(header_line) if header_line else 0)
    
    for i in range(start_idx, len(rows)):
        line = rows[i]
        if current_len + len(line) + 1 > 4000:
            chunks.append(current_chunk)
            current_chunk = [line]
            current_len = len(base_title) + len(base_footer) + len(line)
        else:
            current_chunk.append(line)
            current_len += len(line) + 1
            
    if current_chunk:
        chunks.append(current_chunk)
        
    sent_ids = []
    for idx, chunk_lines in enumerate(chunks):
        title = "⛽ <b>TNI REQUEST REFUEL — Daily Report</b>"
        if len(chunks) > 1:
            title += f" (Phần {idx + 1}/{len(chunks)})"
            
        lines = [
            title,
            f"📅 {date_str}  ⏰ {time_str} (Myanmar)",
            "━━━━━━━━━━━━━━━━━━━━━",
            ""
        ]
        
        # Chỉ in Header ở phần 1
        if idx == 0 and header_line:
            lines.append(header_line)
            
        for line in chunk_lines:
            lines.append(line)
            
        lines.append("")
        lines.append("━━━━━━━━━━━━━━━━━━━━━")
        lines.append("🤖 <i>Auto report by @TNI_REFUEL_BOT</i>")
        
        msg = "\n".join(lines)
        ok, msg_id = send_telegram(REFUEL_CHAT_ID, msg)
        if ok and msg_id:
            sent_ids.append(msg_id)
            
    return sent_ids


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

    # 3. Chia nhỏ tin và gửi đi
    new_ids = format_and_send_report(rows)
    
    # 4. Lưu lại danh sách message ID mới gửi qua Apps Script để xóa ở lần sau
    if new_ids and REFUEL_APPS_SCRIPT_URL:
        try:
            from delete_old_helper import save_msgids
            save_msgids(REFUEL_APPS_SCRIPT_URL, "REFUEL_DAILY_REPORT", new_ids)
        except Exception as e:
            print(f"⚠️ Error saving refuel report msgid: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
