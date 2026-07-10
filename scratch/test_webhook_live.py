import requests
import json

url = "https://tni-bot.vercel.app/api/refuel_collector"
payload = {
    "update_id": 123456,
    "message": {
        "message_id": 9999,
        "from": {
            "id": 12345,
            "is_bot": False,
            "first_name": "Test",
            "last_name": "User",
            "username": "testuser"
        },
        "chat": {
            "id": -6859790680,
            "title": "9 TNI REQUEST REFUEL",
            "type": "group"
        },
        "date": 1600000000,
        "text": "TNI0061 Plan refuel: TNI0061: 400L\nTNI0319: 440L"
    }
}

try:
    print("Sending POST request to live webhook...")
    r = requests.post(url, json=payload, timeout=20)
    print(f"Status Code: {r.status_code}")
    print(f"Response: {r.text}")
except Exception as e:
    print("Error:", e)
