import requests
import json

url = "https://script.google.com/macros/s/AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA/exec"

payload = {
    "action": "store_daily_plan",
    "date": "13/08/2026",
    "team": "Team 2",
    "content": "Daily Plan: 13/08/2026\nTeam 2\nI. Hot task . Rescue site down , TNI0406 , Pyi Kyaw Aung, Win Htet Aung\nII. Hot task Rescue Cell down:",
    "daily_report": "",
    "comparison": ""
}

print("Sending live test payload to Apps Script...")
r = requests.post(url, json=payload, timeout=30)
print("Status code:", r.status_code)
print("Response text:", r.text)
