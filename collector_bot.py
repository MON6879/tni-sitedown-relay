"""
Bot thu thập dữ liệu từ nhân viên qua Telegram.
- Keyword (Order/Revoke/...) được đọc động từ tab "Config" trong Google Sheet
- Thêm/bớt keyword chỉ cần sửa Sheet, không cần đụng code
- Reply "Done: nội dung" → cập nhật cột hoàn thành đúng dòng
"""

import os
import asyncio
import logging
import re
import requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

# ===================== CẤU HÌNH =====================
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)
load_dotenv()

COLLECTOR_BOT_TOKEN = os.getenv("COLLECTOR_BOT_TOKEN")
APPS_SCRIPT_URL     = os.getenv("APPS_SCRIPT_URL")
TZ_VN = timezone(timedelta(hours=7))

# Cache keyword để không gọi Sheet mỗi tin nhắn
_keyword_cache      = []
_keyword_cache_time = None
CACHE_SECONDS       = 300   # refresh mỗi 5 phút


# ===================== LẤY KEYWORD TỪ SHEET =====================
def fetch_keywords() -> list[str]:
    """Gọi Apps Script GET để lấy danh sách keyword hiện tại."""
    global _keyword_cache, _keyword_cache_time
    now = datetime.now(TZ_VN)

    # Dùng cache nếu còn mới
    if _keyword_cache and _keyword_cache_time:
        age = (now - _keyword_cache_time).total_seconds()
        if age < CACHE_SECONDS:
            return _keyword_cache

    try:
        resp = requests.get(APPS_SCRIPT_URL, timeout=15)
        data = resp.json()
        if data.get("status") == "ok" and data.get("keywords"):
            _keyword_cache      = data["keywords"]
            _keyword_cache_time = now
            logger.info(f"📋 Keywords từ Sheet: {_keyword_cache}")
            return _keyword_cache
    except Exception as e:
        logger.warning(f"⚠️ Không lấy được keywords từ Sheet: {e}")

    # Fallback mặc định
    return _keyword_cache or ["Order", "Revoke", "Export", "Move"]


# ===================== PARSE TIN NHẮN =====================
def parse_message(text: str, keywords: list[str]) -> dict:
    """
    Tách nội dung theo từ khóa động từ Sheet.
    Ví dụ keywords = ["Order","Revoke","Export","Move","Install"]
    """
    result = {}
    # Tạo pattern động từ danh sách keyword
    kw_pattern = "|".join(re.escape(k) for k in keywords) + "|done"
    pattern = rf"({kw_pattern})\s*:\s*(.+?)(?=(?:{kw_pattern})\s*:|$)"
    matches = re.findall(pattern, text, re.IGNORECASE | re.DOTALL)
    for key, value in matches:
        result[key.lower()] = value.strip()
    return result


# ===================== GỬI LÊN APPS SCRIPT =====================
def send_to_sheet(payload: dict) -> dict:
    if not APPS_SCRIPT_URL:
        return {"status": "error", "message": "Chưa cấu hình APPS_SCRIPT_URL"}
    try:
        resp = requests.post(APPS_SCRIPT_URL, json=payload, timeout=15)
        return resp.json()
    except Exception as e:
        logger.error(f"Apps Script error: {e}")
        return {"status": "error", "message": str(e)}


# ===================== HANDLER: /start =====================
async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keywords = fetch_keywords()
    kw_lines = "\n".join(f"{kw}: ..." for kw in keywords)
    await update.message.reply_text(
        f"👋 *မင်္ဂလာပါ! ဒေတာစုဆောင်းရေး Bot*\n\n"
        f"📌 *ပေးပို့ပုံစံ:*\n"
        f"```\n{kw_lines}\n```\n\n"
        f"✅ *ပြီးစီးကြောင်း အစီရင်ခံရန်:*\n"
        f"Bot ၏ အတည်ပြုချက် မက်ဆေ့ကို Reply ပြု၍:\n"
        f"`Done: အဆင်ပြေပါသည်`\n\n"
        f"⚡ ကွက်လပ်ထားနိုင်သည် — မလိုအပ်သောကွက်ကို ချန်လှပ်နိုင်သည်။",
        parse_mode="Markdown",
    )


# ===================== HANDLER: /config =====================
async def cmd_config(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Xem danh sách keyword hiện tại."""
    global _keyword_cache_time
    _keyword_cache_time = None   # Force refresh
    keywords = fetch_keywords()
    kw_list  = "\n".join(f"  • {kw}" for kw in keywords)
    await update.message.reply_text(
        f"⚙️ *Keyword hiện tại từ Sheet:*\n{kw_list}\n\n"
        f"📝 Thêm/bớt trong tab *Config* của Google Sheet → tự động áp dụng!",
        parse_mode="Markdown",
    )


# ===================== HANDLER: TIN NHẮN =====================
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg  = update.message
    user = msg.from_user
    text = msg.text or ""
    now  = datetime.now(TZ_VN)

    sender_name = user.full_name or user.first_name or "Unknown"
    username    = f"@{user.username}" if user.username else str(user.id)
    keywords    = fetch_keywords()

    # ── Kiểm tra Reply với "Done:" ──
    if msg.reply_to_message and re.search(r"done\s*:", text, re.IGNORECASE):
        data        = parse_message(text, keywords)
        done_content = data.get("done", text.strip())

        original_text = msg.reply_to_message.text or ""
        ref_match     = re.search(r"#(\d+)", original_text)
        ref_id        = ref_match.group(1) if ref_match else None

        payload = {
            "action":    "done",
            "ref_id":    ref_id,
            "done":      done_content,
            "done_date": now.strftime("%d/%m/%Y"),
            "done_time": now.strftime("%H:%M"),
            "chat_id":   str(user.id),
        }
        result = send_to_sheet(payload)

        if result.get("status") == "ok":
            await msg.reply_text(
                f"✅ *#{ref_id} ပြီးစီးပြီ!*\n"
                f"📝 {done_content}\n"
                f"🕐 {now.strftime('%d/%m/%Y %H:%M')}",
                parse_mode="Markdown",
            )
        else:
            await msg.reply_text(
                f"⚠️ ဒေတာသိမ်းဆည်းမှု မအောင်မြင်ပါ။\n`{result.get('message','')}`",
                parse_mode="Markdown",
            )
        return

    # ── Xử lý tin nhắn thường ──
    data = parse_message(text, keywords)
    if not data:
        kw_lines = "\n".join(f"{kw}: ..." for kw in keywords)
        await msg.reply_text(
            f"❓ *မမှတ်မိပါ။*\n\nကျေးဇူးပြု၍ ဤပုံစံဖြင့် ပေးပို့ပါ:\n```\n{kw_lines}\n```",
            parse_mode="Markdown",
        )
        return

    # Chuẩn bị payload với fields động
    fields = {k: v for k, v in data.items() if k != "done"}
    payload = {
        "action":      "add",
        "date":        now.strftime("%d/%m/%Y"),
        "time":        now.strftime("%H:%M"),
        "sender_name": sender_name,
        "username":    username,
        "chat_id":     str(user.id),
        "fields":      fields,
    }
    result = send_to_sheet(payload)

    if result.get("status") == "ok":
        ref_id = str(result.get("row", "???")).zfill(5)
        lines  = [f"✅ *လက်ခံပြီး — 🆔 #{ref_id}*\n📅 {now.strftime('%d/%m/%Y %H:%M')}\n"]

        icons = {"order":"📦","revoke":"↩️","export":"📤","move":"🚚",
                 "install":"🔧","check":"🔍","repair":"🛠️"}
        for k, v in fields.items():
            if v:
                icon = icons.get(k.lower(), "▪️")
                lines.append(f"{icon} {k.capitalize()}: {v}")

        lines.append("\n_ပြီးစီးပါက ဤ မက်ဆေ့ကို Reply ပြု၍_ `Done: ...` _ပို့ပါ_")
        await msg.reply_text("\n".join(lines), parse_mode="Markdown")
    else:
        await msg.reply_text(
            f"❌ ဒေတာသိမ်းဆည်းမှု မအောင်မြင်ပါ!\n`{result.get('message','')}`",
            parse_mode="Markdown",
        )


# ===================== MAIN =====================
async def main():
    if not COLLECTOR_BOT_TOKEN:
        raise RuntimeError("Thiếu COLLECTOR_BOT_TOKEN trong .env!")

    # Load keyword ngay khi khởi động
    keywords = fetch_keywords()
    logger.info(f"🚀 Collector Bot khởi động | Keywords: {keywords}")

    app = ApplicationBuilder().token(COLLECTOR_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start",  cmd_start))
    app.add_handler(CommandHandler("config", cmd_config))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    async with app:
        await app.start()
        await app.updater.start_polling()
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
