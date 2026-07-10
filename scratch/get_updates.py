import requests

TOKEN = "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME"

r = requests.get(f"https://api.telegram.org/bot{TOKEN}/getUpdates?limit=20", timeout=15)
updates = r.json().get("result", [])
print(f"Total updates: {len(updates)}")
for u in updates:
    msg = u.get("message") or {}
    chat = msg.get("chat", {})
    text = msg.get("text", "")
    cid   = chat.get("id", "")
    ctype = chat.get("type", "")
    title = chat.get("title") or chat.get("first_name", "")
    if cid:
        print(f"  chat_id={cid} [{ctype}] '{title}' text={repr(text[:30])}")
