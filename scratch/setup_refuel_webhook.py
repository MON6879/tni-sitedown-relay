"""
setup_refuel_webhook.py
========================
Đăng ký webhook cho @TNI_FUEL bot trỏ đến Vercel endpoint.
Chạy 1 lần sau khi deploy Vercel.

Usage:
  python setup_refuel_webhook.py
"""
import requests, os, sys

REFUEL_BOT_TOKEN = os.getenv("REFUEL_BOT_TOKEN", "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME")
WEBHOOK_URL      = "https://tni-bot.vercel.app/api/refuel_collector"

def main():
    base = f"https://api.telegram.org/bot{REFUEL_BOT_TOKEN}"

    # 1. Xóa webhook cũ
    print("🗑  Deleting old webhook...")
    r = requests.post(f"{base}/deleteWebhook", json={"drop_pending_updates": True}, timeout=15)
    print(f"   → {r.json()}")

    # 2. Đăng ký webhook mới
    print(f"🔗 Setting webhook → {WEBHOOK_URL}")
    r = requests.post(f"{base}/setWebhook", json={
        "url": WEBHOOK_URL,
        "allowed_updates": ["message", "inline_query"],
        "drop_pending_updates": True,
    }, timeout=15)
    resp = r.json()
    print(f"   → {resp}")

    if resp.get("ok"):
        print("✅ Webhook registered successfully!")
    else:
        print("❌ Failed:", resp.get("description"), file=sys.stderr)
        sys.exit(1)

    # 3. Verify
    print("\n🔍 Verifying webhook info...")
    r = requests.get(f"{base}/getWebhookInfo", timeout=15)
    info = r.json().get("result", {})
    print(f"   URL:         {info.get('url')}")
    print(f"   Pending:     {info.get('pending_update_count', 0)}")
    print(f"   Last error:  {info.get('last_error_message', 'none')}")

if __name__ == "__main__":
    main()
