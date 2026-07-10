import requests
import time
import json

token = "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME"
url = f"https://api.telegram.org/bot{token}/getUpdates"

print("Waiting for you to send a message in the Telegram group and tag @TNI_REFUEL_BOT...")
print("Listening for 120 seconds...")

start_time = time.time()
offset = 0
found = False

while time.time() - start_time < 120:
    try:
        resp = requests.get(url, params={"offset": offset, "timeout": 5}, timeout=10)
        resp.raise_for_status()
        updates = resp.json().get("result", [])
        if updates:
            print("\nReceived updates:")
            print(json.dumps(updates, indent=2))
            for u in updates:
                msg = u.get("message") or u.get("my_chat_member") or u.get("chat_member")
                if msg:
                    chat = msg.get("chat")
                    if chat:
                        print(f"\n🎉 FOUND CHAT ID: {chat.get('id')} (Title: {chat.get('title')}, Type: {chat.get('type')})")
                        found = True
                offset = u["update_id"] + 1
            if found:
                break
    except Exception as e:
        print("Error checking updates:", e)
    time.sleep(3)

if not found:
    print("\nTimeout: No updates received. Please make sure the bot is in the group and you sent a message tagging @TNI_REFUEL_BOT.")
