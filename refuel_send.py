import os
import sys
import re
import requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

from tg_utils import get_msg_id, set_msg_id, tg_delete, tg_delete_by_title

# Cấu hình bot và chat ID mặc định của group 9 TNI REQUEST REFUEL
REFUEL_BOT_TOKEN = os.getenv("REFUEL_BOT_TOKEN", "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME")
REFUEL_CHAT_ID   = os.getenv("REFUEL_CHAT_ID", "-5469544739")
# URL Apps Script của bảng tính Refuel riêng, nếu không có sẽ tự động dùng chung APPS_SCRIPT_URL
REFUEL_APPS_SCRIPT_URL = os.getenv("APPS_SCRIPT_URL", os.getenv("REFUEL_APPS_SCRIPT_URL", ""))

TZ_MM = timezone(timedelta(hours=6, minutes=30))  # Múi giờ Myanmar UTC+6:30


def fetch_refuel_data() -> list[str] | None:
    """Tải dữ liệu cột G của tab Refuel từ Google Sheets qua Apps Script Web App API."""
    if not REFUEL_APPS_SCRIPT_URL:
        print("❌ REFUEL_APPS_SCRIPT_URL not set in environment", file=sys.stderr)
        return None
    for attempt in range(1, 4):  # Retry tối đa 3 lần
        try:
            resp = requests.get(
                REFUEL_APPS_SCRIPT_URL,
                params={"action": "get_refuel_data"},
                timeout=60,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == "ok":
                return data["data"]
            print(f"⚠️ GAS error: {data.get('message')}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"⚠️ Attempt {attempt}/3 failed: {e}", file=sys.stderr)
            if attempt == 3:
                print("❌ All retries failed", file=sys.stderr)
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


def deduplicate_refuel_rows(rows: list[str]) -> list[str]:
    """
    Bỏ trùng các mã trạm / máy phát (ví dụ: TNI0013_1) trong báo cáo tổng hợp Request Refuel.
    - Thu thập dữ liệu: Thu thập 100% tất cả yêu cầu gửi về (cho phép dính trùng do yêu cầu chưa thực hiện theo kế hoạch cũ).
    - Lập báo cáo tổng hợp: Tự động lọc BỎ TRÙNG theo mã trạm/máy phát để so sánh chính xác với Kế hoạch (Plan).
    """
    if not rows:
        return []

    deduped = []
    seen_sites = set()

    for line in rows:
        line_clean = str(line).strip()
        if not line_clean:
            continue

        # Tìm các mã trạm dạng TNIxxxx hoặc TNIxxxx_1
        site_matches = re.findall(r'TNI\d+(?:_\d+)?', line_clean, re.IGNORECASE)
        if site_matches:
            # Nếu tất cả mã trạm trong dòng này đã từng xuất hiện ở dòng trước -> Bỏ qua dòng trùng
            all_seen = all(s.upper() in seen_sites for s in site_matches)
            if all_seen:
                continue

            # Đánh dấu các mã trạm mới vào danh sách đã thấy
            for s in site_matches:
                seen_sites.add(s.upper())

        deduped.append(line_clean)

    return deduped


def parse_sites_from_row(line_text: str) -> list[tuple[str, str]]:
    """
    Tách các trạm và dung tích dầu từ dòng Request Refuel, tự động LỌC BỎ các mốc ngày (DD/MM/YYYY).
    Trả về list [(site_code, qty_str), ...]
    Ví dụ: 'TNI0129_1: 660 + TNI0006_1: 660 < + > 01/08/2026: TNI0031_1: 440' -> [('TNI0129_1', '660L'), ('TNI0006_1', '660L'), ('TNI0031_1', '440L')]
    """
    if not line_text:
        return []

    # Loại bỏ phần tiêu đề "Team X request" nếu có
    clean_line = re.sub(r'^Team\s*\d+\s*request\s*', '', line_text, flags=re.IGNORECASE)

    # Tách chuỗi theo dấu + hoặc < + >
    raw_segments = re.split(r'\s*\+\s*|\s*<\s*\+\s*>\s*', clean_line)
    sites = []
    seen = set()

    for seg in raw_segments:
        seg_clean = seg.strip()
        if not seg_clean:
            continue

        # Tìm mã trạm TNIxxxx_y và dung tích L
        m = re.search(r'(TNI\d+(?:_\d+)?)\s*:\s*(\d+)', seg_clean, re.IGNORECASE)
        if m:
            site_code = m.group(1).upper()
            qty = m.group(2) + "L"
            if site_code not in seen:
                seen.add(site_code)
                sites.append((site_code, qty))

    return sites


def format_and_send_report(rows: list[str]) -> list[int]:
    """Phân loại dữ liệu theo Team, lập bảng tổng hợp và chia nhỏ tin nếu vượt quá giới hạn 4096 ký tự."""
    now = datetime.now(TZ_MM)
    date_str = now.strftime("%d/%m/%Y")
    time_str = now.strftime("%H:%M")
    
    team_sites = {1: [], 2: [], 3: [], 4: [], 0: []}
    team_emojis = {1: "🔴", 2: "🔵", 3: "🟢", 4: "🟡", 0: "⚪"}
    team_names = {1: "Team 1", 2: "Team 2", 3: "Team 3", 4: "Team 4", 0: "Other/Unknown"}

    for line in rows:
        line_clean = str(line).strip()
        if not line_clean or "Report need refuel" in line_clean:
            continue

        # Xác định Team
        match = re.search(r'Team[\s\-]*([1-9])', line_clean, re.IGNORECASE)
        t_num = int(match.group(1)) if match else 0
        if t_num not in team_sites:
            t_num = 0

        # Tách danh sách trạm (đã lọc bỏ ngày)
        parsed = parse_sites_from_row(line_clean)
        for site_code, qty in parsed:
            # Bỏ trùng trong cùng 1 Team
            if not any(s[0] == site_code for s in team_sites[t_num]):
                team_sites[t_num].append((site_code, qty))

    t1_count = len(team_sites[1])
    t2_count = len(team_sites[2])
    t3_count = len(team_sites[3])
    t4_count = len(team_sites[4])
    t0_count = len(team_sites[0])
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
        
    # 2. Liệt kê chi tiết theo từng Team (có chấm màu & danh sách trạm gọn gàng)
    for t in [1, 2, 3, 4, 0]:
        s_list = team_sites[t]
        if s_list:
            msg_lines.append(f"{team_emojis[t]} <b>{team_names[t]} ({len(s_list)} sites):</b>")
            for site_code, qty in s_list:
                msg_lines.append(f"• {site_code}: {qty}")
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
    STATE_KEY = f"refuel_daily_{REFUEL_CHAT_ID}"

    # Xóa tin cũ trước khi gửi mới
    tg_delete_by_title(REFUEL_CHAT_ID, "⛽ TNI REQUEST REFUEL")
    old_id = get_msg_id(STATE_KEY)
    if old_id:
        tg_delete(REFUEL_CHAT_ID, old_id)

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
        if lines[-1] != "🤖 <i>Auto report by @TNI_REFUEL_BOT</i>":
            if lines[-1] != "":
                lines.append("")
            lines.append("━━━━━━━━━━━━━━━━━━━━━")
            lines.append("🤖 <i>Auto report by @TNI_REFUEL_BOT</i>")

        msg = "\n".join(lines)
        ok, msg_id = send_telegram(REFUEL_CHAT_ID, msg)
        if ok and msg_id:
            sent_ids.append(msg_id)
            # Lưu ID tin mới nhất để lần sau xóa
            if idx == 0:
                set_msg_id(STATE_KEY, msg_id)

    return sent_ids


def main():
    print(f"⛽ Refuel Report — {datetime.now(TZ_MM).strftime('%d/%m/%Y %H:%M')} Myanmar")

    if not REFUEL_BOT_TOKEN:
        print("❌ REFUEL_BOT_TOKEN not set", file=sys.stderr)
        sys.exit(1)

    # Lấy dữ liệu mới từ Apps Script
    rows = fetch_refuel_data()
    if rows is None:
        print("⚠️ No data available from spreadsheet, exiting")
        sys.exit(1)

    # Gửi báo cáo (xóa tin cũ tự động qua tg_send_fresh)
    format_and_send_report(rows)


if __name__ == "__main__":
    main()
