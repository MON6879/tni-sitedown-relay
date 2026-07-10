import requests

url = "https://docs.google.com/spreadsheets/d/1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow/gviz/tq?tqx=out:csv&gid=0"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    resp.raise_for_status()
    print("CSV length:", len(resp.text))
    print("First 300 characters of CSV:")
    print(resp.text[:300])
except Exception as e:
    print("Error:", e)
