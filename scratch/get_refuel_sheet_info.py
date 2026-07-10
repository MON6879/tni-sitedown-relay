import requests
import re

url = "https://docs.google.com/spreadsheets/d/1JxrA4pJo92Xx_SpwLnOQxphVYwE2iFhLrCOHmyVVuuM/edit"
try:
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    html = resp.text
    # Search for sheet names and sheetId/gid
    sheet_matches = re.findall(r'\"properties\":\s*\{\s*\"title\":\s*\"([^\"]+)\"[^}]*\"sheetId\":\s*(\d+)', html)
    print("Found sheets properties:")
    for name, gid in sheet_matches:
        print(f"Tab Name: {name}, GID: {gid}")
except Exception as e:
    print("Error:", e)
