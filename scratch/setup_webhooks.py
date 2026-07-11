"""
Run this script ONCE to register Telegram webhooks for both bots.
Usage:
    python setup_webhooks.py https://your-app.vercel.app
"""
import sys
import requests

VERCEL_URL = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else input("Enter your Vercel URL (e.g. https://tni-bot.vercel.app): ").strip().rstrip("/")

LOOKUP_BOT_TOKEN    = "8606383435:AAEstcN4Om6_9ZAjs4OoFV2uVlRALgae2Ac"
COLLECTOR_BOT_TOKEN = "8928677923:AAE_cJuEDH1tUf5v0q5Wf0UjDHlcp_k1lGM"

bots = [
    ("TNI Lookup Bot",    LOOKUP_BOT_TOKEN,    f"{VERCEL_URL}/api/index"),
    ("Collector Bot",     COLLECTOR_BOT_TOKEN, f"{VERCEL_URL}/api/collector"),
]

for name, token, webhook_url in bots:
    print(f"\n--- {name} ---")
    print(f"  Webhook: {webhook_url}")

    # Delete old webhook first
    del_resp = requests.get(f"https://api.telegram.org/bot{token}/deleteWebhook")
    print(f"  Delete old: {del_resp.json().get('description','')}")

    # Set new webhook
    set_resp = requests.get(
        f"https://api.telegram.org/bot{token}/setWebhook",
        params={"url": webhook_url, "allowed_updates": '["message"]'}
    )
    result = set_resp.json()
    if result.get("ok"):
        print(f"  ✅ Webhook set successfully!")
    else:
        print(f"  ❌ Failed: {result.get('description','')}")

print("\nDone! Both bots are now connected to Vercel.")
