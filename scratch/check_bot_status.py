"""
Kiểm tra:
1. Webhook Telegram đã đăng ký chưa
2. Bot có gửi được tin vào group không
3. Group ID đúng không
"""
import requests

BOT_TOKEN = "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME"
GROUP_ID  = "-6859790680"   # group refuel

print("=" * 55)
print("1. Kiểm tra webhook info:")
r = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo", timeout=10)
wh = r.json().get("result", {})
print(f"   URL     : {wh.get('url', '(trống)')}")
print(f"   Pending : {wh.get('pending_update_count', 0)}")
print(f"   Last err: {wh.get('last_error_message', 'none')}")
print(f"   Last err date: {wh.get('last_error_date', 'none')}")

print()
print("2. Kiểm tra thông tin bot:")
r2 = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getMe", timeout=10)
me = r2.json().get("result", {})
print(f"   Bot name: {me.get('first_name')} @{me.get('username')}")
print(f"   Can join groups: {me.get('can_join_groups')}")
print(f"   Can read all messages: {me.get('can_read_all_group_messages')}")

print()
print("3. Thử gửi tin vào group:")
r3 = requests.post(
    f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
    json={"chat_id": GROUP_ID, "text": "🔧 Bot connection test — OK", "parse_mode": "HTML"},
    timeout=10
)
res3 = r3.json()
if res3.get("ok"):
    print(f"   ✅ Gửi thành công vào group {GROUP_ID}")
else:
    print(f"   ❌ Lỗi: {res3.get('description')}")
    print(f"   Error code: {res3.get('error_code')}")
