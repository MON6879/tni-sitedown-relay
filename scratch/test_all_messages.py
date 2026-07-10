"""
Test gửi 3 loại tin nhắn khác nhau lên Vercel webhook để kiểm tra
ghi dữ liệu vào các tab Refueled, Plan refuel, Team request.
"""
import requests
import json
from datetime import datetime

VERCEL_URL = "https://tni-bot.vercel.app/api/refuel_collector"

# Simulates raw Telegram update format
def make_update(text, update_id=1, user_id="6859790680", username="Test"):
    return {
        "update_id": update_id,
        "message": {
            "message_id": update_id,
            "from": {
                "id": int(user_id),
                "is_bot": False,
                "first_name": username,
                "last_name": "",
                "username": username
            },
            "chat": {
                "id": -6859790680,
                "title": "9 TNI REQUEST REFUEL",
                "type": "group"
            },
            "date": 1720593000,
            "text": text
        }
    }

def send(label, payload):
    print(f"\n{'='*55}")
    print(f"TEST: {label}")
    try:
        r = requests.post(VERCEL_URL, json=payload, timeout=20)
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text[:300]}")
    except Exception as e:
        print(f"Error: {e}")

# ── 1. PLAN message ───────────────────────────────────────────
plan_text = """Plan refuel 10/07/2026 Team 3
TNI0061: 440L
TNI0319: 440L"""
send("PLAN message", make_update(plan_text, update_id=1001))

# ── 2. REQUEST message ────────────────────────────────────────
request_text = """Request refuel 10/07/2026 Team 3
TNI0061: 440L
TNI0319: 440L"""
send("REQUEST message", make_update(request_text, update_id=1002))

# ── 3. REFUELED message ───────────────────────────────────────
refueled_text = """1.Date =10/07/2026
2. Mytel DG ID  TNI0061(DG1)
3. DG Type        -YANMAR(30)kva
4. Power  Mode - DG+BB
5. Goverment Price:
6: Partner price:5500
7: How many percent increase: %
8: Reason price higher than Goverment: -
9: Filling fuel:
DG Running Hour -12000hrs
DG KWH Hours-50000KWH
Actual Filled Qty(L) -440L
1Liter price=5500MMK
Fuel Filling Team03
Before
Fuel Level %-10
CSU Reading(L) -44
Fuel Liter/cm        -(10)44L

After
Fuel Level %        -95
CSU Reading(L)-484
Fuel Liter/cm        -(95)484L"""
send("REFUELED message", make_update(refueled_text, update_id=1003))

print("\n" + "="*55)
print("Done. Now check your Google Sheet tabs!")
print("  - Plan refuel  → should have 2 new rows")
print("  - Team request → should have 2 new rows")
print("  - Refueled     → should have 1 new row")
