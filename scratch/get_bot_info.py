import requests

token = "8811503647:AAEVIToiaPbDeNTUPLsoI5xhdnufKdChsME"
url = f"https://api.telegram.org/bot{token}/getMe"
try:
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    print(resp.json())
except Exception as e:
    print("Error:", e)
