import requests
import re

url = "https://docs.google.com/spreadsheets/d/1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8/edit"
resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
html = resp.text

# Look for grid data or sheet names in the html
# e.g. "gid": 1234, "name": "Sheet1"
matches = re.findall(r'\"gid\"\s*:\s*(\d+)\s*,\s*\"name\"\s*:\s*\"([^\"]+)\"', html)
print("Found sheets:")
for gid, name in matches:
    print(f"Name: {name}, GID: {gid}")

# Try another regex
matches2 = re.findall(r'\"([^\"]+)\"\s*,\s*\"([^\"]+)\"\s*,\s*\"([^\"]+)\"\s*,\s*\"([^\"]+)\"\s*,\s*\"([^\"]+)\"\s*,\s*\"([^\"]+)\"\s*,\s*\"([^\"]+)\"\s*,\s*\"(\d+)\"', html)
# Let's print unique gids and names
gids = re.findall(r'\"sheetId\"\s*:\s*(\d+)', html)
sheet_names = re.findall(r'\"title\"\s*:\s*\"([^\"]+)\"', html)
print("\nsheetIds:", gids)
print("titles:", sheet_names)
