import os
import sys
import re
import requests
import csv
import io
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
    """Tải trực tiếp nội dung các ô Y2 trở đi (Column Y) của tab Need Refuel từ Google Sheets CSV Export."""
    csv_url = "https://docs.google.com/spreadsheets/d/1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM/export?format=csv&gid=0"
    try:
        resp = requests.get(csv_url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        resp.encoding = "utf-8"
        reader = list(csv.reader(io.StringIO(resp.text)))
        data = []
        for r in reader[1:10]:  # Read rows 2 to 10 (Y2:Y10)
            if len(r) > 24 and r[24].strip():
                data.append(r[24].strip())
        if data:
            return data
    except Exception as e:
        print(f"⚠️ Direct CSV fetch warning: {e}", file=sys.stderr)

    # Fallback qua Apps Script API
    if REFUEL_APPS_SCRIPT_URL:
        try:
            resp = requests.get(REFUEL_APPS_SCRIPT_URL, params={"action": "get_refuel_data"}, timeout=30)
            if resp.status_code == 200 and resp.json().get("status") == "ok":
                return resp.json()["data"]
        except Exception:
            pass
    return None


def send_telegram(chat_id: str, text: str) -> tuple[bool, int | None]:
    """Gửi tin nhắn định dạng HTML lên group Telegram (có tự động retry bằng Plain Text nếu lỗi)."""
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
        print(f"⚠️ HTML send failed, retrying plain text: {resp.text[:200]}", file=sys.stderr)
        plain_text = re.sub(r'<[^>]*>', '', text)
        resp_fallback = requests.post(
            url,
            json={"chat_id": chat_id, "text": plain_text},
            timeout=60,
        )
        res_json_fb = resp_fallback.json()
        ok = res_json_fb.get("ok", False)
        if ok:
            print(f"✅ Report sent to {chat_id} (Plain Text fallback)")
            msg_id = res_json_fb.get("result", {}).get("message_id")
        else:
            print(f"❌ Send failed: {resp_fallback.text[:200]}", file=sys.stderr)
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
    """Gửi nguyên văn nội dung các ô Y2:Y5 (đã có sẵn chấm màu 🔴 🔵 🟢 🟡) giữ đúng mẫu ngắn gọn."""
    now = datetime.now(TZ_MM)
    date_str = now.strftime("%d/%m/%Y")
    time_str = now.strftime("%H:%M")
    
    msg_lines = []
    for line in rows:
        line_clean = str(line).strip()
        if line_clean and "Report need refuel" not in line_clean:
            if line_clean.lower().startswith("/note:") or line_clean.lower().startswith("note:"):
                msg_lines.append(line_clean)
                msg_lines.append("")
                continue

            # Loại bỏ ký tự hỏng mã hóa ở đầu nếu có và ép hiển thị đúng emoji chấm màu
            clean = re.sub(r'^[^\w\s🔴🔵🟢🟡]+', '', line_clean).strip()
            # Escape HTML characters < >
            clean = clean.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            if re.search(r'Team\s*1\b', clean, re.IGNORECASE) and not clean.startswith("🔴"):
                clean = "🔴 " + re.sub(r'^(?:🔴|ð\s*\')?\s*', '', clean)
            elif re.search(r'Team\s*2\b', clean, re.IGNORECASE) and not clean.startswith("🔵"):
                clean = "🔵 " + re.sub(r'^(?:🔵|ðµ)?\s*', '', clean)
            elif re.search(r'Team\s*3\b', clean, re.IGNORECASE) and not clean.startswith("🟢"):
                clean = "🟢 " + re.sub(r'^(?:🟢|ð¢)?\s*', '', clean)
            elif re.search(r'Team\s*4\b', clean, re.IGNORECASE) and not clean.startswith("🟡"):
                clean = "🟡 " + re.sub(r'^(?:🟡|ð¡)?\s*', '', clean)

            msg_lines.append(clean)
            msg_lines.append("")  # Dòng trống giữa các Team
            
    if not msg_lines:
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
