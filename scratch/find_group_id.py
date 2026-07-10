import requests

BOT_TOKEN = "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME"

# Tạm xóa webhook để lấy updates
print("Tạm xóa webhook...")
requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/deleteWebhook", timeout=10)

# Lấy updates
print("Lấy updates từ group vừa thêm bot...")
r = requests.get(
    f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates?limit=10&allowed_updates=message",
    timeout=15
)
updates = r.json().get("result", [])
print(f"Số updates: {len(updates)}")
groups_found = {}
for u in updates:
    msg = u.get("message") or {}
    chat = msg.get("chat", {})
    cid  = chat.get("id")
    ctitle = chat.get("title", "")
    ctype  = chat.get("type", "")
    if cid and ctype in ("group", "supergroup"):
        groups_found[cid] = ctitle

if groups_found:
    print("\nCác group bot đã thấy:")
    for cid, title in groups_found.items():
        print(f"  ID: {cid}  Title: {title}")
else:
    print("\nChưa thấy group nào — thử gửi 1 tin bất kỳ vào nhóm rồi chạy lại!")

# Đăng ký lại webhook
print("\nĐăng ký lại webhook...")
r2 = requests.get(
    f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook?url=https://tni-bot.vercel.app/api/refuel_collector",
    timeout=10
)
print(f"Webhook: {r2.json().get('description')}")
