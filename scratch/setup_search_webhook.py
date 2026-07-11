"""
Set webhook cho TNI Search Bot trên Vercel.
Chạy 1 lần duy nhất sau khi deploy Vercel:

    python setup_search_webhook.py

Yêu cầu: file .env phải có TELEGRAM_TOKEN
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("TELEGRAM_TOKEN", "").strip()
WEBHOOK_URL = "https://tni-bot.vercel.app/api/search_bot"

if not TOKEN:
    print("❌ Thiếu TELEGRAM_TOKEN trong .env")
    exit(1)

# 1. Xóa webhook cũ (nếu có)
print("🔄 Xóa webhook cũ...")
r1 = requests.get(f"https://api.telegram.org/bot{TOKEN}/deleteWebhook")
print(f"   {r1.json()}")

# 2. Set webhook mới
print(f"🔗 Set webhook: {WEBHOOK_URL}")
r2 = requests.post(
    f"https://api.telegram.org/bot{TOKEN}/setWebhook",
    json={"url": WEBHOOK_URL}
)
result = r2.json()
print(f"   {result}")

if result.get("ok"):
    print("✅ Webhook đã set thành công! Bot chạy 24/7 trên Vercel.")
else:
    print(f"❌ Lỗi: {result.get('description', 'Unknown')}")

# 3. Kiểm tra
print("\n📋 Thông tin webhook hiện tại:")
r3 = requests.get(f"https://api.telegram.org/bot{TOKEN}/getWebhookInfo")
info = r3.json().get("result", {})
print(f"   URL: {info.get('url', '(trống)')}")
print(f"   Pending updates: {info.get('pending_update_count', 0)}")
print(f"   Last error: {info.get('last_error_message', '(không)')}")
