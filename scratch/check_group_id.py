import requests

BOT_TOKEN = "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME"

# Test GAS URL mới
GAS_URL = "https://script.google.com/macros/s/AKfycbzZmFwP0j_Vr_m9mhQczzuVKFVoc7rNfVsz_HyM4JQTcgcdEFh8Zb5bNM5dsfHxZlxk/exec"

print("1. Test GAS URL:")
r = requests.get(GAS_URL, timeout=15)
print(f"   GET: {r.status_code} — {r.text[:80]}")

# Test các group ID có thể
print("\n2. Test gửi tin vào các group ID:")
candidates = [
    "-5469544739",   # từ PLAN_CHAT_ID trong GAS
    "-6859790680",   # từ code Vercel hiện tại
]
for gid in candidates:
    r2 = requests.post(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        json={"chat_id": gid, "text": "🔧 Bot ID test"},
        timeout=10
    )
    j = r2.json()
    ok = j.get("ok")
    desc = j.get("description", "OK")
    print(f"   {gid}: {'✅' if ok else '❌'} {desc}")

# Lấy updates để tìm group ID thực
print("\n3. Xem updates gần nhất từ bot (nếu không dùng webhook):")
r3 = requests.get(
    f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates?limit=5",
    timeout=10
)
updates = r3.json().get("result", [])
if updates:
    for u in updates:
        msg = u.get("message") or u.get("channel_post") or {}
        chat = msg.get("chat", {})
        print(f"   chat_id={chat.get('id')} title={chat.get('title','?')} type={chat.get('type','?')}")
else:
    print("   (không có updates — webhook đang active)")
