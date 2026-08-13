import requests
import json
import os
from dotenv import load_dotenv
load_dotenv()

gas_url = os.getenv("SD_APPS_SCRIPT_URL") or "https://script.google.com/macros/s/AKfycbz-NZlBk8q2jWb7no6P6zWyD7a_9D3eqpZmPNqniSXJdwkfBPJMJZQ0Babbx2nX_pLEGA/exec"

sample_text = """copy
Site down (not include long time site down) in Tanintharyi Region - 13/08/2026 07:30:00

Total sites down (not include long time site down): 15

STATION | DURATION | OWNER | POWER MODEL
─────────────────────────────────────────────
TNI0335 | 1495.51 h | OCK | DG+BB
TNI0165 | 807.72 h | IGT | DG+BB
TNI0185 | 406.87 h | MyTel | DG+Solar+BB
"""

payload = {
    "action": "store_site_down",
    "text": sample_text
}

print("Testing store_site_down Apps Script webhook...")
try:
    resp = requests.post(gas_url, json=payload, timeout=30)
    print("Status code:", resp.status_code)
    print("Response text:", resp.text[:300])
except Exception as e:
    print("Error:", e)
