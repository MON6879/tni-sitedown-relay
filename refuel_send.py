import os
import sys
import re
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
    """Phân loại dữ liệu theo Team, lập bảng tổng hợp và chia nhỏ tin nếu vượt quá giới hạn 4096 ký tự."""
    now = datetime.now(TZ_MM)
    date_str = now.strftime("%d/%m/%Y")
    time_str = now.strftime("%H:%M")
    
    header_line = ""
    start_idx = 0
    if rows and "Report need refuel" in rows[0]:
        header_line = f"📋 <b>{rows[0]}</b>"
        start_idx = 1
        
    team_groups = {
        1: [],
        2: [],
        3: [],
        4: [],
        0: []
    }
    
    for i in range(start_idx, len(rows)):
        line = rows[i]
        # Tìm mã /T1, /T2, /T3...
        match = re.search(r'/T([1-9])', line)
        team_num = int(match.group(1)) if match else 0
        if team_num in team_groups:
            team_groups[team_num].append(line)
        else:
            team_groups[0].append(line)
            
    t1_count = len(team_groups[1])
    t2_count = len(team_groups[2])
    t3_count = len(team_groups[3])
    t4_count = len(team_groups[4])
    t0_count = len(team_groups[0])
    total_count = t1_count + t2_count + t3_count + t4_count + t0_count
    
    # Xây dựng danh sách dòng thô
    msg_lines = []
    
    # 1. Khung tổng hợp (Summary) ở đầu tin nhắn
    msg_lines.append("📊 <b>Summary by Team:</b>")
    msg_lines.append(f"🔴 Team 1: <b>{t1_count}</b> sites")
    msg_lines.append(f"🔵 Team 2: <b>{t2_count}</b> sites")
    msg_lines.append(f"🟢 Team 3: <b>{t3_count}</b> sites")
    msg_lines.append(f"🟡 Team 4: <b>{t4_count}</b> sites")
    if t0_count > 0:
        msg_lines.append(f"⚪ Other: <b>{t0_count}</b> sites")
    msg_lines.append(f"Total: <b>{total_count}</b> sites")
    msg_lines.append("━━━━━━━━━━━━━━━━━━━━━")
    msg_lines.append("")
    
    if header_line:
        msg_lines.append(header_line)
        msg_lines.append("")
        
    # 2. Liệt kê chi tiết
    team_emojis = {1: "🔴", 2: "🔵", 3: "🟢", 4: "🟡", 0: "⚪"}
    team_names = {1: "Team 1", 2: "Team 2", 3: "Team 3", 4: "Team 4", 0: "Other/Unknown"}
    
    for t in [1, 2, 3, 4, 0]:
        team_rows = team_groups[t]
        if team_rows:
            msg_lines.append(f"{team_emojis[t]} <b>{team_names[t]} ({len(team_rows)} sites)</b>")
            for r in team_rows:
                msg_lines.append(r)
            msg_lines.append("") # Dòng trống phân tách giữa các Team
            
    if total_count == 0:
        msg_lines.append("📭 No refuel requests today.")
        msg_lines.append("")
        
    # 3. Chia nhỏ dòng thô thành các phần an toàn (< 3800 ký tự)
    chunks = []
    current_chunk = []
    current_len = 0
    
    for line in msg_lines:
        if current_len + len(line) + 1 > 3800:
            chunks.append(current_chunk)
            current_chunk = [line]
            current_len = len(line)
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
        
        for line in chunk_lines:
            lines.append(line)
            
        # Thêm footer nếu chưa có ở cuối phần
        if lines[-1] != "🤖 <i>Auto report by @TNI_REFUEL_BOT</i>":
            if lines[-1] != "":
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
