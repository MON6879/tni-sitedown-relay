import requests
import json

token = "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME"
url = f"https://api.telegram.org/bot{token}/getUpdates"
try:
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    print(json.dumps(resp.json(), indent=2))
except Exception as e:
    print("Error:", e)
